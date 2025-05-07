let unread = 0;
let roomNameVar;
let socket;

async function returnContentType(url) {
  try {
    const response = await fetch(url, {
      method: 'GET',
    });

    if (response.ok) {
      return response.headers.get('Content-Type');
    } else {
      console.error('failed content type fetch', response.status, response.statusCode);
      return null;
    }
  } catch (error) {
    console.error('error content type fetch', error);
    return null;
  }
}

async function fetchResource(url) {
  try {
    const response = await fetch(url, { method: 'GET' });

    if (response.ok) {
      const contentType = response.headers.get('Content-Type');
      
      if (contentType === 'text/plain') {
        const text = await response.text();
        if (text.startsWith('http')) {
          return { contentType: 'text/html-link', objectUrl: text };
        }
      }
      
      const blob = await response.blob();
      const objectUrl = URL.createObjectURL(blob);
      return { contentType, objectUrl };
    } else {
      console.error('Failed to fetch resource:', response.status, response.statusText);
      return null;
    }
  } catch (error) {
    console.error('Error fetching resource:', error);
    return null;
  }
}

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
    console.log('%c⚠ WARNING! ⚠\nDo NOT paste code you don\'t understand or trust here.\nIt may give attackers access to your account or data.', 'color: red; font-size: 16px; font-weight: bold;');
    console.log('Chatlink connectivity finished');
    loadPriorMessages(roomName);
  };

  socket.onmessage = (event) => {
    const data = event.data;
    receiveMessage(data, roomName);
  };

  socket.onerror = (error) => {
    console.error('Chatlink connectivity error:', error);
  };

  socket.onclose = () => {
    console.log('Connection to Chatlink expired. Reload');
  };
}

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
    const notifAudio = new Audio('https://cdn.chatlink.space/audios/receivednotif.mp3');
    notifAudio.play();
    unread += 1;
    document.title = `(${unread}) Chatlink - ${roomName}`;
  }

  const resource = await fetchResource(firstUrl);
  if (!resource) return;

  const { contentType, objectUrl } = resource;

  if (contentType.startsWith('image/')) {
    msg.className = 'image-message';
    msg.innerHTML = realText.length > 0 ? 
      `<div class="chat-message">${realText}</div>
      <img src="${objectUrl}" alt="User sent image" class="image-message" onerror="this.onerror=null; this.src='/cdn/images/error.png';">` : 
      `<img src="${objectUrl}" alt="User sent image" class="image-message" onerror="this.onerror=null; this.src='/cdn/images/error.png';">`;
  } else if (contentType.startsWith('audio/')) {
    msg.className = 'audio-message';
    msg.innerHTML = realText.length > 0 ? 
      `<div class="chat-message">${realText}</div>
      <audio controls>
        <source src="${objectUrl}" type="${contentType}">
        Your browser does not support the audio element.
      </audio>` : 
      `<audio controls>
        <source src="${objectUrl}" type="${contentType}">
        Your browser does not support the audio element.
      </audio>`;
  } else if (contentType === 'text/html-link') {
    msg.innerHTML = realText.length > 0 ? 
      `<div class="chat-message">${realText}</div>
      <a href="${objectUrl}" target="_blank" rel="noopener noreferrer">${objectUrl}</a>` : 
      `<a href="${objectUrl}" target="_blank" rel="noopener noreferrer">${objectUrl}</a>`;
  } else if (contentType.startsWith('video/')) {
    msg.className = 'video-message';
    msg.innerHTML = realText.length > 0 ? 
      `<div class="chat-message">${realText}</div>
      <video controls width="300">
        <source src="${objectUrl}" type="${contentType}">
        Your browser does not support the video tag.
      </video>` : 
      `<video controls width="300">
        <source src="${objectUrl}" type="${contentType}">
        Your browser does not support the video tag.
      </video>`;
  } else if (contentType === 'application/pdf') {
    msg.className = 'pdf-message';
    msg.innerHTML = realText.length > 0 ? 
      `<div class="chat-message">${realText}</div>
      <iframe src="${objectUrl}" width="100%" height="500px" style="border: none;"></iframe>` : 
      `<iframe src="${objectUrl}" width="100%" height="500px" style="border: none;"></iframe>`;
  } else if (contentType === 'text/html') {
  const isAllowed = confirm('This is an external or untrusted page. Do you want to continue?');
  
  if (isAllowed) {
    msg.innerHTML = realText.length > 0 ? 
      `<div class="chat-message">${realText}</div>` : '';
  } else {
    msg.innerHTML = `<div class="chat-message">Link blocked</div>`;
  }
} else {
  msg.innerHTML = realText.length > 0 ? 
    `<div class="chat-message">${realText}</div>` : '';
}
}

document.addEventListener('visibilitychange', function() {
  if (document.visibilityState === 'visible' && socket === null) {
    connectWebSocket(roomNameVar);
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
    else if (!url.startsWith('http://') && !url.startsWith('https://')) {
      url = 'https://' + url;
    }

    if (url.startsWith('https://chatlink.space/rooms/')) {
      const roomName = url.split('/rooms/')[1].split('/')[0];
      const displayText = `Chatlink Room - ${roomName}`;
      return `<a href="${url}" target="_blank" rel="noopener noreferrer">${displayText}</a>`;
    }

    if (url.match(/https?:\/\/[^\s/$.?#].[^\s]*\/[^\s]*/)) {
      return `<a href="${url}" target="_blank" rel="noopener noreferrer">${url.replace(/^https?:\/\//, '')}</a>`;
    }

    return `<a href="${url}" target="_blank" rel="noopener noreferrer">${url.replace(/^https?:\/\//, '')}</a>`;
  });
}


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

async function bcMessage(room) {
  const messageInput = document.getElementById('messageInput');
  let content = messageInput.value.trim();

  if (!content) return;
  
  if (socket && socket.readyState === WebSocket.OPEN) {
    socket.send(content);
    receiveMessage(content, room);
    messageInput.value = '';
  } else {
    console.error('WebSocket is not open');
  }
}

document.addEventListener('DOMContentLoaded', () => {
  const pathParts = window.location.pathname.split('/');
  const roomName = pathParts[pathParts.length - 1];

  connectWebSocket(roomName);

  document.getElementById('sendButton').addEventListener('click', () => {
    const messageInput = document.getElementById('messageInput');
    const content = messageInput.value.trim();
    if (!content) return;
    bcMessage(roomName);
  });

  document.getElementById('messageInput').addEventListener('keydown', (event) => {
    if (event.key === 'Enter') {
      const messageInput = document.getElementById('messageInput');
      const content = messageInput.value.trim();
      if (content) {
        event.preventDefault();
        bcMessage(roomName);
      }
    }
  });
});
