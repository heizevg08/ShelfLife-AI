const { test } = require('node:test');
const assert = require('node:assert/strict');
const { createServer } = require('node:http');
const { once } = require('node:events');
const { randomBytes } = require('node:crypto');
const { changeRequestInput, changeRequestPatch, changeRequestId } = require('../dist/validators/change-request');
const { createChangeRequests } = require('../dist/services/change-requests');
const { createAuth } = require('../dist/services/auth');
const { createApp } = require('../dist/app');

function fixture() {
  const records = [];
  const objectId = value => ({ toString: () => value });
  const chain = operation => ({ sort: () => chain(operation), limit: () => chain(operation), lean: () => chain(operation), exec: operation });
  const rows = {
    create: async values => values.map(value => {
      const now = new Date(), row = { ...value, _id: objectId(String(records.length + 9).padStart(24, '0')), status: 'Pending', version: 0, createdAt: now, updatedAt: now };
      records.push(row);
      return { toObject: () => row };
    }),
    find: filter => chain(async () => records.filter(row => !filter.createdBy || row.createdBy.toString() === filter.createdBy).map(row => ({ ...row }))),
    countDocuments: filter => ({ exec: async () => records.filter(row => !filter.createdBy || row.createdBy.toString() === filter.createdBy).length }),
    findOneAndUpdate: (filter, change) => chain(async () => {
      const row = records.find(value => value._id.toString() === filter._id && value.createdBy.toString() === filter.createdBy && value.status === filter.status && value.version === filter.version);
      if (!row) return null;
      Object.assign(row, change.$set, { version: row.version + change.$inc.version, updatedAt: new Date() });
      return { ...row };
    }),
    findOneAndDelete: filter => chain(async () => {
      const index = records.findIndex(row => row._id.toString() === filter._id && row.createdBy.toString() === filter.createdBy && row.status === filter.status);
      return index < 0 ? null : records.splice(index, 1)[0];
    }),
  };
  return { records, service: createChangeRequests(rows) };
}

const valid = { target: 'Batch B-1', type: 'Quantity correction', proposedCorrection: 'Set quantity to 8 kg', reason: 'Recount confirmed the total' };

test('change request inputs allow only request fields and reject approval/status spoofing', () => {
  assert.deepEqual(changeRequestInput(valid), valid);
  assert.deepEqual(changeRequestPatch({ ...valid, expectedVersion: 0 }), { patch: valid, expectedVersion: 0 });
  assert.deepEqual(changeRequestPatch({ target: 'Batch B-2', expectedVersion: 0 }), { patch: { target: 'Batch B-2' }, expectedVersion: 0 });
  assert.throws(() => changeRequestPatch({ expectedVersion: 0 }));
  for (const body of [{ ...valid, status: 'Approved' }, { ...valid, createdBy: '1'.repeat(24) }, { ...valid, version: 4 }, { ...valid, reason: ' ' }]) assert.throws(() => changeRequestInput(body));
  assert.throws(() => changeRequestPatch({ ...valid, expectedVersion: -1 }));
  assert.throws(() => changeRequestId('not-an-id'));
});

test('staff can manage only their own pending requests while reviewers can list all', async () => {
  const { records, service } = fixture();
  const staff = { id: '1'.repeat(24), role: 'Inventory Staff' }, other = { id: '2'.repeat(24), role: 'Inventory Staff' }, manager = { id: '3'.repeat(24), role: 'Inventory Manager' };
  const created = await service.create(staff, valid);
  assert.equal(created.status, 'Pending');
  await service.create(other, { ...valid, target: 'Batch B-2' });
  assert.equal((await service.list(staff)).total, 1);
  assert.equal((await service.list(manager)).total, 2);
  await assert.rejects(service.create(manager, valid), error => error.status === 403);
  await assert.rejects(service.update(other, created.id, { ...valid, expectedVersion: 0 }), error => error.status === 404);
  const updated = await service.update(staff, created.id, { ...valid, proposedCorrection: 'Set quantity to 7 kg', expectedVersion: 0 });
  assert.equal(updated.version, 1);
  await assert.rejects(service.update(staff, created.id, { ...valid, expectedVersion: 0 }), error => error.status === 404);
  records[0].status = 'Approved';
  await assert.rejects(service.update(staff, created.id, { ...valid, expectedVersion: 1 }), error => error.status === 404);
  await assert.rejects(service.remove(staff, created.id), error => error.status === 404);
});

test('request API denies staff approval paths and limits writes to staff-owned CRUD', async t => {
  const { service } = fixture();
  const users = ['Super Admin', 'Admin', 'Inventory Manager', 'Inventory Staff'].map((role, index) => ({ id: String(index + 1).repeat(24), _id: String(index + 1).repeat(24), email: `${index}@shelflife.com`, role, isActive: true }));
  const auth = createAuth({ byId: async id => users.find(user => user.id === id), byEmail: async () => null }, randomBytes(48).toString('hex'));
  const server = createServer(createApp([], () => true, auth, undefined, undefined, undefined, undefined, undefined, service));
  t.after(() => { server.closeAllConnections(); server.close(); });
  server.listen(0, '127.0.0.1'); await once(server, 'listening');
  const base = `http://127.0.0.1:${server.address().port}/api/change-requests`;
  const request = (user, method = 'GET', path = '', body) => fetch(base + path, { method, headers: { Authorization: `Bearer ${auth.issue(user).accessToken}`, 'Content-Type': 'application/json' }, ...(body === undefined ? {} : { body: JSON.stringify(body) }) });
  const staff = users[3], manager = users[2], created = await request(staff, 'POST', '', valid);
  assert.equal(created.status, 201);
  const id = (await created.json()).request.id;
  assert.equal((await request(manager, 'POST', '', valid)).status, 403);
  assert.equal((await request(manager, 'PATCH', `/${id}`, { ...valid, expectedVersion: 0 })).status, 403);
  assert.equal((await request(manager, 'DELETE', `/${id}`)).status, 403);
  assert.equal((await request(staff, 'POST', `/${id}/approve`)).status, 404);
  assert.equal((await request(staff, 'POST', '', { ...valid, status: 'Approved' })).status, 400);
});
