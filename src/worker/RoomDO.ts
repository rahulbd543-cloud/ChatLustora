export class RoomDO {
  state: DurableObjectState;
  env: { DB: D1Database };
  sessions: Map<WebSocket, { lastMessageTime: number; userId: string }> = new Map();

  constructor(state: DurableObjectState, env: { DB: D1Database }) {
    this.state = state;
    this.env = env;
  }

  async fetch(request: Request) {
    const webSocketPair = new WebSocketPair();
    const [client, server] = Object.values(webSocketPair);

    // Authentication validation passed by Hono worker
    const userId = request.headers.get('x-user-id');
    if (!userId) {
      return new Response('Unauthorized', { status: 401 });
    }
    
    server.accept();
    this.sessions.set(server, { lastMessageTime: 0, userId });
    
    server.addEventListener('message', async (event) => {
      try {
        const session = this.sessions.get(server);
        if (!session) return;

        // Rate limiting (1 message per 500ms)
        const now = Date.now();
        if (now - session.lastMessageTime < 500) {
          server.send(JSON.stringify({ type: 'error', error: 'Rate limit exceeded' }));
          return;
        }
        session.lastMessageTime = now;

        const data = JSON.parse(event.data as string);
        if (data.type === 'message' && typeof data.text === 'string' && data.text.length > 0) {
          const msg = {
            id: crypto.randomUUID(),
            roomId: this.state.id.toString(),
            senderId: session.userId,
            text: data.text.substring(0, 500),
            timestamp: now
          };
          
          await this.env.DB.prepare(
            'INSERT INTO messages (id, room_id, sender_id, text, timestamp) VALUES (?, ?, ?, ?, ?)'
          )
          .bind(msg.id, msg.roomId, msg.senderId, msg.text, msg.timestamp)
          .run();
          
          this.broadcast(JSON.stringify({ type: 'message', ...msg }));
        }
      } catch (e) {
        server.send(JSON.stringify({ type: 'error', error: 'Invalid payload' }));
      }
    });

    server.addEventListener('close', () => this.sessions.delete(server));

    return new Response(null, { status: 101, webSocket: client });
  }

  broadcast(message: string) {
    for (const [session] of this.sessions) {
      try {
        session.send(message);
      } catch {
        this.sessions.delete(session);
      }
    }
  }
}
