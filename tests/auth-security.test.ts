import { test } from 'node:test';
import assert from 'node:assert/strict';
import { hashPassword, verifyPassword } from '../src/worker/auth.ts';

test('password hash verifies the correct password', async () => {
  const stored = await hashPassword('StrongTestPassword123!');
  assert.equal(await verifyPassword('StrongTestPassword123!', stored), true);
});

test('password hash rejects an incorrect password', async () => {
  const stored = await hashPassword('StrongTestPassword123!');
  assert.equal(await verifyPassword('WrongPassword123!', stored), false);
});

test('malformed stored hashes never authenticate', async () => {
  assert.equal(await verifyPassword('anything123', 'v1:'), false);
  assert.equal(await verifyPassword('anything123', 'v1:not-base64!!!'), false);

  // Valid Base64, but contains only a 16-byte salt and no password hash.
  const saltOnly = btoa(String.fromCharCode(...new Uint8Array(16)));
  assert.equal(await verifyPassword('anything123', `v1:${saltOnly}`), false);

  assert.equal(await verifyPassword('anything123', 'v2:invalid'), false);
});
