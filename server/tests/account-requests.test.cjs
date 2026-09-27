const { test } = require('node:test');
const assert = require('node:assert/strict');
const { createServer } = require('node:http');
const { once } = require('node:events');
const { randomBytes } = require('node:crypto');
const { createApp } = require('../dist/app');
const { createAuth } = require('../dist/services/auth');
const { createAdministration } = require('../dist/services/administration');
const { canReviewAccountRequest } = require('../dist/services/account-requests');
const { AdministrationError } = require('../dist/middleware/administration.middleware');
const { accountRequestInput, accountRequestReview } = require('../dist/validators/account-request');
const { accountInput } = require('../dist/validators/administration');

const roles = ['Super Admin', 'Admin', 'Inventory Manager', 'Inventory Staff'];
const users = roles.map((role, index) => ({ id: String(index + 1).repeat(24), _id: String(index + 1).repeat(24), firstName: 'Test', lastName: role, name: role, email: `${index}@shelflife.com`, role, isActive: true, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() }));
const accountBody = (role = 'Inventory Staff') => ({ firstName: 'New', lastName: 'Account', email: `new-${role.replaceAll(' ', '').toLowerCase()}@shelflife.com`, role });

test('account request input follows requester roles; approvals require an initial password', () => {
  assert.equal(accountRequestInput(accountBody('Inventory Manager'), 'Inventory Staff').role, 'Inventory Manager');
  assert.equal(accountRequestInput(accountBody('Admin'), 'Admin').role, 'Admin');
  assert.throws(() => accountRequestInput(accountBody('Admin'), 'Inventory Manager'), error => error.status === 400);
  assert.throws(() => accountRequestInput(accountBody('Super Admin'), 'Inventory Staff'), error => error.status === 400);
  assert.deepEqual(accountRequestReview({ decision: 'Rejected', expectedVersion: 0 }), { decision: 'Rejected', expectedVersion: 0, note: '' });
  assert.equal(accountRequestReview({ decision: 'Approved', expectedVersion: 1, password: 'initial-password-12' }).password, 'initial-password-12');
  for (const body of [{ decision: 'Approved', expectedVersion: 0 }, { decision: 'Approved', expectedVersion: 0, password: '          ' }, { decision: 'Rejected', expectedVersion: 0, password: 'initial-password-12' }, { decision: 'Approved', expectedVersion: -1, password: 'initial-password-12' }]) assert.throws(() => accountRequestReview(body));
});

test('Admin-originated requests and Admin-role requests require Super Admin approval', () => {
  const staffRequest = { requestedByRole: 'Inventory Staff', role: 'Inventory Manager' };
  const managerRequest = { requestedByRole: 'Inventory Manager', role: 'Inventory Staff' };
  const adminRequest = { requestedByRole: 'Admin', role: 'Inventory Staff' };
  const adminTarget = { requestedByRole: 'Inventory Staff', role: 'Admin' };
  for (const request of [staffRequest, managerRequest]) {
    assert.equal(canReviewAccountRequest(users[1], request), true);
    assert.equal(canReviewAccountRequest(users[0], request), true);
  }
  for (const request of [adminRequest, adminTarget]) {
    assert.equal(canReviewAccountRequest(users[1], request), false);
    assert.equal(canReviewAccountRequest(users[0], request), true);
  }
  assert.equal(canReviewAccountRequest(users[2], staffRequest), false);
  assert.equal(canReviewAccountRequest(users[3], staffRequest), false);
});

test('account request routes are reachable to requesters while direct user creation remains Super Admin-only', async t => {
  let requests = [];
  const store = {
    get: async id => users.find(user => user.id === id) || null,
    list: async () => ({ items: users, page: 1, pageSize: 25, total: users.length }),
    summary: async () => ({ totalUsers: users.length, activeUsers: users.length, inactiveUsers: 0 }),
    audits: async () => ({ items: [], page: 1, pageSize: 25, total: 0 }),
    transaction: async work => work({ get: async id => users.find(user => user.id === id) || null, create: async () => { throw new Error('unexpected account creation'); }, update: async () => null, audit: async () => {} }),
  };
  const administration = createAdministration(store);
  const accountRequests = {
    async list(actor) { return { items: requests.filter(row => actor.role === 'Super Admin' || row.requestedBy.id === actor.id), total: requests.length }; },
    async create(actor, input) { const row = { id: String(requests.length + 1).repeat(24), ...input, requestedBy: { id: actor.id, name: actor.role, role: actor.role }, status: 'Pending', version: 0 }; requests.push(row); return row; },
    async review(actor, id, input) {
      const row = requests.find(item => item.id === id);
      if (!row || !canReviewAccountRequest(actor, row)) throw new AdministrationError(403, 'FORBIDDEN', 'This action is not permitted');
      row.status = input.decision; return row;
    },
  };
  const auth = createAuth({ byId: async id => users.find(user => user.id === id) || null, byEmail: async () => null }, randomBytes(48).toString('hex'));
  const app = createApp([], () => true, auth, undefined, administration, undefined, undefined, undefined, undefined, undefined, accountRequests);
  const server = createServer(app);
  t.after(() => { server.closeAllConnections(); server.close(); });
  server.listen(0, '127.0.0.1'); await once(server, 'listening');
  const base = `http://127.0.0.1:${server.address().port}/api`;
  const call = (user, path, method = 'GET', body) => fetch(`${base}${path}`, { method, headers: { Authorization: `Bearer ${auth.issue(user).accessToken}`, 'Content-Type': 'application/json' }, ...(body === undefined ? {} : { body: JSON.stringify(body) }) });

  assert.equal((await call(users[3], '/account-requests', 'POST', accountBody())).status, 201);
  assert.equal((await call(users[2], '/account-requests', 'POST', accountBody('Inventory Manager'))).status, 201);
  const adminRequest = await call(users[1], '/account-requests', 'POST', accountBody('Admin'));
  assert.equal(adminRequest.status, 201);
  const adminRequestId = (await adminRequest.json()).request.id;
  const directCreate = await call(users[1], '/users', 'POST', { ...accountInput({ ...accountBody('Inventory Staff'), password: 'initial-password-12' }, true) });
  const directCreateBody = await directCreate.text();
  assert.equal(directCreate.status, 403, `Admin direct create response: ${directCreateBody || 'empty body'}`);
  assert.equal((await call(users[1], `/account-requests/${adminRequestId}/review`, 'PATCH', { decision: 'Approved', expectedVersion: 0, password: 'initial-password-12' })).status, 403);
  assert.equal((await call(users[0], `/account-requests/${adminRequestId}/review`, 'PATCH', { decision: 'Approved', expectedVersion: 0, password: 'initial-password-12' })).status, 200);
  assert.equal((await call(users[0], '/account-requests')).status, 200);
});