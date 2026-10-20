/**
 * ChatLustora RoomDO — Stateful Durable Object for Real-Time Room Chat
 * 
 * Guarantees:
 * - Complete isolation of real-time state per room ID.
 * - Authenticated session validation passed by Cloudflare Worker.
 * - Parameterized D1 message persistence before delivery confirmation.
 * - Rate limiting (max 1 message per 500ms per user).
 * - Max 500 character payload sanitization & HTML entity escaping.
 * - Real-time room presence tracking & typing indicators.
 * - Resilient error handling (DB failures do not crash the DO).
 */

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

interface RoomSession {
  userId: string;
  nickname: string;
  role: string;
  avatarSeed: string;
  lastMessageTime: number;
}

export class RoomDO {
  state: DurableObjectState;
  env: {
    DB: D1Database;
    INTERNAL_MODERATION_SECRET: string;
  };
  sessions: Map<WebSocket, RoomSession> = new Map();

  constructor(
    state: DurableObjectState,
    env: {
      DB: D1Database;
      INTERNAL_MODERATION_SECRET: string;
    }
  ) {
    this.state = state;
    this.env = env;
  }

  async fetch(request: Request): Promise<Response> {
    const expectedSecret = this.env.INTERNAL_MODERATION_SECRET;
    const suppliedSecret = request.headers.get('x-internal-secret');

    if (
      !expectedSecret ||
      !suppliedSecret ||
      suppliedSecret !== expectedSecret
    ) {
      return new Response(
        JSON.stringify({ error: 'Forbidden' }),
        {
          status: 403,
          headers: { 'Content-Type': 'application/json' }
        }
      );
    }
// Authentication headers forwarded by Hono Worker
    const userId = request.headers.get('x-user-id');
    if (!userId) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    const nickname = request.headers.get('x-user-nickname') || 'Guest';
    const role = request.headers.get('x-user-role') || 'guest';
    const avatarSeed = request.headers.get('x-user-avatar') || userId;
    const roomId = request.headers.get('x-room-id') || this.state.id.toString();

    const webSocketPair = new WebSocketPair();
    const [client, server] = Object.values(webSocketPair);

    server.accept();

    const sessionData: RoomSession = {
      userId,
      nickname,
      role,
      avatarSeed,
      lastMessageTime: 0
    };

    this.sessions.set(server, sessionData);

    // Broadcast updated presence to room
    this.broadcastPresence(roomId);

    server.addEventListener('message', async (event: any) => {
      try {
        const session = this.sessions.get(server);
        if (!session) return;

        let data: any;
        try {
          data = JSON.parse(event.data as string);
        } catch {
          server.send(JSON.stringify({ type: 'error', error: 'Invalid JSON payload' }));
          return;
        }

        // Heartbeat ping
        if (data.type === 'ping') {
          server.send(JSON.stringify({ type: 'pong' }));
          return;
        }

        // Typing indicator
        if (data.type === 'typing') {
          const isTyping = Boolean(data.isTyping);
          this.broadcastExcept(server, JSON.stringify({
            type: 'typing',
            roomId,
            userId: session.userId,
            nickname: session.nickname,
            isTyping
          }));
          return;
        }

        // Chat message
        if (data.type === 'message') {
          if (typeof data.text !== 'string') {
            server.send(JSON.stringify({ type: 'error', error: 'Invalid message payload' }));
            return;
          }
 const now = Date.now();
          const rawText = data.text.trim();
          if (!rawText) {
            server.send(JSON.stringify({ type: 'error', error: 'Message cannot be empty' }));
            return;
          }
          // Enforce active room bans for already-connected users.
          // Administrators retain the same bypass as the connection guard.
          if (session.role !== 'admin') {
            try {
              const activeBan = await this.env.DB
                .prepare(`
                  SELECT id
                  FROM room_bans
                  WHERE room_id = ?
                    AND user_id = ?
                    AND (expires_at IS NULL OR expires_at > ?)
                  LIMIT 1
                `)
                .bind(roomId, session.userId, Date.now())
                .first<{ id: string }>();

              if (activeBan) {
                try {
                  server.send(JSON.stringify({
                    type: 'error',
                    error: 'You are banned from this room.'
                  }));
                } finally {
                  server.close(1008, 'Banned from this room');
                }
                return;
              }
            } catch (error) {
              console.error('[RoomDO] Ban status check failed:', error);

              try {
                server.send(JSON.stringify({
                  type: 'error',
                  error: 'Unable to verify room access. Please reconnect later.'
                }));
              } finally {
                server.close(1011, 'Unable to verify room access');
              }
              return;
            }
          }


          // Enforce active room mute before accepting a message.
try {
  const activeMute = await this.env.DB
    .prepare(`
      SELECT id, expires_at
      FROM room_mutes
      WHERE room_id = ?
        AND user_id = ?
        AND expires_at > ?
      LIMIT 1
    `)
    .bind(roomId, session.userId, Date.now())
    .first<{ id: string; expires_at: number }>();

  if (activeMute) {
    server.send(JSON.stringify({
      type: 'error',
      error: 'You are muted in this room.',
      muteUntil: activeMute.expires_at
    }));
    return;
  }
} catch (error) {
  console.error('[RoomDO] Mute status check failed:', error);

  // Fail closed: do not accept messages when mute status is unknown.
  server.send(JSON.stringify({
    type: 'error',
    error: 'Unable to verify mute status. Please try again.'
  }));
  return;
}
          // Rate limiting: 1 message per 500ms
          if (now - session.lastMessageTime < 500) {
            server.send(JSON.stringify({
              type: 'error',
              error: 'Rate limit exceeded'
            }));
            return;
          }

          session.lastMessageTime = now;
          // Message length limit (500 chars) & HTML entity escaping
          const cleanText = escapeHtml(rawText.substring(0, 500));
          const msgId = crypto.randomUUID();

          const message = {
            id: msgId,
            roomId,
            senderId: session.userId,
            senderNickname: session.nickname,
            senderRole: session.role,
            senderAvatarSeed: session.avatarSeed,
            senderGender: 'prefer-not-to-say',
            senderIsGenderVisible: true,
            text: cleanText,
            timestamp: now
          };

          // Persist to D1 using parameterized SQL before broadcasting
          try {
            await this.env.DB.prepare(
              'INSERT INTO messages (id, room_id, sender_id, sender_nickname, sender_role, text, timestamp) VALUES (?, ?, ?, ?, ?, ?, ?)'
            )
            .bind(message.id, message.roomId, message.senderId, message.senderNickname, message.senderRole, message.text, message.timestamp)
            .run();
          } catch (dbErr) {
            // Fallback for older schemas without sender_nickname/sender_role columns
            try {
              await this.env.DB.prepare(
                'INSERT INTO messages (id, room_id, sender_id, text, timestamp) VALUES (?, ?, ?, ?, ?)'
              )
              .bind(message.id, message.roomId, message.senderId, message.text, message.timestamp)
              .run();
            } catch (fallbackErr) {
              console.error('[RoomDO] D1 Database persistence failure:', fallbackErr);
              server.send(JSON.stringify({ type: 'error', error: 'Failed to persist message' }));
              return; // Do NOT broadcast failed message
            }
          }

          // Authoritative delivery confirmation & broadcast to all room subscribers
          this.broadcast(JSON.stringify({ type: 'message', ...message }));
        }
      } catch (err) {
        console.error('[RoomDO] Unexpected error processing message:', err);
        try {
          server.send(JSON.stringify({ type: 'error', error: 'Internal server error' }));
        } catch {}
      }
    });

    const cleanup = () => {
      this.sessions.delete(server);
      this.broadcastPresence(roomId);
    };

    server.addEventListener('close', cleanup);
    server.addEventListener('error', cleanup);

    return new Response(null, { status: 101, webSocket: client });
  }

  broadcast(message: string) {
    for (const [ws] of this.sessions) {
      try {
        ws.send(message);
      } catch {
        this.sessions.delete(ws);
      }
    }
  }

  broadcastExcept(excludeWs: WebSocket, message: string) {
    for (const [ws] of this.sessions) {
      if (ws === excludeWs) continue;
      try {
        ws.send(message);
      } catch {
        this.sessions.delete(ws);
      }
    }
  }

  broadcastPresence(roomId: string) {
    const userMap = new Map<string, { userId: string; nickname: string; role: string }>();
    for (const session of this.sessions.values()) {
      userMap.set(session.userId, {
        userId: session.userId,
        nickname: session.nickname,
        role: session.role
      });
    }

    const payload = JSON.stringify({
      type: 'presence',
      roomId,
      count: this.sessions.size,
      users: Array.from(userMap.values())
    });

    this.broadcast(payload);
  }
}
