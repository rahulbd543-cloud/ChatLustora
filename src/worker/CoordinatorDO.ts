export class CoordinatorDO {
  state: DurableObjectState;
  sessions: Map<string, WebSocket> = new Map(); // userId -> WebSocket

  constructor(state: DurableObjectState) {
    this.state = state;
  }

  async fetch(request: Request) {
    const userId = request.headers.get('x-user-id');
    if (!userId) return new Response('Unauthorized', { status: 401 });

    const webSocketPair = new WebSocketPair();
    const [client, server] = Object.values(webSocketPair);
    server.accept();
    this.sessions.set(userId, server);

    server.addEventListener('message', async (event) => {
      try {
        const data = JSON.parse(event.data as string);
        if (data.type === 'join') {
          await this.handleJoin(userId, server);
        } else if (data.type === 'skip') {
          await this.handleSkip(userId);
        } else if (data.type === 'signal') {
          await this.handleSignal(userId, data);
        }
      } catch (e) {}
    });

    server.addEventListener('close', async () => {
      this.sessions.delete(userId);
      await this.handleSkip(userId); // Handle disconnect as skip
    });

    return new Response(null, { status: 101, webSocket: client });
  }

  async handleJoin(userId: string, ws: WebSocket) {
    let queue: string[] = (await this.state.storage.get('queue')) || [];
    if (queue.includes(userId)) return;

    if (queue.length > 0) {
      const partnerId = queue.shift()!;
      await this.state.storage.put('queue', queue);
      
      const matchId = crypto.randomUUID();
      await this.state.storage.put(`match:${userId}`, { matchId, partnerId });
      await this.state.storage.put(`match:${partnerId}`, { matchId, partnerId: userId });
      
      ws.send(JSON.stringify({ type: 'matched', matchId, partnerId }));
      this.sessions.get(partnerId)?.send(JSON.stringify({ type: 'matched', matchId, partnerId: userId }));
    } else {
      queue.push(userId);
      await this.state.storage.put('queue', queue);
      ws.send(JSON.stringify({ type: 'queued' }));
    }
  }

  async handleSkip(userId: string) {
    const match = await this.state.storage.get<{ matchId: string, partnerId: string }>(`match:${userId}`);
    if (match) {
      await this.state.storage.delete(`match:${userId}`);
      await this.state.storage.delete(`match:${match.partnerId}`);
      
      this.sessions.get(userId)?.send(JSON.stringify({ type: 'left' }));
      this.sessions.get(match.partnerId)?.send(JSON.stringify({ type: 'left' }));
    }
  }

  async handleSignal(userId: string, data: any) {
    const match = await this.state.storage.get<{ matchId: string, partnerId: string }>(`match:${userId}`);
    if (!match) return;

    // Validate signal message structure
    if (!['offer', 'answer', 'ice-candidate'].includes(data.signalType)) return;

    // Forward signaling to partner
    this.sessions.get(match.partnerId)?.send(JSON.stringify({
      type: 'signal',
      signalType: data.signalType,
      payload: data.payload,
      senderId: userId
    }));
  }
}
