import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { RoomDO } from '../src/worker/RoomDO.js';
import { CoordinatorDO } from '../src/worker/CoordinatorDO.js';

const SECRET = 'test-only-internal-secret';

function makeRequest(secret?: string, userId?: string): Request {
  const headers = new Headers();
  if (secret !== undefined) headers.set('x-internal-secret', secret);
  if (userId !== undefined) headers.set('x-user-id', userId);

  return new Request('https://internal.test/ws', { headers });
}

describe('RoomDO internal authentication', () => {
  test('rejects requests when the secret is missing', async () => {
    const state = { id: { toString: () => 'room-test' } };
    const env = { DB: {}, INTERNAL_MODERATION_SECRET: SECRET };
    const room = new RoomDO(state as any, env as any);

    const response = await room.fetch(makeRequest(undefined, 'user-1'));
    assert.equal(response.status, 403);
  });

  test('rejects requests with an incorrect secret', async () => {
    const state = { id: { toString: () => 'room-test' } };
    const env = { DB: {}, INTERNAL_MODERATION_SECRET: SECRET };
    const room = new RoomDO(state as any, env as any);

    const response = await room.fetch(makeRequest('wrong-secret', 'user-1'));
    assert.equal(response.status, 403);
  });

  test('rejects requests when the configured secret is empty', async () => {
    const state = { id: { toString: () => 'room-test' } };
    const env = { DB: {}, INTERNAL_MODERATION_SECRET: '' };
    const room = new RoomDO(state as any, env as any);

    const response = await room.fetch(makeRequest(SECRET, 'user-1'));
    assert.equal(response.status, 403);
  });

  test('returns 401 when secret is valid but user ID is missing', async () => {
    const state = { id: { toString: () => 'room-test' } };
    const env = { DB: {}, INTERNAL_MODERATION_SECRET: SECRET };
    const room = new RoomDO(state as any, env as any);

    const response = await room.fetch(makeRequest(SECRET));
    assert.equal(response.status, 401);
  });
});

describe('CoordinatorDO internal authentication', () => {
  test('rejects requests when the secret is missing', async () => {
    const state = { storage: {} };
    const coordinator = new CoordinatorDO(state as any, {
      INTERNAL_MODERATION_SECRET: SECRET
    });

    const response = await coordinator.fetch(makeRequest(undefined, 'user-1'));
    assert.equal(response.status, 403);
  });

  test('rejects requests with an incorrect secret', async () => {
    const state = { storage: {} };
    const coordinator = new CoordinatorDO(state as any, {
      INTERNAL_MODERATION_SECRET: SECRET
    });

    const response = await coordinator.fetch(makeRequest('wrong-secret', 'user-1'));
    assert.equal(response.status, 403);
  });

  test('rejects requests when the configured secret is empty', async () => {
    const state = { storage: {} };
    const coordinator = new CoordinatorDO(state as any, {
      INTERNAL_MODERATION_SECRET: ''
    });

    const response = await coordinator.fetch(makeRequest(SECRET, 'user-1'));
    assert.equal(response.status, 403);
  });

  test('returns 401 when secret is valid but user ID is missing', async () => {
    const state = { storage: {} };
    const coordinator = new CoordinatorDO(state as any, {
      INTERNAL_MODERATION_SECRET: SECRET
    });

    const response = await coordinator.fetch(makeRequest(SECRET));
    assert.equal(response.status, 401);
  });
});
