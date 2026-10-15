const { test } = require('node:test');
const assert = require('node:assert/strict');
const { once } = require('node:events');
const { createServer } = require('node:http');
const { createApp } = require('../dist/app');
const { HttpError } = require('../dist/middleware/error.middleware');
const { createLoginLimiter, memoryLoginAttemptStore, LOGIN_LIMIT } = require('../dist/services/login-limiter');
const { provisionSecurityIndexes } = require('../dist/services/security-indexes');

async function serve(t, app) {
  const server = createServer(app);
  server.listen(0, '127.0.0.1');
  await once(server, 'listening');
  t.after(() => new Promise(resolve => { server.close(resolve); server.closeAllConnections(); }));
  return `http://127.0.0.1:${server.address().port}`;
}

test('login limiter bounds credential failures by normalized account and IP without retaining raw identifiers', async () => {
  let now = new Date('2026-10-05T00:00:00.000Z');
  const reservations = [];
  const backing = memoryLoginAttemptStore();
  const limiter = createLoginLimiter({
    reserve: async (key, at) => { reservations.push(key); return backing.reserve(key, at); },
    finish: (...args) => backing.finish(...args),
  }, () => now);
  const denied = async () => { throw new HttpError(401, 'Invalid email or password'); };
  for (let attempt = 0; attempt < LOGIN_LIMIT; attempt += 1)
    await assert.rejects(limiter.run(' USER@SHELFLIFE.COM ', '127.0.0.1', denied, () => {}), error => error.status === 401);
  let retryAfter = 0;
  await assert.rejects(limiter.run('user@shelflife.com', '127.0.0.1', denied, seconds => { retryAfter = seconds; }), error => error.status === 429);
  assert.equal(retryAfter, 900);
  assert.ok(reservations.every(key => /^[a-f0-9]{64}$/.test(key)));
  assert.equal(reservations.some(key => key.includes('user@shelflife.com') || key.includes('127.0.0.1')), false);
  now = new Date(now.getTime() + 15 * 60 * 1000 + 1);
  assert.equal(await limiter.run('user@shelflife.com', '127.0.0.1', async () => 'ok', () => {}), 'ok');
});

test('infrastructure failures release limiter reservations and successful login clears failures', async () => {
  const limiter = createLoginLimiter(memoryLoginAttemptStore());
  for (let attempt = 0; attempt < LOGIN_LIMIT + 2; attempt += 1)
    await assert.rejects(limiter.run('user@shelflife.com', '127.0.0.1', async () => { throw new Error('provider unavailable'); }, () => {}));
  assert.equal(await limiter.run('user@shelflife.com', '127.0.0.1', async () => 'ok', () => {}), 'ok');
  await assert.rejects(limiter.run('user@shelflife.com', '127.0.0.1', async () => { throw new HttpError(401, 'denied'); }, () => {}));
  assert.equal(await limiter.run('user@shelflife.com', '127.0.0.1', async () => 'ok', () => {}), 'ok');
});

test('API headers, request IDs, input rejection, and diagnostics remain safe', async t => {
  const warnings = [];
  const originalWarn = console.warn;
  console.warn = value => warnings.push(String(value));
  t.after(() => { console.warn = originalWarn; });
  const origin = await serve(t, createApp([], () => true));
  let response = await fetch(`${origin}/api/health/live`);
  assert.equal(response.status, 200);
  assert.match(response.headers.get('x-request-id'), /^[0-9a-f-]{36}$/i);
  assert.equal(response.headers.get('x-frame-options'), 'DENY');
  assert.equal(response.headers.get('x-content-type-options'), 'nosniff');
  assert.match(response.headers.get('content-security-policy'), /default-src 'none'/);

  response = await fetch(`${origin}/missing`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ nested: { '$private-token': 'do-not-log' } }) });
  assert.equal(response.status, 400);
  assert.deepEqual(await response.json(), { error: { message: 'MongoDB operator and dotted keys are not permitted' } });
  await new Promise(resolve => setImmediate(resolve));
  const event = warnings.map(value => JSON.parse(value)).find(value => value.status === 400);
  assert.equal(event.event, 'request_rejected');
  assert.equal(event.method, 'POST');
  assert.equal(event.scope, 'other');
  assert.equal(event.errorType, 'HttpError');
  assert.equal(JSON.stringify(event).includes('private-token'), false);
  assert.equal(JSON.stringify(event).includes('do-not-log'), false);

  response = await fetch(`${origin}/missing`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ password: '$allowed.string.with.dots' }) });
  assert.equal(response.status, 404);
});

test('protected route authentication still precedes guarded JSON parsing', async t => {
  const auth = { login: async () => { throw new Error('unused'); }, authenticate: async () => { throw new HttpError(401, 'Authentication required'); } };
  const ingredients = {};
  const origin = await serve(t, createApp([], () => true, auth, undefined, undefined, ingredients));
  const response = await fetch(`${origin}/api/ingredients`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ '$private': true }) });
  assert.equal(response.status, 401);
});

test('authenticated protected routes reject Mongo-shaped query keys before services run', async t => {
  let listed = false;
  const auth = { login: async () => { throw new Error('unused'); }, authenticate: async () => ({ id: '1'.repeat(24), name: 'Test Manager', role: 'Manager', email: 'manager@shelflife.com', isActive: true }) };
  const ingredients = { list: async () => { listed = true; return { items: [], page: 1, pageSize: 25, total: 0 }; } };
  const origin = await serve(t, createApp([], () => true, auth, undefined, undefined, ingredients));
  const response = await fetch(`${origin}/api/ingredients?%24where=private`);
  assert.equal(response.status, 400);
  assert.equal(listed, false);
});

test('security index provisioning is additive and verifies the exact TTL index', async () => {
  let creates = 0;
  const valid = { createIndexes: async () => { creates += 1; }, collection: { listIndexes: () => ({ toArray: async () => [{ name: '_id_', key: { _id: 1 } }, { name: 'login_attempt_expiry', key: { expiresAt: 1 }, expireAfterSeconds: 0 }] }) } };
  assert.deepEqual(await provisionSecurityIndexes(valid), { loginAttemptExpiryIndex: 'login_attempt_expiry', expireAfterSeconds: 0 });
  assert.equal(creates, 1);
  const invalid = { ...valid, collection: { listIndexes: () => ({ toArray: async () => [{ name: 'login_attempt_expiry', key: { expiresAt: 1 }, expireAfterSeconds: 60 }] }) } };
  await assert.rejects(provisionSecurityIndexes(invalid), /missing or incompatible/);
});
