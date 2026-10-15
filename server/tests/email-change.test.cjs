const test = require('node:test');
const assert = require('node:assert/strict');
const { hashPassword } = require('../dist/services/password');
const { tokenHash } = require('../dist/services/persistent-session');
const { createEmailChange } = require('../dist/services/email-change');

async function fixture(role = 'Admin') {
  let now = new Date('2026-10-15T00:00:00Z'), delivered;
  const row = { _id: { toString: () => '1'.repeat(24) }, email: 'old@shelflife.com', passwordHash: await hashPassword('current-password-123'), isActive: true, role };
  const store = {
    byIdWithSecrets: async id => id === row._id.toString() ? row : null,
    emailExists: async email => email === 'used@shelflife.com',
    stage: async (_id, email, hash, expiresAt, sentAt) => { Object.assign(row, { pendingEmail: email, emailChangeCodeHash: hash, emailChangeExpiresAt: expiresAt, emailChangeSentAt: sentAt, emailChangeAttempts: 0 }); return true; },
    fail: async (_id, hash, instant) => row.emailChangeCodeHash !== hash && row.emailChangeExpiresAt > instant ? ++row.emailChangeAttempts : 5,
    activate: async (_id, hash, instant) => { if (row.emailChangeCodeHash !== hash || row.emailChangeExpiresAt <= instant || row.emailChangeAttempts >= 5) return false; row.email = row.pendingEmail; row.authVersion = (row.authVersion || 0) + 1; delete row.pendingEmail; delete row.emailChangeCodeHash; return true; },
    clear: async () => { delete row.pendingEmail; delete row.emailChangeCodeHash; },
  };
  const service = createEmailChange(store, { send: async (email, code) => { delivered = { email, code }; } }, () => now);
  return { row, service, delivered: () => delivered, advance: milliseconds => { now = new Date(now.getTime() + milliseconds); } };
}

test('email change verifies password, exact domain, uniqueness and replacement ownership', async () => {
  const f = await fixture();
  for (const body of [
    { email: 'user@example.com', currentPassword: 'current-password-123' },
    { email: 'user@sub.shelflife.com', currentPassword: 'current-password-123' },
    { email: 'new@shelflife.com', currentPassword: 'wrong-password' },
    { email: 'used@shelflife.com', currentPassword: 'current-password-123' },
  ]) await assert.rejects(f.service.request(f.row._id.toString(), body));
  await f.service.request(f.row._id.toString(), { email: ' NEW@SHELFLIFE.COM ', currentPassword: 'current-password-123' });
  assert.equal(f.delivered().email, 'new@shelflife.com');
  assert.notEqual(f.row.emailChangeCodeHash, f.delivered().code);
  await assert.rejects(f.service.complete(f.row._id.toString(), { code: '000000' }));
  await f.service.complete(f.row._id.toString(), { code: f.delivered().code });
  assert.equal(f.row.email, 'new@shelflife.com');
  assert.equal(f.row.authVersion, 1);
});

test('email change is restricted to the account-administration roles', async () => {
  // Super Admin and Admin may change their own address, using the same self-only contract.
  for (const role of ['Super Admin', 'Admin']) {
    const f = await fixture(role);
    await f.service.request(f.row._id.toString(), { email: `${role.replace(/\s/g, '').toLowerCase()}@shelflife.com`, currentPassword: 'current-password-123' });
    await f.service.complete(f.row._id.toString(), { code: f.delivered().code });
    assert.equal(f.row.role, role);
    assert.equal(f.row.email, `${role.replace(/\s/g, '').toLowerCase()}@shelflife.com`);
  }
  // Manager and Inventory Staff may read their address but cannot start or finish a self-service
  // change, even with the correct password, and no code may be generated for them.
  for (const role of ['Manager', 'Inventory Staff']) {
    const f = await fixture(role);
    await assert.rejects(f.service.request(f.row._id.toString(), { email: 'blocked@shelflife.com', currentPassword: 'current-password-123' }), error => error.status === 403);
    assert.equal(f.delivered(), undefined);
    await assert.rejects(f.service.complete(f.row._id.toString(), { code: '123456' }), error => error.status === 403);
    assert.equal(f.row.email, 'old@shelflife.com');
  }
});

test('email change codes expire, allow five attempts, and are cleared when delivery fails', async () => {
  const f = await fixture();
  await f.service.request(f.row._id.toString(), { email: 'new@shelflife.com', currentPassword: 'current-password-123' });
  f.advance(600001);
  await assert.rejects(f.service.complete(f.row._id.toString(), { code: f.delivered().code }));
  const failed = await fixture();
  const service = createEmailChange({ ...{
    byIdWithSecrets: async () => failed.row, emailExists: async () => false,
    stage: async () => true, fail: async () => 0, activate: async () => false,
    clear: async () => { failed.row.cleared = true; },
  } }, { send: async () => { throw new Error('offline'); } });
  await assert.rejects(service.request(failed.row._id.toString(), { email: 'new@shelflife.com', currentPassword: 'current-password-123' }), error => error.status === 503);
  assert.equal(failed.row.cleared, true);
});

test('email change throttles resend, locks after five failures, and discloses no code', async () => {
  const f = await fixture();
  const response = await f.service.request(f.row._id.toString(), { email: 'new@shelflife.com', currentPassword: 'current-password-123' });
  assert.equal(JSON.stringify(response).includes(f.delivered().code), false);
  await assert.rejects(f.service.request(f.row._id.toString(), { email: 'other@shelflife.com', currentPassword: 'current-password-123' }), error => error.status === 429);
  for (let attempt = 1; attempt <= 4; attempt++)
    await assert.rejects(f.service.complete(f.row._id.toString(), { code: '000000' }), error => error.status === 400);
  await assert.rejects(f.service.complete(f.row._id.toString(), { code: '000000' }), error => error.status === 429);
  await assert.rejects(f.service.complete(f.row._id.toString(), { code: f.delivered().code }), error => error.status === 429);
  assert.equal(f.row.email, 'old@shelflife.com');
});
