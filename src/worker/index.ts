import { Hono } from 'hono';
import { hashPassword, verifyPassword } from './auth';

type Bindings = {
  DB: D1Database;
  ROOMS: DurableObjectNamespace;
  COORDINATOR: DurableObjectNamespace;
};

const app = new Hono<{ Bindings: Bindings }>();

app.get('/healthz', (c) => c.json({ status: 'ok' }));

app.get('/api/rooms', async (c) => {
  const { results } = await c.env.DB.prepare('SELECT * FROM rooms').all();
  return c.json({ rooms: results });
});

app.get('/api/rooms/:roomId/ws', async (c) => {
  const roomId = c.req.param('roomId');
  
  // Validate room exists
  const room = await c.env.DB.prepare('SELECT id FROM rooms WHERE id = ?').bind(roomId).first();
  if (!room) return c.json({ error: 'Room not found' }, 404);

  // Authenticate session
  const sessionId = c.req.header('cookie')?.split('session_id=')[1]?.split(';')[0];
  if (!sessionId) return c.json({ error: 'Unauthorized' }, 401);
  const session = await c.env.DB.prepare('SELECT user_id FROM sessions WHERE id = ? AND expires_at > ?')
    .bind(sessionId, Date.now()).first();
  if (!session) return c.json({ error: 'Unauthorized' }, 401);

  // Upgrade and pass authenticated user ID to DO
  const id = c.env.ROOMS.idFromName(roomId);
  const obj = c.env.ROOMS.get(id);
  const newRequest = new Request(c.req.raw, {
    headers: { ...c.req.raw.headers, 'x-user-id': session.user_id as string }
  });
  return obj.fetch(newRequest);
});

app.get('/api/rooms/:roomId/messages', async (c) => {
  const roomId = c.req.param('roomId');
  const { results } = await c.env.DB.prepare('SELECT * FROM messages WHERE room_id = ? ORDER BY timestamp DESC LIMIT 50')
    .bind(roomId)
    .all();
  return c.json({ messages: results.reverse() });
});

app.get('/api/roulette/ws', async (c) => {
  // Authenticate session
  const sessionId = c.req.header('cookie')?.split('session_id=')[1]?.split(';')[0];
  if (!sessionId) return c.json({ error: 'Unauthorized' }, 401);
  const session = await c.env.DB.prepare('SELECT user_id FROM sessions WHERE id = ? AND expires_at > ?')
    .bind(sessionId, Date.now()).first();
  if (!session) return c.json({ error: 'Unauthorized' }, 401);

  // Upgrade and pass authenticated user ID to DO
  const id = c.env.COORDINATOR.idFromName('global');
  const obj = c.env.COORDINATOR.get(id);
  const newRequest = new Request(c.req.raw, {
    headers: { ...c.req.raw.headers, 'x-user-id': session.user_id as string }
  });
  return obj.fetch(newRequest);
});

app.post('/api/auth/register', async (c) => {
  const { username, email, password } = await c.req.json();
  if (!username || !email || !password) return c.json({ error: 'Missing fields' }, 400);

  const hash = await hashPassword(password);
  try {
    await c.env.DB.prepare('INSERT INTO users (id, username, email, password_hash, created_at) VALUES (?, ?, ?, ?, ?)')
      .bind(crypto.randomUUID(), username, email, hash, Date.now())
      .run();
    return c.json({ success: true });
  } catch {
    return c.json({ error: 'Registration failed' }, 400);
  }
});

app.post('/api/auth/login', async (c) => {
  const { email, password } = await c.req.json();
  const user = await c.env.DB.prepare('SELECT * FROM users WHERE email = ?').bind(email).first();
  if (!user || !(await verifyPassword(password, user.password_hash as string))) {
    return c.json({ error: 'Invalid credentials' }, 401);
  }
  
  const sessionId = crypto.randomUUID();
  await c.env.DB.prepare('INSERT INTO sessions (id, user_id, expires_at) VALUES (?, ?, ?)')
    .bind(sessionId, user.id, Date.now() + 86400000)
    .run();
    
  return c.json({ success: true }, 200, {
    'Set-Cookie': `session_id=${sessionId}; HttpOnly; Secure; SameSite=Strict; Max-Age=86400`
  });
});

app.post('/api/auth/logout', async (c) => {
  const sessionId = c.req.header('cookie')?.split('session_id=')[1]?.split(';')[0];
  if (sessionId) await c.env.DB.prepare('DELETE FROM sessions WHERE id = ?').bind(sessionId).run();
  return c.json({ success: true }, 200, { 'Set-Cookie': 'session_id=; Max-Age=0' });
});

app.get('/api/auth/me', async (c) => {
  const sessionId = c.req.header('cookie')?.split('session_id=')[1]?.split(';')[0];
  if (!sessionId) return c.json({ error: 'Unauthorized' }, 401);
  const session = await c.env.DB.prepare('SELECT * FROM sessions WHERE id = ? AND expires_at > ?').bind(sessionId, Date.now()).first();
  if (!session) return c.json({ error: 'Unauthorized' }, 401);
  const user = await c.env.DB.prepare('SELECT id, username, email FROM users WHERE id = ?').bind(session.user_id).first();
  return c.json(user);
});

export default app;
