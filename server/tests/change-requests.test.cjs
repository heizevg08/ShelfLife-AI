const { test } = require('node:test');
const assert = require('node:assert/strict');
const { createServer } = require('node:http');
const { once } = require('node:events');
const { randomBytes } = require('node:crypto');
const { createApp } = require('../dist/app');
const { createAuth } = require('../dist/services/auth');
const { changeRequestInput, changeRequestQuery, reviewInput } = require('../dist/validators/change-request');

const staff = { id: '1'.repeat(24), _id: '1'.repeat(24), name: 'Staff', email: 'staff@shelflife.com', role: 'Inventory Staff', isActive: true, authVersion: 0 };
const manager = { ...staff, id: '2'.repeat(24), _id: '2'.repeat(24), name: 'Manager', email: 'manager@shelflife.com', role: 'Manager' };
const batch = '3'.repeat(24), ingredient = '4'.repeat(24);

test('Batch Correction accepts canonical targets and rejects unsupported or client-owned fields', () => {
  const valid = changeRequestInput({ requestType: 'BATCH_CORRECTION', ingredientId: ingredient, batchId: batch, targetField: 'expirationDate', requestedValue: '2030-01-01', reason: 'Correct expiry' });
  assert.equal(valid.targetField, 'expirationDate');
  assert.throws(() => changeRequestInput({ ...valid, targetField: 'quantity' }));
  assert.throws(() => changeRequestInput({ ...valid, currentValue: 'client value' }));
});

test('Quantity Adjustment requires a batch and a finite positive requested quantity', () => {
  assert.equal(changeRequestInput({ requestType: 'QUANTITY_ADJUSTMENT', ingredientId: ingredient, batchId: batch, requestedQuantity: 8, reason: 'Count corrected' }).requestedQuantity, 8);
  assert.throws(() => changeRequestInput({ requestType: 'QUANTITY_ADJUSTMENT', ingredientId: ingredient, requestedQuantity: 8, reason: 'Count corrected' }));
  assert.throws(() => changeRequestInput({ requestType: 'QUANTITY_ADJUSTMENT', ingredientId: ingredient, batchId: batch, requestedQuantity: 0, reason: 'Count corrected' }));
  assert.throws(() => changeRequestInput({ requestType: 'QUANTITY_ADJUSTMENT', ingredientId: ingredient, batchId: batch, requestedQuantity: 8, unit: 'kg', reason: 'Count corrected' }));
});

test('Unit Correction derives current unit, requires a canonical requested unit, and rejects batch fields', () => {
  assert.equal(changeRequestInput({ requestType: 'UNIT_CORRECTION', ingredientId: ingredient, requestedUnit: 'kg', reason: 'Correct unit' }).requestedUnit, 'kg');
  assert.throws(() => changeRequestInput({ requestType: 'UNIT_CORRECTION', ingredientId: ingredient, requestedUnit: 'bucket', reason: 'Correct unit' }));
  assert.throws(() => changeRequestInput({ requestType: 'UNIT_CORRECTION', ingredientId: ingredient, batchId: batch, requestedUnit: 'kg', reason: 'Correct unit' }));
});

test('Add Missing Batch accepts only structured proposed batch data and rejects client Batch IDs', () => {
  const valid = changeRequestInput({ requestType: 'ADD_MISSING_BATCH', ingredientId: ingredient, proposedBatch: { dateReceived: '2030-01-01', quantityReceived: 5, expirationDate: '2030-01-10', unitCost: 0 }, reason: 'Missing receipt' });
  assert.equal(valid.proposedBatch.quantityReceived, 5);
  assert.throws(() => changeRequestInput({ requestType: 'ADD_MISSING_BATCH', ingredientId: ingredient, batchId: batch, proposedBatch: { dateReceived: '2030-01-01', quantityReceived: 5, expirationDate: '2030-01-10' }, reason: 'Missing receipt' }));
  assert.throws(() => changeRequestInput({ requestType: 'ADD_MISSING_BATCH', ingredientId: ingredient, proposedBatch: { dateReceived: '2030-01-10', quantityReceived: 5, expirationDate: '2030-01-01' }, reason: 'Missing receipt' }));
  assert.throws(() => changeRequestInput({ requestType: 'ADD_MISSING_BATCH', ingredientId: ingredient, proposedBatch: { dateReceived: '2030-01-01', quantityReceived: 5, expirationDate: '2030-01-10', arbitrary: true }, reason: 'Missing receipt' }));
});

test('Other accepts an optional inventory target and rejects generic correction fields', () => {
  assert.equal(changeRequestInput({ requestType: 'OTHER', requestDescription: 'Review this record', reason: 'Incorrect label' }).requestDescription, 'Review this record');
  assert.equal(changeRequestInput({ requestType: 'OTHER', ingredientId: ingredient, requestDescription: 'Review this record', reason: 'Incorrect label' }).ingredientId, ingredient);
  assert.throws(() => changeRequestInput({ requestType: 'OTHER', requestDescription: 'Review this record', targetField: 'expirationDate', reason: 'Incorrect label' }));
});

test('Change request validator rejects client-owned fields, incompatible targets, and malformed request data', () => {
  assert.deepEqual(changeRequestInput({ requestType: 'QUANTITY_ADJUSTMENT', ingredientId: ingredient, batchId: batch, requestedQuantity: 8, reason: 'Count corrected' }), { requestType: 'QUANTITY_ADJUSTMENT', ingredientId: ingredient, batchId: batch, requestedQuantity: 8, reason: 'Count corrected' });
  for (const body of [
    { requestType: 'QUANTITY_ADJUSTMENT', ingredientId: ingredient, batchId: batch, requestedQuantity: Infinity, reason: 'x' },
    { requestType: 'OTHER', requestDescription: 'Need review', reason: ' ', status: 'APPROVED' },
    { requestType: 'BATCH_CORRECTION', ingredientId: ingredient, batchId: 'not-an-id', targetField: 'expirationDate', requestedValue: '2030-01-01', reason: 'x' },
  ]) assert.throws(() => changeRequestInput(body));
  assert.equal(changeRequestQuery({ page: '2', pageSize: '15', type: 'OTHER', status: 'PENDING' }).page, 2);
  assert.throws(() => changeRequestQuery({ page: '1', pageSize: '12' }));
  assert.throws(() => reviewInput({ reviewNote: '   ' }, true));
  assert.deepEqual(reviewInput({ reviewNote: 'Needs evidence' }, true), { reviewNote: 'Needs evidence' });
});

test('Change request API scopes staff creation, returns safe field errors, and reserves review for Managers', async () => {
  let created;
  let listed;
  const service = {
    async summary() { return { totalRequests: 0, approved: 0, pending: 0, rejected: 0 }; },
    async list(actor, query) { listed = { actor, query }; return { items: [], page: query.page, pageSize: query.pageSize, total: 4 }; },
    async detail() { return { id: '5'.repeat(24) }; },
    async create(actor, input) { created = { actor, input }; return { id: '5'.repeat(24), requestID: 'REQ-20300110-001' }; },
    async review() { return { id: '5'.repeat(24), status: 'APPROVED' }; },
  };
  const auth = createAuth({ byId: async id => [staff, manager].find(user => user.id === id) || null, byEmail: async () => null }, randomBytes(48).toString('hex'));
  const app = createApp([], () => true, auth, undefined, undefined, undefined, undefined, undefined, undefined, service);
  const http = createServer(app); http.listen(0, '127.0.0.1'); await once(http, 'listening');
  const base = `http://127.0.0.1:${http.address().port}/api/change-requests`;
  const request = (user, path = '', method = 'GET', body) => fetch(base + path, { method, headers: { ...(user ? { Authorization: `Bearer ${auth.issue(user).accessToken}` } : {}), ...(body ? { 'Content-Type': 'application/json' } : {}) }, ...(body ? { body: JSON.stringify(body) } : {}) });
  try {
    const managerList = await request(manager, '?page=1&pageSize=10&status=PENDING');
    assert.equal(managerList.status, 200);
    assert.deepEqual(await managerList.json(), { items: [], page: 1, pageSize: 10, total: 4 });
    assert.equal(listed.actor.id, manager.id);
    assert.equal(listed.query.status, 'PENDING');
    assert.equal((await request(manager, '?page=1&pageSize=5&status=PENDING')).status, 400);
    assert.equal((await request(manager, '', 'POST', { requestType: 'OTHER', requestDescription: 'Review', reason: 'Reason' })).status, 403);
    const bad = await request(staff, '', 'POST', { requestType: 'OTHER', requestDescription: 'Review', reason: ' ', reviewedBy: manager.id });
    assert.equal(bad.status, 400); assert.deepEqual((await bad.json()).error.details, [{ field: 'reviewedBy', message: 'Field is not permitted' }]);
    const createdResponse = await request(staff, '', 'POST', { requestType: 'OTHER', requestDescription: 'Review a label', reason: 'Incorrect wording' });
    assert.equal(createdResponse.status, 201); assert.equal(created.actor.id, staff.id); assert.equal(created.input.status, undefined);
    assert.equal((await request(staff, '/' + '5'.repeat(24) + '/approve', 'POST', {})).status, 403);
    assert.equal((await request(manager, '/' + '5'.repeat(24) + '/approve', 'POST', {})).status, 200);
  } finally { http.closeAllConnections(); await new Promise(resolve => http.close(resolve)); }
});
