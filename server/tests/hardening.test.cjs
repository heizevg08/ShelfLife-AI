const { test } = require('node:test');
const assert = require('node:assert/strict');
const { createServer } = require('node:http');
const { once } = require('node:events');
const { Mongoose } = require('mongoose');
const { createApp } = require('../dist/app');
const { HttpError } = require('../dist/middleware/error.middleware');
const { createLoginLimiter, memoryLoginAttemptStore, LOGIN_WINDOW_MS } = require('../dist/services/login-limiter');
const { ingredientModel } = require('../dist/models/ingredient');
const { auditRecordModel } = require('../dist/models/audit-record');
const { userModel, ROLES } = require('../dist/models/user');
const { INGREDIENT_CATEGORIES, INGREDIENT_UNITS } = require('../dist/models/ingredient-options');
const { ingredientInput } = require('../dist/validators/ingredient');
const { accountInput, auditPagination } = require('../dist/validators/administration');
const { auditSnapshot } = require('../dist/services/audit-snapshot');

test('login limiter counts five failures, normalizes account, separates pairs, and expires at 15 minutes', async () => {
  let now = 0, retry;
  const store = memoryLoginAttemptStore();
  const limiter = createLoginLimiter(store, () => new Date(now));
  const restarted = createLoginLimiter(store, () => new Date(now));
  const fail = async () => { throw new HttpError(401, 'Invalid credentials'); };
  const run = (email = 'person@shelflife.com', ip = '127.0.0.1', login = fail, instance = limiter) => instance.run(email, ip, login, value => { retry = value; });
  for (let i = 0; i < 5; i++) await assert.rejects(run(), e => e.status === 401);
  await assert.rejects(run(' PERSON@SHELFLIFE.COM ', undefined, async () => 'correct password', restarted), e => e.status === 429);
  assert.equal(retry, 900);
  await assert.rejects(run(undefined, '127.0.0.2'), e => e.status === 401);
  await assert.rejects(run('different@shelflife.com'), e => e.status === 401);
  now = LOGIN_WINDOW_MS - 1;
  await assert.rejects(run(), e => e.status === 429);
  assert.equal(retry, 1);
  now++;
  assert.equal(await run(undefined, undefined, async () => 'ok'), 'ok');
});

test('successful login resets failures; infrastructure failures release reservations', async () => {
  const limiter = createLoginLimiter(memoryLoginAttemptStore());
  const run = login => limiter.run('person@shelflife.com', 'ip', login, () => {});
  const fail = async () => { throw new HttpError(401, 'Invalid credentials'); };
  for (let round = 0; round < 2; round++) {
    for (let i = 0; i < 4; i++) await assert.rejects(run(fail));
    await assert.rejects(run(async () => { throw new Error('Database unavailable'); }));
    assert.equal(await run(async () => 'ok'), 'ok');
  }
});

test('concurrent password checks cannot exceed the remaining slots', async () => {
  const limiter = createLoginLimiter(memoryLoginAttemptStore());
  let release, started = 0;
  const gate = new Promise(resolve => { release = resolve; });
  const requests = Array.from({ length: 10 }, () => limiter.run('a@shelflife.com', 'ip', async () => {
    started++; await gate; throw new HttpError(401, 'Invalid credentials');
  }, () => {}).catch(e => e.status));
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(started, 5);
  release();
  const statuses = await Promise.all(requests);
  assert.equal(statuses.filter(x => x === 401).length, 5);
  assert.equal(statuses.filter(x => x === 429).length, 5);
});

test('HTTP login responds 429/Retry-After and ignores spoofed X-Forwarded-For', async () => {
  let calls = 0;
  const auth = { login: async () => { calls++; throw new HttpError(401, 'Invalid credentials'); } };
  const server = createServer(createApp([], () => true, auth));
  server.listen(0, '127.0.0.1'); await once(server, 'listening');
  try {
    for (let i = 0; i < 6; i++) {
      const response = await fetch(`http://127.0.0.1:${server.address().port}/api/auth/login`, {
        method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Forwarded-For': `192.0.2.${i}` },
        body: JSON.stringify({ email: 'person@shelflife.com', password: 'wrong' }),
      });
      assert.equal(response.status, i < 5 ? 401 : 429);
      if (i === 5) assert.ok(Number(response.headers.get('retry-after')) > 0);
    }
    assert.equal(calls, 5);
  } finally { server.closeAllConnections(); await new Promise(resolve => server.close(resolve)); }
});

test('ingredient schema and request validation enforce the same category and unit lists', async () => {
  const model = ingredientModel(new Mongoose());
  const valid = { name: 'Milk', category: 'Dairy', unitOfMeasure: 'L', createdBy: '1'.repeat(24) };
  for (const category of INGREDIENT_CATEGORIES) await new model({ ...valid, category }).validate();
  for (const unitOfMeasure of INGREDIENT_UNITS) await new model({ ...valid, unitOfMeasure }).validate();
  for (const changes of [{ category: 'Unknown' }, { unitOfMeasure: 'liter' }, { unitOfMeasure: 'arbitrary' }]) {
    await assert.rejects(new model({ ...valid, ...changes }).validate());
    const { createdBy, ...input } = valid;
    assert.throws(() => ingredientInput({ ...input, ...changes }));
  }
});

test('canonical roles reject legacy writes; audit supports ingredient deletion and future target types', async () => {
  assert.deepEqual([...ROLES].sort(), ['Admin', 'Inventory Manager', 'Inventory Staff', 'Super Admin']);
  assert.throws(() => accountInput({ role: 'Manager' }, false));
  assert.equal(accountInput({ role: 'Inventory Manager' }, false).role, 'Inventory Manager');
  const driver = new Mongoose(), users = userModel(driver), audits = auditRecordModel(driver);
  await assert.rejects(new users({ role: 'Manager' }).validate(), error => !!error.errors.role);
  for (const targetType of audits.schema.path('targetType').enumValues) {
    await new audits({ userId: '1'.repeat(24), targetId: '2'.repeat(24), targetType, action: 'DELETE' }).validate();
  }
  await assert.rejects(new audits({ targetId: '2'.repeat(24), targetType: 'User', action: 'UPDATE' }).validate());
  await new audits({ actorType: 'System', targetId: '2'.repeat(24), targetType: 'User', action: 'UPDATE' }).validate();
  assert.equal(auditPagination({ action: 'DELETE' }).action, 'DELETE');
});

test('audit snapshots discard credentials and unapproved nested fields', () => {
  const source = { id: '1', firstName: 'Before', password: 'secret', passwordHash: 'secret', authVersion: 1, resetTokenHash: 'secret', email: { injected: 'secret' } };
  const snapshot = auditSnapshot('User', source);
  source.firstName = 'After';
  assert.deepEqual(snapshot, { id: '1', firstName: 'Before' });
  assert.deepEqual(auditSnapshot('Ingredient', { createdBy: { id: '1', passwordHash: 'secret' } }), { createdBy: '1' });
});
