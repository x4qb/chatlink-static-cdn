let unread = 0;
let roomNameVar;
let socket;

async function returnContentType(url) {
  try {
    const response = await fetch(url, { method: 'GET' });
    if (response.ok) {
      return response.headers.get('Content-Type');
    } else {
      console.error('Failed to fetch content type:', response.status, response.statusText);
      return null;
    }
  } catch (error) {
    console.error('Error fetching content type:', error);
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
    console.log('%c⚠️ WARNING! ⚠️\nDo NOT paste code you don\'t understand or trust here.\nIt may give attackers access to your account or data.', 'color: red; font-size: 16px; font-weight: bold;');
    console.log('Chatlink connectivity finished');
    loadPriorMessages(roomName);
  };

  socket.onmessage = (event) => {
    receiveMessage(event.data, roomName);
  };

  socket.onerror = (error) => {
    console.error('WebSocket error:', error);
  };

  socket.onclose = () => {
    console.log('WebSocket connection closed');
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
    const notifAudio = new Audio('/cdn/media/receivednotif.mp3');
    notifAudio.play();
    unread += 1;
    document.title = `(${unread}) Chatlink - ${roomName}`;
  }

  const resource = await fetchResource(firstUrl);
  if (!resource) return;

  const { contentType, objectUrl } = resource;
  let mediaHtml = '';

  if (contentType.startsWith('image/')) {
    mediaHtml = `
      <a href="${firstUrl}" target="_blank" rel="noopener noreferrer">
        <img src="${objectUrl}" data-real-url="${firstUrl}" alt="User sent image" class="image-message"
          onerror="this.onerror=null; this.src='/cdn/images/error.png';">
      </a>`;
  } else if (contentType.startsWith('audio/')) {
    mediaHtml = `
      <a href="${firstUrl}" target="_blank" rel="noopener noreferrer">
        <audio controls data-real-url="${firstUrl}">
          <source src="${objectUrl}" type="${contentType}" data-real-url="${firstUrl}">
          Your browser does not support the audio element.
        </audio>
      </a>`;
  } else if (contentType === 'text/html-link') {
    mediaHtml = `
      <a href="${objectUrl}" target="_blank" rel="noopener noreferrer">${objectUrl}</a>`;
  } else if (contentType.startsWith('video/')) {
    mediaHtml = `
      <a href="${firstUrl}" target="_blank" rel="noopener noreferrer">
        <video controls width="300" data-real-url="${firstUrl}">
          <source src="${objectUrl}" type="${contentType}" data-real-url="${firstUrl}">
          Your browser does not support the video tag.
        </video>
      </a>`;
  } else if (contentType === 'application/pdf') {
    mediaHtml = `
      <a href="${firstUrl}" target="_blank" rel="noopener noreferrer">
        <iframe src="${objectUrl}" width="100%" height="500px" style="border: none;" data-real-url="${firstUrl}"></iframe>
      </a>`;
  }

  msg.innerHTML = realText.length > 0
    ? `<div class="chat-message">${realText}</div>${mediaHtml}`
    : mediaHtml;
}

document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'visible' && socket === null) {
    connectWebSocket(roomNameVar);
  }
});

async function loadPriorMessages(roomName) {
  try {
    const response = await fetch(`https://chatlink.space/messages/room/${roomName}`, {
      method: 'GET',
      headers: { 'Content-Type': 'application/json' }
    });

    if (!response.ok) throw new Error('Failed to fetch prior messages');

    const responseData = await response.json();
    if (responseData.length === 0) {
      receiveMessage('It seems like there are no previous messages in this chatroom. Start the conversation!', roomName);
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
    if (url.startsWith('www')) url = 'https://' + url;
    return `<a href="${url}" target="_blank" rel="noopener noreferrer">${url}</a>`;
  });
}

function escapeHtml(unsafe) {
  return unsafe.replace(/[&<>"']/g, (match) => {
    const escapeChars = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' };
    return escapeChars[match];
  });
}

async function bcMessage(room) {
  const messageInput = document.getElementById('messageInput');
  const content = messageInput.value.trim();
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

  document.addEventListener('copy', (e) => {
    const selection = document.getSelection();
    if (selection && selection.anchorNode) {
      const element = selection.anchorNode.closest('img, video, audio, iframe, source');
      if (element && element.dataset.realUrl) {
        e.preventDefault();
        e.clipboardData.setData('text/plain', element.dataset.realUrl);
        console.log('Copied real URL to clipboard:', element.dataset.realUrl);
      }
    }
  });
});
