import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import app from '../src/worker/index.ts';

type UserRow = {
  id: string;
  username: string;
  email: string;
  password_hash: string;
  created_at: number;
  role?: string;
};

type SessionRow = {
  id: string;
  user_id: string;
  expires_at: number;
};

function createMockEnv() {
  const users: UserRow[] = [];
  const sessions: SessionRow[] = [];

  const db = {
    prepare(sql: string) {
      let boundValues: unknown[] = [];
      const normalized = sql.replace(/\s+/g, ' ').trim();

      const stmt = {
        bind(...args: unknown[]) {
          boundValues = args;
          return stmt;
        },
        async first<T = unknown>(): Promise<T | null> {
          if (normalized.includes('FROM users WHERE email = ?')) {
            const email = boundValues[0] as string;
            const u = users.find((row) => row.email === email);
            return (u as T) ?? null;
          }

          if (normalized.includes('FROM users WHERE id = ?')) {
            const id = boundValues[0] as string;
            const u = users.find((row) => row.id === id);
            return (u as T) ?? null;
          }

          if (normalized.includes('FROM sessions WHERE id = ? AND expires_at > ?')) {
            const id = boundValues[0] as string;
            const now = boundValues[1] as number;
            const s = sessions.find((row) => row.id === id && row.expires_at > now);
            return (s as T) ?? null;
          }

          return null;
        },
        async run() {
          if (normalized.includes('INSERT INTO users')) {
            const [id, username, email, password_hash, created_at] = boundValues as [string, string, string, string, number];
            if (users.some((u) => u.email === email)) {
              throw new Error('UNIQUE constraint failed: users.email');
            }
            if (users.some((u) => u.username === username)) {
              throw new Error('UNIQUE constraint failed: users.username');
            }
            users.push({ id, username, email, password_hash, created_at, role: 'member' });
            return { success: true, meta: { changes: 1 } };
          }

          if (normalized.includes('INSERT INTO sessions')) {
            const [id, user_id, expires_at] = boundValues as [string, string, number];
            sessions.push({ id, user_id, expires_at });
            return { success: true, meta: { changes: 1 } };
          }

          if (normalized.includes('DELETE FROM sessions WHERE id = ?')) {
            const id = boundValues[0] as string;
            const idx = sessions.findIndex((s) => s.id === id);
            if (idx >= 0) sessions.splice(idx, 1);
            return { success: true, meta: { changes: 1 } };
          }

          return { success: true, meta: { changes: 0 } };
        },
        async all() {
          return { results: [] };
        }
      };

      return stmt;
    }
  };

  return {
    env: {
      DB: db,
      ROOMS: {} as any,
      COORDINATOR: {} as any,
      INTERNAL_MODERATION_SECRET: 'test-secret'
    },
    users,
    sessions
  };
}

describe('Worker WebRTC and Nickname API Routes', () => {
  test('GET /api/webrtc/config returns 200 with valid JSON iceServers schema', async () => {
    const { env } = createMockEnv();
    const res = await app.request('https://app.test/api/webrtc/config', { method: 'GET' }, env as any);

    assert.equal(res.status, 200);
    assert.match(res.headers.get('content-type') || '', /application\/json/);

    const data = await res.json() as { iceServers: Array<{ urls: string }> };
    assert.ok(Array.isArray(data.iceServers));
    assert.ok(data.iceServers.length >= 2);
    assert.ok(data.iceServers.some((s) => typeof s.urls === 'string' && s.urls.includes('stun.l.google.com:19302')));
    assert.ok(data.iceServers.some((s) => typeof s.urls === 'string' && s.urls.includes('stun1.l.google.com:19302')));
  });

  test('GET /api/auth/suggest-nickname returns 200 with valid nickname', async () => {
    const { env } = createMockEnv();
    const res = await app.request('https://app.test/api/auth/suggest-nickname', { method: 'GET' }, env as any);

    assert.equal(res.status, 200);
    assert.match(res.headers.get('content-type') || '', /application\/json/);

    const data = await res.json() as { nickname: string };
    assert.ok(typeof data.nickname === 'string');
    assert.ok(data.nickname.length >= 5);
  });
});

describe('Worker Guest Session (/api/auth/session) & 18+ Verification', () => {
  test('Rejects guest entry if 18+ adult checkbox is unconfirmed (400)', async () => {
    const { env } = createMockEnv();
    const res = await app.request(
      'https://app.test/api/auth/session',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          nickname: 'Desi_Guest',
          gender: 'male',
          dateOfBirth: '2000-01-01',
          isAdultConfirmed: false,
          termsAccepted: true
        })
      },
      env as any
    );

    assert.equal(res.status, 400);
    const data = await res.json() as { error: string };
    assert.match(data.error, /18 years/);
  });

  test('Rejects guest entry if terms are not accepted (400)', async () => {
    const { env } = createMockEnv();
    const res = await app.request(
      'https://app.test/api/auth/session',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          nickname: 'Desi_Guest',
          gender: 'male',
          dateOfBirth: '2000-01-01',
          isAdultConfirmed: true,
          termsAccepted: false
        })
      },
      env as any
    );

    assert.equal(res.status, 400);
    const data = await res.json() as { error: string };
    assert.match(data.error, /Terms of Service/);
  });

  test('Rejects future date of birth with 400', async () => {
    const { env } = createMockEnv();
    const res = await app.request(
      'https://app.test/api/auth/session',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          nickname: 'Desi_Guest',
          gender: 'male',
          dateOfBirth: '2035-01-01',
          isAdultConfirmed: true,
          termsAccepted: true
        })
      },
      env as any
    );

    assert.equal(res.status, 400);
    const data = await res.json() as { error: string };
    assert.match(data.error, /Future date of birth/);
  });

  test('Rejects under-18 user with 403', async () => {
    const { env } = createMockEnv();
    const res = await app.request(
      'https://app.test/api/auth/session',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          nickname: 'Desi_Guest',
          gender: 'male',
          dateOfBirth: '2012-01-01',
          isAdultConfirmed: true,
          termsAccepted: true
        })
      },
      env as any
    );

    assert.equal(res.status, 403);
    const data = await res.json() as { error: string };
    assert.match(data.error, /at least 18 years old/);
  });

  test('Creates valid guest session for eligible adult (18+) and sets session cookies', async () => {
    const { env, users, sessions } = createMockEnv();
    const res = await app.request(
      'https://app.test/api/auth/session',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          nickname: 'Dhaka_Star',
          gender: 'female',
          dateOfBirth: '1998-06-15',
          isAdultConfirmed: true,
          termsAccepted: true,
          isGenderVisible: true
        })
      },
      env as any
    );

    assert.equal(res.status, 200);
    const data = await res.json() as { success: boolean; session: any };
    assert.equal(data.success, true);
    assert.equal(data.session.nickname, 'Dhaka_Star');
    assert.equal(data.session.role, 'guest');
    assert.equal(data.session.gender, 'female');
    assert.ok(data.session.userId);
    assert.ok(data.session.token);

    // Verify D1 records
    assert.equal(users.length, 1);
    assert.equal(sessions.length, 1);
    assert.equal(sessions[0].user_id, data.session.userId);

    // Verify Set-Cookie header
    const setCookie = res.headers.get('set-cookie');
    assert.ok(setCookie);
    assert.match(setCookie, /session_id=/);
  });
});

describe('Worker Member Registration, Login, and Me Flow', () => {
  test('GET /api/auth/me returns 401 Unauthorized with valid JSON for anonymous visitors', async () => {
    const { env } = createMockEnv();
    const res = await app.request('https://app.test/api/auth/me', { method: 'GET' }, env as any);

    assert.equal(res.status, 401);
    assert.match(res.headers.get('content-type') || '', /application\/json/);
    const data = await res.json() as { error: string };
    assert.equal(data.error, 'Unauthorized');
  });

  test('Registration fails with 403 for minor (under 18)', async () => {
    const { env } = createMockEnv();
    const res = await app.request(
      'https://app.test/api/auth/register',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          username: 'MinorUser',
          email: 'minor@test.com',
          password: 'Password123!',
          dateOfBirth: '2015-05-10'
        })
      },
      env as any
    );

    assert.equal(res.status, 403);
    const data = await res.json() as { error: string };
    assert.match(data.error, /at least 18 years old/);
  });

  test('Full registration, login, and authenticated /api/auth/me workflow', async () => {
    const { env } = createMockEnv();

    // 1. Register
    const regRes = await app.request(
      'https://app.test/api/auth/register',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          username: 'MemberAlice',
          email: 'alice@example.com',
          password: 'SecurePassword123!',
          dateOfBirth: '1995-04-12'
        })
      },
      env as any
    );

    assert.equal(regRes.status, 200);
    const regData = await regRes.json() as { success: boolean; userId: string };
    assert.equal(regData.success, true);
    assert.ok(regData.userId);

    // 2. Reject duplicate email with 409
    const dupRes = await app.request(
      'https://app.test/api/auth/register',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          username: 'AnotherUser',
          email: 'alice@example.com',
          password: 'OtherPassword123!',
          dateOfBirth: '1995-04-12'
        })
      },
      env as any
    );
    assert.equal(dupRes.status, 409);

    // 3. Login
    const loginRes = await app.request(
      'https://app.test/api/auth/login',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: 'alice@example.com',
          password: 'SecurePassword123!'
        })
      },
      env as any
    );

    assert.equal(loginRes.status, 200);
    const loginData = await loginRes.json() as { success: boolean; session: any };
    assert.equal(loginData.success, true);
    assert.equal(loginData.session.nickname, 'MemberAlice');
    assert.equal(loginData.session.role, 'member');

    const sessionId = loginData.session.token;
    assert.ok(sessionId);

    // 4. Authenticated /api/auth/me via Cookie
    const meRes = await app.request(
      'https://app.test/api/auth/me',
      {
        method: 'GET',
        headers: {
          Cookie: `session_id=${sessionId}`
        }
      },
      env as any
    );

    assert.equal(meRes.status, 200);
    const meData = await meRes.json() as { userId: string; username: string; email: string; role: string };
    assert.equal(meData.username, 'MemberAlice');
    assert.equal(meData.email, 'alice@example.com');
    assert.equal(meData.role, 'member');

    // 5. Authenticated /api/auth/me via chatlustora_session cookie
    const meAltRes = await app.request(
      'https://app.test/api/auth/me',
      {
        method: 'GET',
        headers: {
          Cookie: `chatlustora_session=${sessionId}`
        }
      },
      env as any
    );
    assert.equal(meAltRes.status, 200);

    // 6. Authenticated /api/auth/me via Bearer header
    const meBearerRes = await app.request(
      'https://app.test/api/auth/me',
      {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${sessionId}`
        }
      },
      env as any
    );
    assert.equal(meBearerRes.status, 200);

    // 7. Logout
    const logoutRes = await app.request(
      'https://app.test/api/auth/logout',
      {
        method: 'POST',
        headers: {
          Cookie: `session_id=${sessionId}`
        }
      },
      env as any
    );
    assert.equal(logoutRes.status, 200);

    // 8. Subsequent /api/auth/me returns 401
    const postLogoutMe = await app.request(
      'https://app.test/api/auth/me',
      {
        method: 'GET',
        headers: {
          Cookie: `session_id=${sessionId}`
        }
      },
      env as any
    );
    assert.equal(postLogoutMe.status, 401);
  });
});
