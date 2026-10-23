import test, { after, before } from 'node:test';
import assert from 'node:assert/strict';
import { app } from './app.js';

let origin = '';
let server: ReturnType<typeof app.listen>;

before(async () => {
  server = app.listen(0, '127.0.0.1');
  await new Promise<void>((resolve) => server.once('listening', resolve));
  const address = server.address();
  if (!address || typeof address === 'string') throw new Error('Could not start API test server.');
  origin = `http://127.0.0.1:${address.port}`;
});

after(async () => {
  await new Promise<void>((resolve, reject) => {
    server.close((error) => error ? reject(error) : resolve());
  });
});

test('health route confirms the API is ready', async () => {
  const response = await fetch(`${origin}/health`);
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), { status: 'ok' });
});

test('patient resources require authentication', async () => {
  const response = await fetch(`${origin}/me/stories`);
  assert.equal(response.status, 401);
  assert.deepEqual(await response.json(), { error: 'Please sign in to continue.' });
});

test('uploaded photo content requires authentication', async () => {
  const response = await fetch(`${origin}/photos/not-a-photo/content`);
  assert.equal(response.status, 401);
});

test('login rejects invalid request bodies with a safe 400 response', async () => {
  const response = await fetch(`${origin}/auth/login`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ email: 'not-an-email', password: '' }),
  });
  assert.equal(response.status, 400);
});
