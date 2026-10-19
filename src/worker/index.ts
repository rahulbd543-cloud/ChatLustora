import { Hono } from 'hono';
import { hashPassword, verifyPassword } from './auth';
import { getRoomById } from '../../shared/rooms.js';

type Bindings = {
  DB: D1Database;
  ROOMS: DurableObjectNamespace;
  COORDINATOR: DurableObjectNamespace;
};

const app = new Hono<{ Bindings: Bindings }>();

app.get('/healthz', (c) => c.json({ status: 'ok' }));

app.get('/api/rooms', async (c) => {
  try {
    const { results } = await c.env.DB.prepare('SELECT * FROM rooms').all();
    return c.json({ rooms: results });
  } catch {
    return c.json({ rooms: [] });
  }
});

app.get('/api/rooms/:roomId/ws', async (c) => {
  const roomId = c.req.param('roomId');
  
  // Fast validation against canonical rooms
  const canonicalRoom = getRoomById(roomId);
  if (!canonicalRoom) {
    return c.json({ error: 'Room not found in canonical directory' }, 404);
  }

  // Validate room exists in D1
  const room = await c.env.DB.prepare('SELECT id FROM rooms WHERE id = ?').bind(canonicalRoom.id).first();
  if (!room) return c.json({ error: 'Room not found' }, 404);

  // Authenticate session from cookies
  const cookieHeader = c.req.header('cookie') || '';
  const sessionId = cookieHeader.split('session_id=')[1]?.split(';')[0]
    || cookieHeader.split('chatlustora_session=')[1]?.split(';')[0];
  if (!sessionId) return c.json({ error: 'Unauthorized' }, 401);

  const session = await c.env.DB.prepare('SELECT user_id FROM sessions WHERE id = ? AND expires_at > ?')
    .bind(sessionId, Date.now()).first();
  if (!session) return c.json({ error: 'Unauthorized' }, 401);

  // Retrieve user metadata (username & role)
  const user = await c.env.DB.prepare('SELECT username FROM users WHERE id = ?')
    .bind(session.user_id)
    .first();
  const nickname = (user?.username as string) || `User_${String(session.user_id).slice(-4)}`;

  // Upgrade and pass authenticated user metadata to RoomDO using proper Headers cloning
  const id = c.env.ROOMS.idFromName(canonicalRoom.id);
  const obj = c.env.ROOMS.get(id);
  const requestHeaders = new Headers(c.req.raw.headers);
  requestHeaders.set('x-user-id', session.user_id as string);
  requestHeaders.set('x-user-nickname', nickname);
  requestHeaders.set('x-user-role', 'member');
  requestHeaders.set('x-user-avatar', session.user_id as string);
  requestHeaders.set('x-room-id', canonicalRoom.id);

  const newRequest = new Request(c.req.raw, {
    headers: requestHeaders
  });
  return obj.fetch(newRequest);
});

app.get('/api/rooms/:roomId/messages', async (c) => {
  const roomId = c.req.param('roomId');
  const canonicalRoom = getRoomById(roomId);
  if (!canonicalRoom) {
    return c.json({ error: 'Room not found' }, 404);
  }

  const limitParam = Number(c.req.query('limit')) || 50;
  const limit = Math.max(1, Math.min(limitParam, 100));
  const beforeParam = c.req.query('before');

  try {
    let query = 'SELECT * FROM messages WHERE room_id = ?';
    const params: any[] = [canonicalRoom.id];

    if (beforeParam) {
      query += ' AND timestamp < ?';
      params.push(Number(beforeParam));
    }

    query += ' ORDER BY timestamp DESC LIMIT ?';
    params.push(limit);

    const { results } = await c.env.DB.prepare(query).bind(...params).all();
    const formatted = results.map((r: any) => ({
      id: r.id,
      roomId: r.room_id,
      senderId: r.sender_id,
      senderNickname: r.sender_nickname || 'User',
      senderRole: r.sender_role || 'member',
      senderAvatarSeed: r.sender_id || 'user-seed',
      senderGender: 'prefer-not-to-say',
      senderIsGenderVisible: true,
      text: r.text,
      timestamp: r.timestamp
    }));

    return c.json({ roomId: canonicalRoom.id, messages: formatted.reverse() });
  } catch (err) {
    console.error('Failed to load room messages:', err);
    return c.json({ roomId: canonicalRoom.id, messages: [] });
  }
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
  const requestHeaders = new Headers(c.req.raw.headers);
  requestHeaders.set('x-user-id', session.user_id as string);
  const newRequest = new Request(c.req.raw, {
    headers: requestHeaders
  });
  return obj.fetch(newRequest);
});

export function isValidCalendarDate(dateStr: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) return false;
  const [y, m, d] = dateStr.split('-').map(Number);
  const date = new Date(Date.UTC(y, m - 1, d));
  return (
    date.getUTCFullYear() === y &&
    date.getUTCMonth() === m - 1 &&
    date.getUTCDate() === d
  );
}

export function calculateAgeUTC(dobString: string): number {
  if (!isValidCalendarDate(dobString)) return -1;
  const [y, m, d] = dobString.split('-').map(Number);
  const today = new Date();
  const todayUTC = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate()));
  const dob = new Date(Date.UTC(y, m - 1, d));

  if (dob > todayUTC) return -1;

  let age = todayUTC.getUTCFullYear() - y;
  const monthDiff = todayUTC.getUTCMonth() - (m - 1);
  const dayDiff = todayUTC.getUTCDate() - d;

  if (monthDiff < 0 || (monthDiff === 0 && dayDiff < 0)) {
    age--;
  }
  return age;
}

app.post('/api/auth/register', async (c) => {
  let body: any;
  try {
    body = await c.req.json();
  } catch {
    return c.json({ error: 'Malformed JSON payload' }, 400);
  }

  const { username, email, password, dateOfBirth } = body || {};
  if (!username || !email || !password || !dateOfBirth) {
    return c.json({ error: 'Missing required fields including date of birth' }, 400);
  }

  if (!isValidCalendarDate(dateOfBirth)) {
    return c.json({ error: 'Invalid date of birth format or impossible calendar date' }, 400);
  }

  const age = calculateAgeUTC(dateOfBirth);
  if (age < 0) {
    return c.json({ error: 'Future date of birth is not allowed' }, 400);
  }
  if (age < 18) {
    return c.json({ error: 'Access denied. You must be at least 18 years old to register.' }, 403);
  }

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
  const cookieHeader = c.req.header('cookie') || '';

  const sessionId = cookieHeader
    .split(';')
    .map((part) => part.trim())
    .find((part) => part.startsWith('session_id='))
    ?.slice('session_id='.length);

  if (!sessionId) {
    return c.json({ error: 'Unauthorized' }, 401);
  }

  const session = await c.env.DB
    .prepare('SELECT user_id FROM sessions WHERE id = ? AND expires_at > ?')
    .bind(sessionId, Date.now())
    .first<{ user_id: string }>();

  if (!session) {
    return c.json({ error: 'Unauthorized' }, 401);
  }

  const user = await c.env.DB
    .prepare('SELECT id, username, email FROM users WHERE id = ?')
    .bind(session.user_id)
    .first();

  if (!user) {
    return c.json({ error: 'Unauthorized' }, 401);
  }

  return c.json(user);
});


export { RoomDO } from './RoomDO';
export { CoordinatorDO } from './CoordinatorDO';
export default app;
