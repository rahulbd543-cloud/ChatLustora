
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import app from '../src/worker/index.ts';

type MockOptions = {
  sessionExists?: boolean;
  actorRole?: string;
  assigned?: boolean;
  reportStatus?: string;
  reportRoomId?: string | null;
};

function makeEnv(options: MockOptions = {}) {
  const statements: Array<{ sql: string; values: unknown[] }> = [];
  let batchCalls = 0;

  const report = {
    id: 'report-1',
    reporter_id: 'reporter-1',
    target_id: 'target-1',
    reason: 'spam',
    room_id: options.reportRoomId === undefined
      ? 'bangla-chat'
      : options.reportRoomId,
    status: options.reportStatus ?? 'pending'
  };

  const db = {
    prepare(sql: string) {
      let values: unknown[] = [];

      const statement = {
        bind(...args: unknown[]) {
          values = args;
          return statement;
        },
        async first() {
          const normalized = sql.replace(/\s+/g, ' ').trim();

          if (normalized.includes('FROM sessions')) {
            return options.sessionExists === false
              ? null
              : { user_id: 'actor-1' };
          }

          if (normalized.includes('FROM users') &&
              normalized.includes('username')) {
            if (values[0] === 'actor-1') {
              return {
                id: 'actor-1',
                username: 'TestModerator',
                role: options.actorRole ?? 'admin'
              };
            }

            if (values[0] === 'target-1') {
              return {
                id: 'target-1',
                username: 'ReportedUser',
                role: 'member'
              };
            }
          }

          if (normalized.includes('FROM reports')) {
            return { ...report };
          }

          if (normalized.includes('FROM room_moderators')) {
            return options.assigned === false ? null : { allowed: 1 };
          }

          return null;
        },
        async all() {
          return { results: [] };
        },
        async run() {
          return { success: true, meta: { changes: 1 } };
        }
      };

      statements.push({ sql, values });
      return statement;
    },

    async batch(batchStatements: unknown[]) {
      batchCalls++;
      return batchStatements.map(() => ({
        success: true,
        meta: { changes: 1 }
      }));
    }
  };

  return {
    env: {
      DB: db,
      ROOMS: {} as any,
      COORDINATOR: {} as any,
      INTERNAL_MODERATION_SECRET: 'test-secret'
    },
    statements,
    get batchCalls() {
      return batchCalls;
    }
  };
}

async function sendAction(
  env: ReturnType<typeof makeEnv>['env'],
  options: {
    origin?: string;
    cookie?: string;
    body?: string;
  } = {}
) {
  const headers = new Headers({
    'Content-Type': 'application/json'
  });

  if (options.origin !== undefined) {
    headers.set('Origin', options.origin);
  }

  if (options.cookie !== undefined) {
    headers.set('Cookie', options.cookie);
  }

  return app.request(
  'https://app.test/api/moderation/action',
  {
      method: 'POST',
      headers,
      body: options.body ?? JSON.stringify({
        reportId: 'report-1',
        action: 'dismiss'
      })
    },
    env as any
  );
}

describe('Moderation action API security', () => {
  test('rejects a request without a valid same-origin header', async () => {
    const mock = makeEnv();

    const response = await sendAction(mock.env, {
      cookie: 'session_id=test-session'
    });

    assert.equal(response.status, 403);
    assert.equal(mock.batchCalls, 0);
  });

  test('rejects requests without an authenticated session', async () => {
    const mock = makeEnv({ sessionExists: false });

    const response = await sendAction(mock.env, {
      origin: 'https://app.test'
    });

    assert.equal(response.status, 401);
    assert.equal(mock.batchCalls, 0);
  });

  test('rejects a normal member attempting moderation', async () => {
    const mock = makeEnv({ actorRole: 'member' });

    const response = await sendAction(mock.env, {
      origin: 'https://app.test',
      cookie: 'session_id=test-session'
    });

    assert.equal(response.status, 403);
    assert.equal(mock.batchCalls, 0);
  });

  test('rejects unsupported moderation actions', async () => {
    const mock = makeEnv();

    const response = await sendAction(mock.env, {
      origin: 'https://app.test',
      cookie: 'session_id=test-session',
      body: JSON.stringify({
        reportId: 'report-1',
        action: 'delete_database'
      })
    });

    assert.equal(response.status, 400);
    assert.equal(mock.batchCalls, 0);
  });

  test('rejects a report that has already been reviewed', async () => {
    const mock = makeEnv({ reportStatus: 'dismissed' });

    const response = await sendAction(mock.env, {
      origin: 'https://app.test',
      cookie: 'session_id=test-session'
    });

    assert.equal(response.status, 409);
    assert.equal(mock.batchCalls, 0);
  });

  test('requires room assignment for a moderator', async () => {
    const mock = makeEnv({
      actorRole: 'moderator',
      assigned: false
    });

    const response = await sendAction(mock.env, {
      origin: 'https://app.test',
      cookie: 'session_id=test-session'
    });

    assert.equal(response.status, 403);
    assert.equal(mock.batchCalls, 0);
  });

  test('dismisses a pending report and records the action batch', async () => {
    const mock = makeEnv();

    const response = await sendAction(mock.env, {
      origin: 'https://app.test',
      cookie: 'session_id=test-session'
    });

    assert.equal(response.status, 200);
    assert.deepEqual(await response.json(), {
      success: true,
      action: 'dismiss',
      status: 'dismissed'
    });
    assert.equal(mock.batchCalls, 1);
  });
});
