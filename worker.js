/**
 * ChatLustora Cloudflare Worker Entry Point
 * 
 * Handles HTTP API routes (auth, guest sessions, rooms, health) and
 * upgrades WebSocket connections to the RoomDurableObject.
 */

import { Hono } from 'hono';
import { INITIAL_CHATROOMS } from './shared/rooms.js';

const app = new Hono();

// CORS middleware
app.use('*', async (c, next) => {
  c.header('Access-Control-Allow-Origin', '*');
  c.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  c.header('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-User-Id, X-Nickname, X-Role');
  if (c.req.method === 'OPTIONS') {
    return c.text('', 204);
  }
  await next();
});

// Health check
app.get('/api/health', (c) => {
  return c.json({
    status: 'ok',
    brand: 'ChatLustora',
    tagline: 'Flirt Freely. Connect Deeply.',
    timestamp: Date.now()
  });
});

// Rooms directory
app.get('/api/rooms', (c) => {
  return c.json({
    rooms: INITIAL_CHATROOMS
  });
});

// Guest session creation
app.post('/api/guest/session', async (c) => {
  try {
    const body = await c.req.json();
    const { nickname, ageConfirmed, termsAccepted, gender, dob } = body;

    if (!nickname || typeof nickname !== 'string' || nickname.trim().length < 2) {
      return c.json({ error: 'Nickname must be at least 2 characters long.' }, 400);
    }

    if (!ageConfirmed || !termsAccepted) {
      return c.json({ error: 'You must confirm you are 18+ and accept terms of service.' }, 400);
    }

    const cleanNickname = nickname.trim().slice(0, 24);
    const userId = `guest-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`;
    const token = `token-${Math.random().toString(36).substr(2, 16)}`;

    // If D1 is bound, optionally persist session
    if (c.env.DB) {
      try {
        await c.env.DB.prepare(
          `INSERT INTO guest_sessions (token, user_id, nickname, created_at, expires_at) VALUES (?, ?, ?, ?, ?)`
        ).bind(token, userId, cleanNickname, Date.now(), Date.now() + 86400000).run();
      } catch (dbErr) {
        // Fallback if table not yet migrated
      }
    }

    return c.json({
      success: true,
      session: {
        userId,
        nickname: cleanNickname,
        token,
        role: 'guest',
        gender: gender || 'prefer-not-to-say'
      }
    });
  } catch (err) {
    return c.json({ error: 'Invalid request body' }, 400);
  }
});

// WebSocket upgrade routing to Durable Object
app.all('/websocket/:roomId', async (c) => {
  const roomId = c.req.param('roomId') || 'bangla-chat';
  const userId = c.req.header('X-User-Id') || c.req.query('userId') || 'guest-anon';
  const nickname = c.req.header('X-Nickname') || c.req.query('nickname') || 'Anonymous';
  const role = c.req.header('X-Role') || c.req.query('role') || 'guest';

  // Get Durable Object stub based on roomId
  const id = c.env.ROOM_DO.idFromName(roomId);
  const stub = c.env.ROOM_DO.get(id);

  // Forward request to Durable Object
  const newHeaders = new Headers(c.req.raw.headers);
  newHeaders.set('X-User-Id', userId);
  newHeaders.set('X-Nickname', encodeURIComponent(nickname));
  newHeaders.set('X-Role', role);

  const doRequest = new Request(c.req.url.replace('/websocket', '/websocket'), {
    method: c.req.method,
    headers: newHeaders,
    body: c.req.raw.body
  });

  return stub.fetch(doRequest);
});

export default {
  async fetch(request, env, ctx) {
    return app.fetch(request, env, ctx);
  }
};

// Export Durable Object class
export { RoomDurableObject } from './room-chat.js';
