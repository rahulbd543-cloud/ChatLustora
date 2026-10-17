/**
 * ChatLustora RoomDurableObject
 * 
 * Manages authoritative real-time WebSocket connections, room membership,
 * message broadcasting, presence tracking, and signaling per room.
 */

export class RoomDurableObject {
  constructor(state, env) {
    this.state = state;
    this.env = env;
    this.sessions = new Set(); // { socket, userId, nickname, role, joinedAt }
  }

  async fetch(request) {
    const url = new URL(request.url);
    if (url.pathname === '/websocket') {
      const upgradeHeader = request.headers.get('Upgrade');
      if (upgradeHeader !== 'websocket') {
        return new Response('Expected Upgrade: websocket', { status: 426 });
      }

      const pair = new WebSocketPair();
      const [client, server] = Object.values(pair);

      const userId = request.headers.get('X-User-Id') || 'guest-' + Math.random().toString(36).substr(2, 6);
      const nickname = decodeURIComponent(request.headers.get('X-Nickname') || 'Anonymous');
      const role = request.headers.get('X-Role') || 'guest';

      this.handleSession(server, { userId, nickname, role });

      return new Response(null, {
        status: 101,
        webSocket: client,
      });
    }

    return new Response('Not found', { status: 404 });
  }

  handleSession(socket, userInfo) {
    socket.accept();
    const session = { socket, ...userInfo, joinedAt: Date.now() };
    this.sessions.add(session);

    // Broadcast presence update
    this.broadcastPresence();

    // Send welcome confirmation
    socket.send(JSON.stringify({
      type: 'connection.ready',
      userId: userInfo.userId,
      nickname: userInfo.nickname,
      timestamp: Date.now()
    }));

    socket.addEventListener('message', async (event) => {
      try {
        const data = JSON.parse(event.data);
        await this.handleMessage(session, data);
      } catch (err) {
        socket.send(JSON.stringify({ type: 'error', message: 'Invalid JSON payload' }));
      }
    });

    socket.addEventListener('close', () => {
      this.sessions.delete(session);
      this.broadcastPresence();
    });

    socket.addEventListener('error', () => {
      this.sessions.delete(session);
      this.broadcastPresence();
    });
  }

  async handleMessage(session, data) {
    const { type, text, roomId, targetId, signal } = data;

    switch (type) {
      case 'message.send': {
        if (!text || typeof text !== 'string') return;
        const cleanText = text.trim().slice(0, 1000);
        if (!cleanText) return;

        const message = {
          id: `msg-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
          roomId: roomId || 'general',
          senderId: session.userId,
          senderNickname: session.nickname,
          senderRole: session.role,
          text: cleanText,
          timestamp: Date.now()
        };

        // Broadcast to all connected clients in this Durable Object room
        this.broadcast({
          type: 'message.new',
          message
        });
        break;
      }

      case 'typing.start':
      case 'typing.stop': {
        this.broadcast({
          type: 'typing.update',
          userId: session.userId,
          nickname: session.nickname,
          isTyping: type === 'typing.start'
        }, session.socket);
        break;
      }

      case 'ping': {
        session.socket.send(JSON.stringify({ type: 'pong', timestamp: Date.now() }));
        break;
      }

      default:
        session.socket.send(JSON.stringify({ type: 'error', message: `Unknown event type: ${type}` }));
    }
  }

  broadcast(payload, excludeSocket = null) {
    const messageStr = JSON.stringify(payload);
    for (const session of this.sessions) {
      if (session.socket !== excludeSocket) {
        try {
          session.socket.send(messageStr);
        } catch (e) {
          this.sessions.delete(session);
        }
      }
    }
  }

  broadcastPresence() {
    const members = Array.from(this.sessions).map(s => ({
      userId: s.userId,
      nickname: s.nickname,
      role: s.role,
      joinedAt: s.joinedAt
    }));

    this.broadcast({
      type: 'room.presence',
      count: this.sessions.size,
      members
    });
  }
}
