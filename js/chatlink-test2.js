let unread = 0;
let roomNameVar;

// WebSocket setup for the new system
let socket;

// Function to extract the first URL from the content
function extractFirstUrl(content) {
    const urlPattern = /https?:\/\/[^\s]+/;
    const match = content.match(urlPattern);
    return match ? match[0] : null;
}

async function connectWebSocket(roomName) {
    roomNameVar = roomName;
    const wsUrl = `wss://chatlink.space/messagerouting/websocket/connection?room=${roomName}`;

    socket = new WebSocket(wsUrl);

    socket.onopen = () => {
        console.log('WebSocket connection established');
        loadPriorMessages(roomName);
    };

    socket.onmessage = (event) => {
        const data = event.data;
        receiveMessage(data, roomName);
    };

    socket.onerror = (error) => {
        console.error('WebSocket error:', error);
    };

    socket.onclose = () => {
        console.log('WebSocket connection closed');
    };
}

// Function to receive incoming messages and display them
async function receiveMessage(content, roomName) {
    const messagesContainer = document.getElementById('messages');
    const msg = document.createElement('div');
    msg.className = 'chat-message';
    msg.innerHTML = convertUrlsToLinks(content);
    messagesContainer.appendChild(msg);
    messagesContainer.scrollTop = messagesContainer.scrollHeight;

    const realText = content.replace(/https?:\/\/[^\s]+/g, '').trim();
    const firstUrl = extractFirstUrl(content);
    if (!firstUrl) return;

    if (document.visibilityState !== 'visible') {
        const notifAudio = new Audio('/cdn/media/receivednotif.mp3');
        notifAudio.play();
        unread += 1;
        document.title = `(${unread}) Chatlink - ${roomName}`;
    }

    const contentType = await returnContentType(firstUrl);
    if (firstUrl && typeof contentType === 'string' && contentType.startsWith('image/')) {
        msg.className = 'image-message';
        msg.innerHTML = `
            <div class="chat-message">${realText}</div>
            <img 
                src="${firstUrl}" 
                alt="User sent image" 
                class="image-message" 
                onerror="this.onerror=null; this.src='/cdn/images/error.png';"
            >
        `;
    } else if (firstUrl && typeof contentType === 'string' && contentType.startsWith('audio/')) {
        msg.className = 'audio-message';
        msg.innerHTML = `
            <div class="chat-message">${realText}</div>
            <audio controls>
                <source src="${firstUrl}" type="audio/mpeg">
                Your browser does not support the audio element.
            </audio>
        `;
    } else if (firstUrl && typeof contentType === 'string' && contentType.startsWith('video/')) {
        msg.className = 'video-message';
        msg.innerHTML = `
            <div class="chat-message">${realText}</div>
            <video controls width="300">
                <source src="${firstUrl}" type="video/mp4">
                Your browser does not support the video tag.
            </video>
        `;
    } else if (firstUrl && typeof contentType === 'string' && contentType === 'text/html') {
        msg.innerHTML = `
            <div class="chat-message">${realText}</div>
        `;
    } else if (firstUrl && await returnContentType(firstUrl) === 'application/pdf') {
        msg.className = 'pdf-message';
        msg.innerHTML = `
            <div class="chat-message">${realText}</div>
            <iframe src="${firstUrl}" width="100%" height="500px" style="border: none;"></iframe>
        `;
    }
}

// Connect WebSocket when the page is visible
document.addEventListener('visibilitychange', function() {
    if (document.visibilityState === 'visible' && socket === null) {
        connectWebSocket(roomNameVar);
    }
});

// Function to load prior messages from the backend
async function loadPriorMessages(roomName) {
    try {
        const response = await fetch(`https://chatlink.space/messages/room/${roomName}`, {
            method: 'GET',
            headers: {
                'Content-Type': 'application/json',
            },
        });

        if (!response.ok) {
            throw new Error('Failed to fetch prior messages');
        }

        const responseData = await response.json();

        if (responseData.length === 0) {
            receiveMessage("It seems like there are no previous messages in this chatroom. Start the conversation!", roomName);
        }

        for (const msg of responseData) {
            await receiveMessage(msg.content, roomName);
        }
    } catch (error) {
        console.error('Error loading messages:', error);
    }
}

// Convert URLs in message to clickable links
function convertUrlsToLinks(text) {
    const urlPattern = /(\b(?:https?|ftp):\/\/[^\s/$.?#].[^\s]*)|(\b(?:www\.)[^\s/$.?#].[^\s]*)|(\b[^\s]+\.[a-z]{2,}\b)/gi;
    return text.replace(urlPattern, (url) => {
        if (url.startsWith('www')) {
            url = 'https://' + url;
        }
        return `<a href="${url}" target="_blank" rel="noopener noreferrer">${url}</a>`;
    });
}

// Function to escape HTML to prevent XSS
function escapeHtml(unsafe) {
    return unsafe.replace(/[&<>"']/g, function (match) {
        const escapeChars = {
            '&': '&amp;',
            '<': '&lt;',
            '>': '&gt;',
            '"': '&quot;',
            "'": '&#039;',
        };
        return escapeChars[match];
    });
}

// Send message function to send over WebSocket
async function bcMessage(room) {
    const messagesContainer = document.getElementById('messages');
    const messageInput = document.getElementById('messageInput');
    let content = messageInput.value.trim();

    if (!content) return;

    content = escapeHtml(content);

    if (socket && socket.readyState === WebSocket.OPEN) {
        socket.send(content);
        messageInput.value = '';  // Clear the input after sending
    } else {
        console.error('WebSocket is not open');
    }
}

// Call connectWebSocket when the page is ready to start listening to messages for the room
document.addEventListener('DOMContentLoaded', () => {
    const roomName = 'exampleRoom';  // Replace with the actual room name
    connectWebSocket(roomName);
});
