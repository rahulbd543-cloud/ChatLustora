import { Hono } from 'hono';
import { hashPassword, verifyPassword } from './auth';
import { getRoomById } from '../../shared/rooms.js';
import { registerDmRoutes } from './dm';

type Bindings = {
  DB: D1Database;
  ROOMS: DurableObjectNamespace;
  COORDINATOR: DurableObjectNamespace;
  INTERNAL_MODERATION_SECRET: string;
  TURN_URL?: string;
  TURN_USERNAME?: string;
  TURN_CREDENTIAL?: string;
};

export function extractSessionId(c: { req: { header: (name: string) => string | undefined } }): string | undefined {
  const authHeader = c.req.header('authorization');
  if (authHeader?.startsWith('Bearer ')) {
    const token = authHeader.slice(7).trim();
    if (token) return token;
  }

  const cookieHeader = c.req.header('cookie') || '';
  const parts = cookieHeader.split(';').map((p) => p.trim());
  for (const part of parts) {
    if (part.startsWith('session_id=')) {
      return part.slice('session_id='.length);
    }
    if (part.startsWith('chatlustora_session=')) {
      return part.slice('chatlustora_session='.length);
    }
  }
  return undefined;
}

const app = new Hono<{ Bindings: Bindings }>();

registerDmRoutes(app);

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

  // Authenticate session from cookies or headers
  const sessionId = extractSessionId(c);
  if (!sessionId) return c.json({ error: 'Unauthorized' }, 401);

  const session = await c.env.DB
    .prepare('SELECT user_id FROM sessions WHERE id = ? AND expires_at > ?')
    .bind(sessionId, Date.now())
    .first<{ user_id: string }>();

  if (!session) {
    return c.json({ error: 'Unauthorized' }, 401);
  }

  const user = await c.env.DB
    .prepare('SELECT id, username, email, role FROM users WHERE id = ?')
    .bind(session.user_id)
    .first<{ id: string; username: string; email?: string; role?: string }>();

  if (!user) {
    return c.json({ error: 'Unauthorized' }, 401);
  }

  const isGuest = user.email?.endsWith('@chatlustora.internal');
  const role = isGuest ? 'guest' : (user.role || 'member');
  const nickname = user.username || `User_${user.id.slice(-4)}`;

  // Enforce active room bans before allowing a WebSocket connection.
  if (role !== 'admin') {
    try {
      const activeBan = await c.env.DB
        .prepare(`
          SELECT id
          FROM room_bans
          WHERE room_id = ?
            AND user_id = ?
            AND (expires_at IS NULL OR expires_at > ?)
          LIMIT 1
        `)
        .bind(canonicalRoom.id, user.id, Date.now())
        .first<{ id: string }>();

      if (activeBan) {
        return c.json(
          { error: 'You are banned from this room.' },
          403
        );
      }
    } catch (error) {
      console.error('[Room Ban Check] Database error:', error);

      // Fail closed if the ban status cannot be verified.
      return c.json(
        { error: 'Unable to verify room access. Please try again later.' },
        503
      );
    }
  }

  // Upgrade and pass authenticated user metadata to RoomDO using proper Headers cloning
  const id = c.env.ROOMS.idFromName(canonicalRoom.id);
  const obj = c.env.ROOMS.get(id);
  const requestHeaders = new Headers(c.req.raw.headers);
  requestHeaders.set('x-internal-secret', c.env.INTERNAL_MODERATION_SECRET);
  requestHeaders.set('x-user-id', session.user_id as string);
  requestHeaders.set('x-user-nickname', nickname);
  requestHeaders.set('x-user-role', role);
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
  const sessionId = extractSessionId(c);
  if (!sessionId) return c.json({ error: 'Unauthorized' }, 401);
  const session = await c.env.DB.prepare('SELECT user_id FROM sessions WHERE id = ? AND expires_at > ?')
    .bind(sessionId, Date.now()).first();
  if (!session) return c.json({ error: 'Unauthorized' }, 401);

  // Upgrade and pass authenticated user ID to DO
  const id = c.env.COORDINATOR.idFromName('global');
  const obj = c.env.COORDINATOR.get(id);
  const requestHeaders = new Headers(c.req.raw.headers);
  requestHeaders.set('x-internal-secret', c.env.INTERNAL_MODERATION_SECRET);
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

const SUGGESTED_PREFIXES = [
  'Dhaka_Dreamer', 'Bengal_Tiger', 'Padma_Breeze', 'Kolkata_Rhythm',
  'Mystic_Desi', 'Night_Owl', 'Velvet_Soul', 'Chai_Lover',
  'Sylhet_Starlight', 'Chittagong_Vibe', 'Moonlight_BD', 'Desi_Flirt',
  'Secret_Smiles', 'Sunkissed_Bengali', 'Silent_Gaze', 'Urban_Lover'
];

export function generateSuggestedNickname(): string {
  const prefix = SUGGESTED_PREFIXES[Math.floor(Math.random() * SUGGESTED_PREFIXES.length)];
  const num = Math.floor(100 + Math.random() * 900);
  return `${prefix}_${num}`;
}

app.get('/api/webrtc/config', (c) => {
  const iceServers: Array<{ urls: string | string[]; username?: string; credential?: string }> = [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' }
  ];

  const env = c.env as any;
  if (env?.TURN_URL) {
    iceServers.push({
      urls: env.TURN_URL,
      username: env.TURN_USERNAME,
      credential: env.TURN_CREDENTIAL
    });
  }

  return c.json({ iceServers });
});

app.get('/api/auth/suggest-nickname', (c) => {
  return c.json({ nickname: generateSuggestedNickname() });
});

app.post('/api/auth/session', async (c) => {
  let body: any;
  try {
    body = await c.req.json();
  } catch {
    return c.json({ error: 'Malformed JSON payload' }, 400);
  }

  const { nickname, isAdultConfirmed, termsAccepted, gender, dateOfBirth, isGenderVisible } = body || {};

  if (!isAdultConfirmed) {
    return c.json({ error: 'You must confirm that you are at least 18 years of age to enter.' }, 400);
  }
  if (!termsAccepted) {
    return c.json({ error: 'You must accept the Terms of Service & Privacy Policy to enter.' }, 400);
  }

  const validGenders = ['male', 'female', 'non-binary', 'prefer-not-to-say'];
  const cleanGender = (gender || 'prefer-not-to-say').toLowerCase().trim();
  if (!validGenders.includes(cleanGender)) {
    return c.json({ error: 'Please select a valid gender option.' }, 400);
  }

  if (!dateOfBirth) {
    return c.json({ error: 'Date of birth is required for age verification.' }, 400);
  }
  if (!isValidCalendarDate(dateOfBirth)) {
    return c.json({ error: 'Invalid date of birth format or impossible calendar date' }, 400);
  }
  const age = calculateAgeUTC(dateOfBirth);
  if (age < 0) {
    return c.json({ error: 'Future date of birth is not allowed' }, 400);
  }
  if (age < 18) {
    return c.json({ error: 'Access denied. You must be at least 18 years old to enter.' }, 403);
  }

  const trimmed = (nickname || '').trim();
  if (!trimmed || trimmed.length < 3 || trimmed.length > 20) {
    return c.json({ error: 'Nickname must be between 3 and 20 characters.' }, 400);
  }

  const sessionId = crypto.randomUUID();
  const userId = `usr_${crypto.randomUUID().replace(/-/g, '').slice(0, 16)}`;
  const avatarSeed = `avatar-${Math.floor(Math.random() * 10000)}`;
  const expiresAt = Date.now() + 86400000 * 7; // 7 days

  // Insert guest user into users table so foreign keys and DO lookups succeed
  try {
    await c.env.DB.prepare(
      'INSERT INTO users (id, username, email, password_hash, created_at) VALUES (?, ?, ?, ?, ?)'
    ).bind(
      userId,
      `${trimmed.slice(0, 15)}_${userId.slice(-4)}`,
      `${userId}@chatlustora.internal`,
      'guest-session',
      Date.now()
    ).run();
  } catch (err) {
    console.warn('[Guest Session] User insert warning:', err);
  }

  // Insert into sessions table
  try {
    await c.env.DB.prepare(
      'INSERT INTO sessions (id, user_id, expires_at) VALUES (?, ?, ?)'
    ).bind(sessionId, userId, expiresAt).run();
  } catch (err) {
    console.error('[Guest Session] Session insert error:', err);
    return c.json({ error: 'Failed to create guest session in database' }, 500);
  }

  c.header('Set-Cookie', `session_id=${sessionId}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=${7 * 86400}`);
  c.header('Set-Cookie', `chatlustora_session=${sessionId}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=${7 * 86400}`, { append: true });

  return c.json({
    success: true,
    session: {
      userId,
      nickname: trimmed,
      role: 'guest',
      avatarSeed,
      gender: cleanGender,
      isGenderVisible: isGenderVisible !== undefined ? Boolean(isGenderVisible) : true,
      token: sessionId
    }
  }, 200);
});

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

  const trimmedUsername = (username || '').trim();
  if (trimmedUsername.length < 3 || trimmedUsername.length > 20) {
    return c.json({ error: 'Username must be between 3 and 20 characters.' }, 400);
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
    const userId = crypto.randomUUID();
    await c.env.DB.prepare('INSERT INTO users (id, username, email, password_hash, created_at) VALUES (?, ?, ?, ?, ?)')
      .bind(userId, trimmedUsername, email.trim().toLowerCase(), hash, Date.now())
      .run();
    return c.json({ success: true, userId });
  } catch (err: any) {
    const msg = err?.message || '';
    if (msg.includes('UNIQUE constraint failed: users.email')) {
      return c.json({ error: 'An account with this email already exists.' }, 409);
    }
    if (msg.includes('UNIQUE constraint failed: users.username')) {
      return c.json({ error: 'Username is already taken.' }, 409);
    }
    return c.json({ error: 'Registration failed' }, 400);
  }
});

app.post('/api/auth/login', async (c) => {
  let body: any;
  try {
    body = await c.req.json();
  } catch {
    return c.json({ error: 'Malformed JSON payload' }, 400);
  }
  const { email, password } = body || {};
  if (!email || !password) {
    return c.json({ error: 'Missing credentials' }, 400);
  }

  const user = await c.env.DB.prepare('SELECT * FROM users WHERE email = ?').bind(email.trim().toLowerCase()).first();
  if (!user || !(await verifyPassword(password, user.password_hash as string))) {
    return c.json({ error: 'Invalid credentials' }, 401);
  }
  
  const sessionId = crypto.randomUUID();
  await c.env.DB.prepare('INSERT INTO sessions (id, user_id, expires_at) VALUES (?, ?, ?)')
    .bind(sessionId, user.id, Date.now() + 86400000 * 7)
    .run();
    
  c.header('Set-Cookie', `session_id=${sessionId}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=${7 * 86400}`);
  c.header('Set-Cookie', `chatlustora_session=${sessionId}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=${7 * 86400}`, { append: true });

  return c.json({
    success: true,
    session: {
      userId: user.id,
      nickname: user.username,
      role: user.role || 'member',
      avatarSeed: user.id,
      token: sessionId
    }
  }, 200);
});

app.post('/api/auth/logout', async (c) => {
  const sessionId = extractSessionId(c);
  if (sessionId) {
    await c.env.DB.prepare('DELETE FROM sessions WHERE id = ?').bind(sessionId).run();
  }
  c.header('Set-Cookie', 'session_id=; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=0');
  c.header('Set-Cookie', 'chatlustora_session=; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=0', { append: true });
  return c.json({ success: true }, 200);
});

app.get('/api/auth/me', async (c) => {
  const sessionId = extractSessionId(c);

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
    .prepare('SELECT id, username, email, role FROM users WHERE id = ?')
    .bind(session.user_id)
    .first<{ id: string; username: string; email: string; role?: string }>();

  if (!user) {
    return c.json({ error: 'Unauthorized' }, 401);
  }

  const isGuest = user.email?.endsWith('@chatlustora.internal');
  const role = isGuest ? 'guest' : (user.role || 'member');

  return c.json({
    id: user.id,
    userId: user.id,
    username: user.username,
    nickname: user.username,
    email: isGuest ? '' : user.email,
    role,
    avatarSeed: user.id,
    token: sessionId
  });
});

/**
 * Moderation read-only APIs.
 * Authentication and role are always resolved from the D1 session,
 * never from localStorage or client-provided role/token values.
 */
async function resolveModerationActor(c: { req: { header: (name: string) => string | undefined }; env: Bindings }) {
  const sessionId = extractSessionId(c);

  if (!sessionId) {
    return { error: 'Unauthorized', status: 401 as const };
  }

  const session = await c.env.DB
    .prepare('SELECT user_id FROM sessions WHERE id = ? AND expires_at > ? LIMIT 1')
    .bind(sessionId, Date.now())
    .first<{ user_id: string }>();

  if (!session) {
    return { error: 'Unauthorized', status: 401 as const };
  }

  const user = await c.env.DB
    .prepare('SELECT id, username, role FROM users WHERE id = ? LIMIT 1')
    .bind(session.user_id)
    .first<{ id: string; username: string; role: string }>();

  if (!user) {
    return { error: 'Unauthorized', status: 401 as const };
  }

  if (user.role !== 'admin' && user.role !== 'moderator') {
    return { error: 'Forbidden', status: 403 as const };
  }

  return { user };
}

app.get('/api/moderation/reports', async (c) => {
  try {
    const auth = await resolveModerationActor(c);
    if ('error' in auth) {
      return c.json({ error: auth.error }, auth.status);
    }

    const result = await c.env.DB.prepare(`
      SELECT
        r.id AS id,
        r.reporter_id AS reporterId,
        COALESCE(reporter.username, 'Unknown user') AS reporterNickname,
        r.target_id AS targetId,
        COALESCE(target.username, 'Unknown user') AS targetNickname,
        r.reason AS reason,
        r.notes AS notes,
        r.room_id AS roomId,
        r.timestamp AS timestamp,
        r.status AS status
      FROM reports r
      LEFT JOIN users reporter ON reporter.id = r.reporter_id
      LEFT JOIN users target ON target.id = r.target_id
      WHERE r.status = 'pending'
      ORDER BY r.timestamp DESC
      LIMIT 100
    `).all();

    return c.json({ reports: result.results || [] });
  } catch (error) {
    console.error('[Moderation] Report list failed:', error);
    return c.json({ error: 'Unable to load reports.' }, 500);
  }
});

app.get('/api/moderation/audit-logs', async (c) => {
  try {
    const auth = await resolveModerationActor(c);
    if ('error' in auth) {
      return c.json({ error: auth.error }, auth.status);
    }

    const result = await c.env.DB.prepare(`
      SELECT
        a.id AS id,
        a.actor_nickname AS moderatorNickname,
        a.action AS action,
        COALESCE(target.username, 'Unknown user') AS targetNickname,
        a.reason AS reason,
        a.created_at AS timestamp
      FROM moderation_audit_logs a
      LEFT JOIN users target ON target.id = a.target_id
      ORDER BY a.created_at DESC
      LIMIT 100
    `).all();

    return c.json({ logs: result.results || [] });
  } catch (error) {
    console.error('[Moderation] Audit log list failed:', error);
    return c.json({ error: 'Unable to load audit logs.' }, 500);
  }
});

app.post('/api/moderation/action', async (c) => {
  const origin = c.req.header('Origin');
  const requestUrl = new URL(c.req.url);

  if (!origin || origin !== requestUrl.origin) {
    return c.json({ error: 'Invalid request origin.' }, 403);
  }

  try {
    const auth = await resolveModerationActor(c);

    if ('error' in auth) {
      return c.json({ error: auth.error }, auth.status);
    }

    const actor = auth.user;

    let body: {
      reportId?: unknown;
      action?: unknown;
      reason?: unknown;
    };

    try {
      body = await c.req.json();
    } catch {
      return c.json({ error: 'Invalid JSON body.' }, 400);
    }

    const reportId =
      typeof body.reportId === 'string' ? body.reportId.trim() : '';
    const action = body.action;
    const suppliedReason =
      typeof body.reason === 'string' ? body.reason.trim() : '';

    if (!reportId || reportId.length > 100) {
      return c.json({ error: 'A valid reportId is required.' }, 400);
    }

    if (!['warn', 'mute', 'ban', 'dismiss'].includes(String(action))) {
      return c.json({ error: 'Unsupported moderation action.' }, 400);
    }

    if (suppliedReason.length > 500) {
      return c.json({ error: 'Reason must be 500 characters or fewer.' }, 400);
    }

    const report = await c.env.DB.prepare(`
      SELECT
        id, reporter_id, target_id, reason, room_id, status
      FROM reports
      WHERE id = ?
      LIMIT 1
    `).bind(reportId).first<{
      id: string;
      reporter_id: string;
      target_id: string;
      reason: string;
      room_id: string | null;
      status: string;
    }>();

    if (!report) {
      return c.json({ error: 'Report not found.' }, 404);
    }

    if (report.status !== 'pending') {
      return c.json({ error: 'This report has already been reviewed.' }, 409);
    }

    if (actor.id === report.target_id || actor.id === report.reporter_id) {
      return c.json({ error: 'You cannot perform this action on this report.' }, 403);
    }

    if (actor.role !== 'admin') {
      if (!report.room_id) {
        return c.json({
          error: 'Only administrators can handle reports without a room.'
        }, 403);
      }

      const assignment = await c.env.DB.prepare(`
        SELECT 1 AS allowed
        FROM room_moderators
        WHERE room_id = ? AND user_id = ?
        LIMIT 1
      `).bind(report.room_id, actor.id).first();

      if (!assignment) {
        return c.json({
          error: 'You are not assigned to moderate this room.'
        }, 403);
      }
    }

    const target = await c.env.DB.prepare(`
      SELECT id, username, role
      FROM users
      WHERE id = ?
      LIMIT 1
    `).bind(report.target_id).first<{
      id: string;
      username: string;
      role: string;
    }>();

    if (!target) {
      return c.json({ error: 'Reported user no longer exists.' }, 404);
    }

    if (
      target.role === 'admin' ||
      (target.role === 'moderator' && actor.role !== 'admin')
    ) {
      return c.json({
        error: 'You are not authorized to moderate this account.'
      }, 403);
    }

    const selectedAction = action as 'warn' | 'mute' | 'ban' | 'dismiss';
    const now = Date.now();
    const auditId = crypto.randomUUID();
    const auditReason =
      suppliedReason || `Report reason: ${report.reason}`;

    const nextStatus =
      selectedAction === 'dismiss' ? 'dismissed' : 'action_taken';

    const statements = [
      c.env.DB.prepare(`
        UPDATE reports
        SET status = ?, reviewed_by = ?, reviewed_at = ?
        WHERE id = ? AND status = 'pending'
      `).bind(nextStatus, actor.id, now, report.id)
    ];

    if (selectedAction === 'mute') {
      if (!report.room_id) {
        return c.json({
          error: 'A room-specific report is required for muting.'
        }, 400);
      }

      statements.push(c.env.DB.prepare(`
        INSERT INTO room_mutes
          (id, room_id, user_id, reason, created_by, created_at, expires_at)
        SELECT ?, ?, ?, ?, ?, ?, ?
        WHERE EXISTS (
          SELECT 1 FROM reports
          WHERE id = ? AND status = 'action_taken'
            AND reviewed_by = ? AND reviewed_at = ?
        )
      `).bind(
        crypto.randomUUID(),
        report.room_id,
        report.target_id,
        auditReason,
        actor.id,
        now,
        now + 30 * 60 * 1000,
        report.id,
        actor.id,
        now
      ));
    }

    if (selectedAction === 'ban') {
      if (!report.room_id) {
        return c.json({
          error: 'A room-specific report is required for banning.'
        }, 400);
      }

      statements.push(c.env.DB.prepare(`
        INSERT INTO room_bans
          (id, room_id, user_id, reason, created_by, created_at, expires_at)
        SELECT ?, ?, ?, ?, ?, ?, ?
        WHERE EXISTS (
          SELECT 1 FROM reports
          WHERE id = ? AND status = 'action_taken'
            AND reviewed_by = ? AND reviewed_at = ?
        )
      `).bind(
        crypto.randomUUID(),
        report.room_id,
        report.target_id,
        auditReason,
        actor.id,
        now,
        now + 24 * 60 * 60 * 1000,
        report.id,
        actor.id,
        now
      ));
    }

    statements.push(c.env.DB.prepare(`
      INSERT INTO moderation_audit_logs
        (id, actor_id, actor_nickname, action, target_id, room_id, reason, created_at)
      SELECT ?, ?, ?, ?, ?, ?, ?, ?
      WHERE EXISTS (
        SELECT 1 FROM reports
        WHERE id = ? AND status = ? AND reviewed_by = ? AND reviewed_at = ?
      )
    `).bind(
      auditId,
      actor.id,
      actor.username,
      selectedAction,
      report.target_id,
      report.room_id,
      auditReason,
      now,
      report.id,
      nextStatus,
      actor.id,
      now
    ));

    const results = await c.env.DB.batch(statements);

    if (!results[0] || results[0].meta.changes !== 1) {
      return c.json({
        error: 'The report was already handled. Refresh the queue.'
      }, 409);
    }

    return c.json({
      success: true,
      action: selectedAction,
      status: nextStatus
    });
  } catch (error) {
    console.error('[Moderation] Action failed:', error);
    return c.json({
      error: 'Unable to complete the moderation action.'
    }, 500);
  }
});
app.post('/api/reports', async (c) => {
  const requestOrigin = c.req.header('Origin');
  const requestUrl = new URL(c.req.url);

  if (!requestOrigin || requestOrigin !== requestUrl.origin) {
    return c.json({ error: 'Invalid request origin.' }, 403);
  }
  const cookieHeader = c.req.header('cookie') || '';
  const sessionId = cookieHeader
    .split(';')
    .map((part) => part.trim())
    .find((part) => part.startsWith('session_id='))
    ?.slice('session_id='.length);

  if (!sessionId) {
    return c.json({ error: 'Please log in to submit a report.' }, 401);
  }

  try {
    const session = await c.env.DB.prepare(`
      SELECT user_id
      FROM sessions
      WHERE id = ? AND expires_at > ?
      LIMIT 1
    `).bind(sessionId, Date.now()).first<{ user_id: string }>();

    if (!session) {
      return c.json({ error: 'Your session has expired. Please log in again.' }, 401);
    }

    let body: {
      targetId?: unknown;
      reason?: unknown;
      notes?: unknown;
      roomId?: unknown;
    };

    try {
      body = await c.req.json();
    } catch {
      return c.json({ error: 'Invalid JSON body.' }, 400);
    }

    const targetId =
      typeof body.targetId === 'string' ? body.targetId.trim() : '';
    const reason =
      typeof body.reason === 'string' ? body.reason : '';
    const notes =
      typeof body.notes === 'string' ? body.notes.trim() : '';
    const roomId =
      typeof body.roomId === 'string' ? body.roomId.trim() : '';

    const allowedReasons = [
      'harassment',
      'underage_suspicion',
      'spam',
      'non_consensual',
      'other'
    ];

    if (!targetId || targetId.length > 128) {
      return c.json({ error: 'Invalid report target.' }, 400);
    }

    if (!allowedReasons.includes(reason)) {
      return c.json({ error: 'Select a valid report reason.' }, 400);
    }

    if (notes.length > 1000) {
      return c.json({ error: 'Notes must be 1000 characters or fewer.' }, 400);
    }

    if (targetId === session.user_id) {
      return c.json({ error: 'You cannot report your own account.' }, 400);
    }

    const target = await c.env.DB.prepare(`
      SELECT id FROM users WHERE id = ? LIMIT 1
    `).bind(targetId).first<{ id: string }>();

    if (!target) {
      return c.json({ error: 'The reported user was not found.' }, 404);
    }

    if (roomId) {
      const room = await c.env.DB.prepare(`
        SELECT id FROM rooms WHERE id = ? LIMIT 1
      `).bind(roomId).first<{ id: string }>();

      if (!room) {
        return c.json({ error: 'Invalid room.' }, 400);
      }
    }

    const recentReport = await c.env.DB.prepare(`
      SELECT id
      FROM reports
      WHERE reporter_id = ?
        AND target_id = ?
        AND timestamp > ?
      LIMIT 1
    `).bind(session.user_id, targetId, Date.now() - 10 * 60 * 1000)
      .first<{ id: string }>();

    if (recentReport) {
      return c.json({
        error: 'You recently reported this user. Please wait before submitting another report.'
      }, 429);
    }

    const reportId = crypto.randomUUID();
    const now = Date.now();

    await c.env.DB.prepare(`
      INSERT INTO reports
        (id, reporter_id, target_id, reason, timestamp, room_id, notes, status)
      VALUES (?, ?, ?, ?, ?, ?, ?, 'pending')
    `).bind(
      reportId,
      session.user_id,
      targetId,
      reason,
      now,
      roomId || null,
      notes
    ).run();

    return c.json({
      success: true,
      report: {
        id: reportId,
        status: 'pending',
        timestamp: now
      }
    }, 201);
  } catch (error) {
    console.error('[Reports] Submission failed:', error);
    return c.json({ error: 'Unable to submit your report right now.' }, 500);
  }
});

export { RoomDO } from './RoomDO';
export { CoordinatorDO } from './CoordinatorDO';
export default app;
