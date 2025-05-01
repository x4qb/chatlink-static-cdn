async function returnContentType(url) {
    const userUrl = new URL(request.url);
    
const allowedExtensions = ['.png', '.jpg', '.jpeg', '.gif', '.webp'];
const pathname = userUrl.pathname.toLowerCase();
const isAllowed = allowedExtensions.some(ext => pathname.endsWith(ext));

if (!isAllowed) {
  return new Response("Unsupported file type", { status: 415 });
} else {
    return "image/png"
}
    
    try {
        const response = await fetch(url, { method: 'HEAD' });
        const contentType = response.headers.get('Content-Type');
        console.log(response);
        
        if (contentType) {
            return contentType;
        }
        
        return null;
    } catch (error) {
        console.error('error check content type', error);
        return false;
    }
}

function extractFirstUrl(text) {
    const urlRegex = /(https?:\/\/[^\s]+)/g;
    const matches = text.match(urlRegex);
    return matches ? matches[0] : null;
}

let unread = 0
let roomNameVar
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
    roomNameVar = roomName

    if (document.visibilityState !== 'visible') {
        const notifAudio = new Audio('/cdn/media/receivednotif.mp3')
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

document.addEventListener('visibilitychange', function() {
    if (document.visibilityState === 'visible') {
        unread = 0
        document.title = `Chatlink - ${roomNameVar}`;
    }
});

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

function convertUrlsToLinks(text) {
    const urlPattern = /(\b(?:https?|ftp):\/\/[^\s/$.?#].[^\s]*)|(\b(?:www\.)[^\s/$.?#].[^\s]*)|(\b[^\s]+\.[a-z]{2,}\b)/gi;
    return text.replace(urlPattern, (url) => {
        if (url.startsWith('www')) {
            url = 'https://' + url;
        }
        return `<a href="${url}" target="_blank" rel="noopener noreferrer">${url}</a>`;
    });
}

async function bcMessage(supabaseVar, room) {
    const messagesContainer = document.getElementById('messages');
    const messageInput = document.getElementById('messageInput');
    const sendButton = document.getElementById('sendButton');
    const content = messageInput.value.trim();

    if (!content) return;

    const { error } = await supabaseVar.from('messages').insert([{ content, room }]);

    const requestBody = { content, room };

    try {
        const response = await fetch('https://chatlink.space/messages/', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(requestBody),
        });

        if (!response.ok) {
            const errorMessage = await response.text();
            alert(`Error: ${errorMessage}`);
            return;
        }

        const responseData = await response.json();
        messageInput.value = '';
    } catch (error) {
        console.error('Error sending message:', error);
    }

    if (error) {
        console.error('Error broadcasting message via Supabase:', error);
    }
}

async function startRealtime(supabaseVar, roomName) {
    try {
        await supabaseVar.channel('public:messages').on('postgres_changes', {
            event: 'INSERT',
            schema: 'public',
            table: 'messages',
        }, (payload) => {
            receiveMessage(payload.new.content || JSON.stringify(payload.new), roomName);
        }).subscribe();
        console.log("connected");
    } catch (error) {
        console.error("Connection failed", error);
    }
}
