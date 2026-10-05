const { test } = require('node:test');
const assert = require('node:assert/strict');
const { Mongoose } = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');
const { loginAttemptModel } = require('../dist/models/login-attempt');
const { createLoginLimiter, mongoLoginAttemptStore, LOGIN_LIMIT } = require('../dist/services/login-limiter');
const { provisionSecurityIndexes } = require('../dist/services/security-indexes');
const { HttpError } = require('../dist/middleware/error.middleware');

test('Mongo login limiter provisions TTL cleanup and persists bounded hashed attempts', async t => {
  const mongo = await MongoMemoryServer.create();
  const driver = new Mongoose();
  await driver.connect(mongo.getUri('shelflifeai_security_test'));
  t.after(async () => { await driver.disconnect(); await mongo.stop(); });

  const attempts = loginAttemptModel(driver);
  await provisionSecurityIndexes(attempts);
  const indexes = await attempts.collection.listIndexes().toArray();
  assert.ok(indexes.some(index => index.name === 'login_attempt_expiry' && index.expireAfterSeconds === 0));

  const limiter = createLoginLimiter(mongoLoginAttemptStore(attempts), () => new Date('2026-10-05T00:00:00.000Z'));
  const denied = async () => { throw new HttpError(401, 'Invalid email or password'); };
  for (let attempt = 0; attempt < LOGIN_LIMIT; attempt += 1)
    await assert.rejects(limiter.run('security@shelflife.com', '127.0.0.1', denied, () => {}), error => error.status === 401);
  await assert.rejects(limiter.run('security@shelflife.com', '127.0.0.1', denied, () => {}), error => error.status === 429);

  const rows = await attempts.find().lean().exec();
  assert.equal(rows.length, 1);
  assert.equal(rows[0].attempts, LOGIN_LIMIT);
  assert.match(rows[0]._id, /^[a-f0-9]{64}$/);
  assert.equal(JSON.stringify(rows).includes('security@shelflife.com'), false);
  assert.equal(JSON.stringify(rows).includes('127.0.0.1'), false);
});
