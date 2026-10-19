/**
 * ChatLustora Real-Time Room WebSocket Server (Local Dev / Express Engine)
 * 
 * Mirrors Cloudflare Worker RoomDO native WebSocket contract:
 * - Direct native WebSocket connection on /api/rooms/:roomId/ws
 * - Strict 23 canonical room directory validation
 * - Authentication validation via cookies/tokens before upgrade
 * - Complete room isolation (messages and presence stay strictly within their room)
 * - Parameterized persistence to authoritative message store
 * - 500ms rate limiting & max 500 character payload limits
 * - Real-time presence counts and typing indicators
 */

import http from 'http';
import { WebSocketServer, WebSocket as NodeWebSocket } from 'ws';
import { dbStore } from './db.js';
import { resolveSessionFromToken, SESSION_COOKIE_NAME } from './session.js';
import { getRoomById } from '../shared/rooms.js';
import { ChatMessage, UserRole } from '../shared/types.js';

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

interface ClientMeta {
  roomId: string;
  userId: string;
  nickname: string;
  role: UserRole;
  avatarSeed: string;
  lastMessageTime: number;
}

export function setupRoomWebSocket(server: http.Server) {
  const wss = new WebSocketServer({ noServer: true });

  // Map of roomId -> Set of connected WebSockets
  const roomSockets = new Map<string, Set<NodeWebSocket>>();
  // Map of WebSocket -> ClientMeta
  const clientMeta = new Map<NodeWebSocket, ClientMeta>();

  function broadcastToRoom(roomId: string, message: string, excludeWs?: NodeWebSocket) {
    const clients = roomSockets.get(roomId);
    if (!clients) return;

    for (const client of clients) {
      if (client === excludeWs) continue;
      if (client.readyState === NodeWebSocket.OPEN) {
        try {
          client.send(message);
        } catch {
          // Handled on close
        }
      }
    }
  }

  function broadcastPresence(roomId: string) {
    const clients = roomSockets.get(roomId);
    if (!clients) return;

    const userMap = new Map<string, { userId: string; nickname: string; role: string }>();
    for (const ws of clients) {
      const meta = clientMeta.get(ws);
      if (meta) {
        userMap.set(meta.userId, {
          userId: meta.userId,
          nickname: meta.nickname,
          role: meta.role
        });
      }
    }

    const payload = JSON.stringify({
      type: 'presence',
      roomId,
      count: clients.size,
      users: Array.from(userMap.values())
    });

    broadcastToRoom(roomId, payload);
  }

  // Handle HTTP upgrade for /api/rooms/:roomId/ws
  server.on('upgrade', (request, socket, head) => {
    const url = new URL(request.url || '', `http://${request.headers.host || 'localhost'}`);
    const match = url.pathname.match(/^\/api\/rooms\/([^/]+)\/ws$/);

    if (!match) {
      // Allow other upgrade handlers (e.g. Socket.IO) to process their own routes
      return;
    }

    const rawRoomId = match[1];
    const room = getRoomById(rawRoomId);

    if (!room) {
      socket.write('HTTP/1.1 404 Not Found\r\nContent-Type: application/json\r\n\r\n{"error":"Room not found in canonical directory"}');
      socket.destroy();
      return;
    }

    // Authenticate session from Cookie header or query token
    const cookieHeader = request.headers.cookie || '';
    let token = url.searchParams.get('token') || '';

    if (!token) {
      const cookies = cookieHeader.split(';').reduce((acc: Record<string, string>, part) => {
        const [k, v] = part.trim().split('=');
        if (k && v) acc[k] = decodeURIComponent(v);
        return acc;
      }, {});

      token = cookies[SESSION_COOKIE_NAME] || cookies['session_id'] || '';
    }

    const session = resolveSessionFromToken(token);
    if (!session) {
      socket.write('HTTP/1.1 401 Unauthorized\r\nContent-Type: application/json\r\n\r\n{"error":"Unauthorized: valid adult session required"}');
      socket.destroy();
      return;
    }

    // Upgrade connection
    wss.handleUpgrade(request, socket, head, (ws) => {
      wss.emit('connection', ws, request, {
        roomId: room.id,
        session
      });
    });
  });

  // Client connected to Room
  wss.on('connection', (ws: NodeWebSocket, _req: http.IncomingMessage, extra: any) => {
    const { roomId, session } = extra;

    if (!roomSockets.has(roomId)) {
      roomSockets.set(roomId, new Set());
    }
    roomSockets.get(roomId)!.add(ws);

    const meta: ClientMeta = {
      roomId,
      userId: session.userId,
      nickname: session.nickname,
      role: session.role || 'guest',
      avatarSeed: session.avatarSeed || session.userId,
      lastMessageTime: 0
    };
    clientMeta.set(ws, meta);

    // Send recent room history immediately upon connection
    const history = dbStore.getRoomMessages(roomId, 50);
    ws.send(JSON.stringify({
      type: 'history',
      roomId,
      messages: history
    }));

    // Broadcast updated presence to room
    broadcastPresence(roomId);

    // Message handler
    ws.on('message', (rawData) => {
      try {
        const currentMeta = clientMeta.get(ws);
        if (!currentMeta) return;

        let data: any;
        try {
          data = JSON.parse(rawData.toString());
        } catch {
          ws.send(JSON.stringify({ type: 'error', error: 'Invalid JSON payload' }));
          return;
        }

        // Heartbeat ping
        if (data.type === 'ping') {
          ws.send(JSON.stringify({ type: 'pong' }));
          return;
        }

        // Typing indicator
        if (data.type === 'typing') {
          const isTyping = Boolean(data.isTyping);
          broadcastToRoom(roomId, JSON.stringify({
            type: 'typing',
            roomId,
            userId: currentMeta.userId,
            nickname: currentMeta.nickname,
            isTyping
          }), ws);
          return;
        }

        // Text Message
        if (data.type === 'message') {
          if (typeof data.text !== 'string') {
            ws.send(JSON.stringify({ type: 'error', error: 'Invalid message payload' }));
            return;
          }

          const rawText = data.text.trim();
          if (!rawText) {
            ws.send(JSON.stringify({ type: 'error', error: 'Message cannot be empty' }));
            return;
          }

          const now = Date.now();

          // Rate limiting: 1 message per 500ms
          if (now - currentMeta.lastMessageTime < 500) {
            ws.send(JSON.stringify({ type: 'error', error: 'Rate limit exceeded' }));
            return;
          }
          currentMeta.lastMessageTime = now;

          // Message length limit (500 chars) & HTML entity escaping
          const cleanText = escapeHtml(rawText.substring(0, 500));
          const msgId = `msg-${now}-${Math.random().toString(36).substring(2, 9)}`;

          const message: ChatMessage = {
            id: msgId,
            roomId,
            senderId: currentMeta.userId,
            senderNickname: currentMeta.nickname,
            senderRole: currentMeta.role,
            senderAvatarSeed: currentMeta.avatarSeed,
            senderGender: session.gender || 'prefer-not-to-say',
            senderIsGenderVisible: session.isGenderVisible ?? true,
            text: cleanText,
            timestamp: now
          };

          // Authoritative persistence in store
          dbStore.addRoomMessage(message);

          // Delivery confirmation broadcast to all subscribers in this room
          broadcastToRoom(roomId, JSON.stringify({
            type: 'message',
            ...message
          }));
        }
      } catch (err) {
        console.error('[RoomWS] Error processing message:', err);
        try {
          ws.send(JSON.stringify({ type: 'error', error: 'Internal server error' }));
        } catch {}
      }
    });

    const cleanup = () => {
      clientMeta.delete(ws);
      const clients = roomSockets.get(roomId);
      if (clients) {
        clients.delete(ws);
        if (clients.size === 0) {
          roomSockets.delete(roomId);
        } else {
          broadcastPresence(roomId);
        }
      }
    };

    ws.on('close', cleanup);
    ws.on('error', cleanup);
  });

  return {
    getConnectedCount: (roomId: string) => roomSockets.get(roomId)?.size || 0,
    broadcastToRoom
  };
}
