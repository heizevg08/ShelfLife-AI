const { test } = require('node:test');
const assert = require('node:assert/strict');
const { createServer } = require('node:http');
const { once } = require('node:events');
const { randomBytes } = require('node:crypto');
const { typedChangeRequestInput, typedChangeRequestQuery, typedReviewInput } = require('../dist/validators/change-request');
const { manilaDateKey } = require('../dist/services/change-requests');
const { createAuth } = require('../dist/services/auth');
const { createApp } = require('../dist/app');

const staffRequest = { requestType: 'MINIMUM_STOCK_CHANGE', ingredientId: '1'.repeat(24), requestedValue: '1.005', reason: 'The current minimum is too low for weekly ordering.' };

test('typed change request validation rejects spoofing and enforces stored Number precision', () => {
  assert.deepEqual(typedChangeRequestInput(staffRequest), { ...staffRequest, targetField: 'minimumStock' });
  for (const requestedValue of ['1.0005', '1e-7', '-1', 1, '9999999999999999']) {
    assert.throws(() => typedChangeRequestInput({ ...staffRequest, requestedValue }));
  }
  assert.throws(() => typedChangeRequestInput({ ...staffRequest, status: 'APPROVED' }));
  assert.throws(() => typedChangeRequestQuery({ page: '1', unknown: 'value' }));
  assert.deepEqual(typedReviewInput({ expectedVersion: 0 }, false), { expectedVersion: 0, reviewNote: '' });
  assert.throws(() => typedReviewInput({ expectedVersion: 0 }, true));
});

test('request IDs use the Asia/Manila calendar date at midnight', () => {
  assert.equal(manilaDateKey(new Date('2026-10-06T15:59:59.999Z')), '20261006');
  assert.equal(manilaDateKey(new Date('2026-10-06T16:00:00.000Z')), '20261007');
});

test('typed change request HTTP roles keep Super Admin read-only, reject Admin, and remove legacy mutation routes', async t => {
  const users = ['Super Admin', 'Admin', 'Inventory Manager', 'Inventory Staff'].map((role, index) => ({ id: String(index + 1).repeat(24), _id: String(index + 1).repeat(24), email: `${index}@shelflife.com`, role, isActive: true }));
  const auth = createAuth({ byId: async id => users.find(user => user.id === id), byEmail: async () => null }, randomBytes(48).toString('hex'));
  const service = {
    list: async () => ({ items: [], page: 1, limit: 25, total: 0 }), detail: async () => ({ id: '9'.repeat(24), readOnly: false }),
    summary: async () => ({ total: 0, pending: 0, approved: 0, rejected: 0 }), managerSummary: async () => ({ total: 0, pending: 0, approved: 0, rejected: 0 }),
    ingredientOptions: async () => ({ items: [] }), create: async () => ({ id: '9'.repeat(24) }), review: async () => ({ id: '9'.repeat(24) }),
  };
  const server = createServer(createApp([], () => true, auth, undefined, undefined, undefined, undefined, undefined, service));
  t.after(() => { server.closeAllConnections(); server.close(); });
  server.listen(0, '127.0.0.1'); await once(server, 'listening');
  const base = `http://127.0.0.1:${server.address().port}/api/change-requests`;
  const call = (user, method = 'GET', path = '', body) => fetch(base + path, { method, headers: { Authorization: `Bearer ${auth.issue(user).accessToken}`, 'Content-Type': 'application/json' }, ...(body === undefined ? {} : { body: JSON.stringify(body) }) });
  const [superAdmin, admin, manager, staff] = users;
  assert.equal((await call(superAdmin)).status, 200);
  assert.equal((await call(superAdmin, 'GET', `/${'9'.repeat(24)}`)).status, 200);
  for (const path of ['', `/${'9'.repeat(24)}`, '/summary', '/manager-summary', '/ingredient-options']) assert.equal((await call(admin, 'GET', path)).status, 403);
  assert.equal((await call(staff, 'POST', '', staffRequest)).status, 201);
  assert.equal((await call(manager, 'POST', '', staffRequest)).status, 403);
  assert.equal((await call(staff, 'POST', `/${'9'.repeat(24)}/approve`, { expectedVersion: 0 })).status, 403);
  assert.equal((await call(manager, 'POST', `/${'9'.repeat(24)}/approve`, { expectedVersion: 0 })).status, 200);
  assert.equal((await call(superAdmin, 'POST', `/${'9'.repeat(24)}/reject`, { expectedVersion: 0, reviewNote: 'No.' })).status, 403);
  assert.equal((await call(staff, 'PATCH', `/${'9'.repeat(24)}`, staffRequest)).status, 404);
  assert.equal((await call(staff, 'DELETE', `/${'9'.repeat(24)}`)).status, 404);
});
