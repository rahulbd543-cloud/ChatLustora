/**
 * ChatLustora Client Application
 * 
 * Handles authentication/guest session, room directory, native WebSocket
 * connection to Cloudflare Durable Objects, message rendering, and presence.
 */

import { INITIAL_CHATROOMS } from '../shared/rooms.js';

let currentSession = null;
let currentRoom = null;
let ws = null;

// DOM Elements
const viewDirectory = document.getElementById('view-directory');
const viewChat = document.getElementById('view-chat');
const roomGrid = document.getElementById('room-grid');
const modalGuest = document.getElementById('modal-guest');
const guestForm = document.getElementById('guest-form');
const inputNickname = document.getElementById('input-nickname');
const checkAge = document.getElementById('check-age');
const checkTerms = document.getElementById('check-terms');
const navAuthArea = document.getElementById('nav-auth-area');
const messageContainer = document.getElementById('message-container');
const messageForm = document.getElementById('message-form');
const messageInput = document.getElementById('message-input');
const activeRoomTitle = document.getElementById('active-room-title');
const activeRoomDesc = document.getElementById('active-room-desc');
const roomPresenceCount = document.getElementById('room-presence-count');
const participantList = document.getElementById('participant-list');
const btnBackDirectory = document.getElementById('btn-back-directory');

// Initialize App
document.addEventListener('DOMContentLoaded', () => {
  // Load session from sessionStorage if present
  const savedSession = sessionStorage.getItem('chatlustora_session');
  if (savedSession) {
    try {
      currentSession = JSON.parse(savedSession);
      modalGuest.classList.add('hidden');
      updateNavAuth();
    } catch (e) {
      sessionStorage.removeItem('chatlustora_session');
    }
  }

  renderRooms();
  setupEventListeners();
});

function updateNavAuth() {
  if (currentSession) {
    navAuthArea.innerHTML = `
      <div class="flex items-center gap-3">
        <span class="text-xs font-semibold px-3 py-1.5 rounded-lg bg-orange-500/10 text-orange-400 border border-orange-500/20">
          👤 ${escapeHtml(currentSession.nickname)} (${currentSession.role})
        </span>
        <button id="btn-logout" class="text-xs px-3 py-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-gray-300">
          Logout
        </button>
      </div>
    `;
    document.getElementById('btn-logout').addEventListener('click', () => {
      sessionStorage.removeItem('chatlustora_session');
      currentSession = null;
      if (ws) ws.close();
      modalGuest.classList.remove('hidden');
      updateNavAuth();
    });
  } else {
    navAuthArea.innerHTML = `
      <button onclick="document.getElementById('modal-guest').classList.remove('hidden')" class="px-4 py-2 rounded-xl bg-orange-500 hover:bg-orange-600 font-bold text-black text-xs">
        Join Chat
      </button>
    `;
  }
}

function renderRooms() {
  roomGrid.innerHTML = INITIAL_CHATROOMS.map(room => `
    <div class="glass-panel p-5 rounded-2xl border border-white/10 hover:border-orange-500/50 transition flex flex-col justify-between space-y-4">
      <div class="space-y-2">
        <div class="flex items-center justify-between">
          <span class="text-xs font-bold uppercase tracking-wider px-2.5 py-1 rounded-md bg-white/5 text-orange-400">
            ${room.tag}
          </span>
          ${room.isAdult ? '<span class="text-[10px] px-2 py-0.5 rounded bg-rose-500/10 text-rose-400 font-semibold">18+ Adult</span>' : ''}
        </div>
        <h3 class="font-bold text-white text-lg">${escapeHtml(room.name)}</h3>
        <p class="text-xs text-gray-400 leading-relaxed">${escapeHtml(room.description)}</p>
      </div>
      <button onclick="window.joinRoom('${room.id}')" class="w-full py-2.5 rounded-xl bg-white/5 hover:bg-orange-500 hover:text-black font-bold text-xs text-white border border-white/10 transition">
        Join Room →
      </button>
    </div>
  `).join('');
}

window.joinRoom = async (roomId) => {
  if (!currentSession) {
    modalGuest.classList.remove('hidden');
    return;
  }

  const room = INITIAL_CHATROOMS.find(r => r.id === roomId);
  if (!room) return;

  currentRoom = room;
  activeRoomTitle.textContent = room.name;
  activeRoomDesc.textContent = room.description;

  viewDirectory.classList.add('hidden');
  viewChat.classList.remove('hidden');
  messageContainer.innerHTML = '';

  connectWebSocket(roomId);
};

btnBackDirectory.addEventListener('click', () => {
  if (ws) {
    ws.close();
    ws = null;
  }
  currentRoom = null;
  viewChat.classList.add('hidden');
  viewDirectory.classList.remove('hidden');
});

guestForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  const nickname = inputNickname.value.trim();
  const ageConfirmed = checkAge.checked;
  const termsAccepted = checkTerms.checked;

  if (!nickname || !ageConfirmed || !termsAccepted) return;

  try {
    const res = await fetch('/api/guest/session', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ nickname, ageConfirmed, termsAccepted })
    });

    const data = await res.json();
    if (res.ok && data.success) {
      currentSession = data.session;
      sessionStorage.setItem('chatlustora_session', JSON.stringify(currentSession));
      modalGuest.classList.add('hidden');
      updateNavAuth();
    } else {
      alert(data.error || 'Failed to create session');
    }
  } catch (err) {
    alert('Network error connecting to ChatLustora server.');
  }
});

function connectWebSocket(roomId) {
  const protocol = location.protocol === 'https:' ? 'wss:' : 'ws:';
  const wsUrl = `${protocol}//${location.host}/websocket/${roomId}`;

  ws = new WebSocket(wsUrl);

  ws.onopen = () => {
    appendSystemMessage('Connected to ChatLustora secure room channel.');
  };

  ws.onmessage = (event) => {
    try {
      const data = JSON.parse(event.data);
      handleSocketMessage(data);
    } catch (e) {
      console.error('Failed to parse WebSocket message:', e);
    }
  };

  ws.onclose = () => {
    appendSystemMessage('Disconnected from room channel. Reconnecting...');
    setTimeout(() => {
      if (currentRoom && currentRoom.id === roomId && !ws) {
        connectWebSocket(roomId);
      }
    }, 3000);
  };
}

function handleSocketMessage(data) {
  switch (data.type) {
    case 'connection.ready':
      break;
    case 'message.new':
      appendChatMessage(data.message);
      break;
    case 'room.presence':
      roomPresenceCount.textContent = `${data.count} online`;
      renderParticipants(data.members);
      break;
    case 'error':
      appendSystemMessage(`Error: ${data.message}`);
      break;
  }
}

messageForm.addEventListener('submit', (e) => {
  e.preventDefault();
  const text = messageInput.value.trim();
  if (!text || !ws || ws.readyState !== WebSocket.OPEN) return;

  ws.send(JSON.stringify({
    type: 'message.send',
    roomId: currentRoom.id,
    text
  }));

  messageInput.value = '';
});

function appendChatMessage(msg) {
  const isMe = currentSession && msg.senderId === currentSession.userId;
  const div = document.createElement('div');
  div.className = `flex flex-col ${isMe ? 'items-end' : 'items-start'}`;
  
  div.innerHTML = `
    <div class="flex items-center gap-2 mb-1">
      <span class="text-xs font-bold ${isMe ? 'text-orange-400' : 'text-gray-300'}">${escapeHtml(msg.senderNickname)}</span>
      <span class="text-[10px] text-gray-500">${new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
    </div>
    <div class="px-4 py-2.5 rounded-2xl max-w-[80%] text-sm ${isMe ? 'bg-orange-500 text-black font-medium' : 'bg-white/5 border border-white/10 text-gray-100'}">
      ${escapeHtml(msg.text)}
    </div>
  `;
  messageContainer.appendChild(div);
  messageContainer.scrollTop = messageContainer.scrollHeight;
}

function appendSystemMessage(text) {
  const div = document.createElement('div');
  div.className = 'text-center my-2';
  div.innerHTML = `<span class="px-3 py-1 rounded-full bg-white/5 text-[11px] text-gray-400 border border-white/10">${escapeHtml(text)}</span>`;
  messageContainer.appendChild(div);
  messageContainer.scrollTop = messageContainer.scrollHeight;
}

function renderParticipants(members) {
  participantList.innerHTML = members.map(m => `
    <div class="flex items-center gap-2 py-1 px-2 rounded-lg bg-white/5">
      <span class="w-2 h-2 rounded-full bg-emerald-500"></span>
      <span class="font-medium text-gray-200 truncate">${escapeHtml(m.nickname)}</span>
    </div>
  `).join('');
}

function escapeHtml(text) {
  const map = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#039;'
  };
  return text.replace(/[&<>"']/g, function(m) { return map[m]; });
}
