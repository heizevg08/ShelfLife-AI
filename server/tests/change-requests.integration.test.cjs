const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const { Mongoose } = require('mongoose');
const { MongoMemoryReplSet } = require('mongodb-memory-server');
const { changeRequestModel } = require('../dist/models/change-request');
const { changeRequestCounterModel } = require('../dist/models/change-request-counter');
const { userModel } = require('../dist/models/user');
const { ingredientModel } = require('../dist/models/ingredient');
const { inventoryBatchModel } = require('../dist/models/inventory-batch');
const { auditRecordModel } = require('../dist/models/audit-record');
const { createChangeRequests } = require('../dist/services/change-requests');

let replica; let driver;
before(async () => {
  replica = await MongoMemoryReplSet.create({ replSet: { count: 1, storageEngine: 'wiredTiger' } });
  const uri = replica.getUri('shelflifeai_test_change_requests');
  assert.match(uri, /shelflifeai_test_change_requests/);
  assert.doesNotMatch(uri, /shelflifeai(?:\?|$|\/)/);
  driver = new Mongoose();
  await driver.connect(uri);
});
after(async () => { await driver?.disconnect(); await replica?.stop(); });

test('Change Request integration harness uses an isolated transaction-capable replica set and initializes unique indexes', async () => {
  const requests = changeRequestModel(driver), counters = changeRequestCounterModel(driver);
  await Promise.all([requests.init(), counters.init()]);
  const indexes = await requests.collection.indexes();
  assert.ok(indexes.some(index => index.unique && index.key.requestID === 1));
  await driver.connection.transaction(async session => {
    await counters.create([{ dateKey: '20990101', sequence: 1 }], { session });
  });
  assert.equal(await counters.countDocuments({ dateKey: '20990101' }), 1);
});

test('real Change Request creation persists server-owned state, audit, and unique sequential IDs', async () => {
  const Users = userModel(driver), Ingredients = ingredientModel(driver), Batches = inventoryBatchModel(driver), Requests = changeRequestModel(driver), Counters = changeRequestCounterModel(driver), Audits = auditRecordModel(driver);
  await Promise.all([Users.init(), Ingredients.init(), Batches.init(), Requests.init(), Counters.init()]);
  const staff = await Users.create({ email: 'staff@shelflife.com', firstName: 'Development', lastName: 'Inventory Staff', passwordHash: 'scrypt$131072$8$1$aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa$aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa', role: 'Inventory Staff' });
  const manager = await Users.create({ email: 'manager@shelflife.com', firstName: 'Development', lastName: 'Manager', passwordHash: 'scrypt$131072$8$1$bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb$bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb', role: 'Manager' });
  const ingredient = await Ingredients.create({ name: 'Integration Ingredient', category: 'Meat', unitOfMeasure: 'kg', minimumStock: 2, createdBy: staff._id });
  const batch = await Batches.create({ ingredientId: ingredient._id, batchID: 'INT-001', quantity: 10, unit: 'kg', dateReceived: new Date(), expirationDate: new Date('2030-01-01'), createdBy: staff._id });
  const service = createChangeRequests(driver, Requests, Counters, Ingredients, Batches, Users, Audits);
  const actor = { id: staff._id.toString(), name: 'Fallback Username', role: 'Inventory Staff' };
  const options = await service.ingredientOptions(actor); assert.equal(options.ingredients.length, 1); assert.equal(options.ingredients[0].minimumStock, 2); assert.equal(options.ingredients[0].unitOfMeasure, 'kg');
  const input = { requestType: 'MINIMUM_STOCK_CHANGE', ingredientId: ingredient._id.toString(), targetField: 'minimumStock', requestedValue: '8', reason: 'Correct minimum stock' };
  const [one, two] = await Promise.all([service.create(actor, input), service.create(actor, input)]);
  assert.match(one.requestID, /^REQ-\d{8}-\d{3}$/); assert.notEqual(one.requestID, two.requestID);
  assert.equal(one.currentValue, '2'); assert.equal(one.requestedValue, '8'); assert.equal(one.targetField, 'minimumStock'); assert.equal(one.requestedBy.name, 'Development Inventory Staff');
  const stored = await Requests.findById(one.id).lean(); assert.equal(stored.status, 'PENDING'); assert.equal(stored.currentValue, '2'); assert.equal(stored.requestedValue, '8'); assert.equal(stored.requestedBy.toString(), actor.id); assert.equal(stored.reviewedBy, undefined);
  assert.equal(await Audits.countDocuments({ targetType: 'ChangeRequest', targetName: one.requestID }), 1);
  const now = new Date(), periodStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() - 29)), periodEnd = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1));
  const staffRequests = await service.list(actor, { page: 1, pageSize: 10, currentOnly: true });
  const managerActor = { id: manager._id.toString(), name: 'Fallback Manager', role: 'Manager' };
  const managerRequests = await service.list(managerActor, { page: 1, pageSize: 10, currentOnly: true, from: periodStart, to: periodEnd });
  const managerPending = await service.list(managerActor, { page: 1, pageSize: 10, currentOnly: true, status: 'PENDING', from: periodStart, to: periodEnd });
  assert.equal(staffRequests.total, 2); assert.equal(managerRequests.total, 2); assert.equal(managerPending.total, 2);
  assert.ok(staffRequests.items.some(item => item.requestID === one.requestID)); assert.ok(managerRequests.items.some(item => item.requestID === one.requestID));
  assert.equal(managerRequests.items.find(item => item.requestID === one.requestID).requestedBy.name, 'Development Inventory Staff');
  await Requests.collection.updateOne({ _id: new driver.Types.ObjectId(two.id) }, { $set: { createdAt: new Date('2020-01-01T00:00:00.000Z') } });
  const backlogSummary = await service.managerSummary(managerActor, { from: periodStart, to: periodEnd });
  assert.deepEqual(backlogSummary, { totalRequests: 1, pending: 2, approved: 0, rejected: 0 });
  const reviewed = await service.review({ id: manager._id.toString(), name: 'Fallback Manager', role: 'Manager' }, one.id, 'APPROVED');
  assert.equal(reviewed.reviewedBy.name, 'Development Manager');
  assert.equal((await Ingredients.findById(ingredient._id).lean()).minimumStock, 8);
  assert.equal((await Batches.findById(batch._id).lean()).quantity, 10);
  const rejected = await service.review(managerActor, two.id, 'REJECTED', 'The requested value is not supported.');
  assert.equal(rejected.status, 'REJECTED'); assert.equal(rejected.reviewNote, 'The requested value is not supported.');
  assert.equal((await Ingredients.findById(ingredient._id).lean()).minimumStock, 8);
  await assert.rejects(() => service.review(managerActor, two.id, 'REJECTED', 'Again'), error => error.code === 'CONFLICT');
  const decidedSummary = await service.managerSummary(managerActor, { from: periodStart, to: periodEnd });
  assert.deepEqual(decidedSummary, { totalRequests: 1, pending: 0, approved: 1, rejected: 1 });
  assert.equal(await Audits.countDocuments({ targetType: 'ChangeRequest', targetId: { $in: [one.id, two.id] }, action: 'UPDATE' }), 2);
  const legacy = await Requests.create({ requestID: 'REQ-LEGACY-001', requestType: 'QUANTITY_ADJUSTMENT', ingredientId: ingredient._id, targetField: 'minimumStock', currentValue: '8', requestedValue: '9', reason: 'Legacy fixture', requestedBy: staff._id, status: 'PENDING' });
  const actionable = await service.list({ id: manager._id.toString(), name: 'Development Manager', role: 'Manager' }, { page: 1, pageSize: 10, status: 'PENDING', currentOnly: true });
  assert.equal(actionable.total, 0);
  assert.ok(actionable.items.every(item => !item.requestType.startsWith('QUANTITY_')));
  await assert.rejects(() => service.review({ id: manager._id.toString(), name: 'Development Manager', role: 'Manager' }, legacy._id.toString(), 'APPROVED'), error => error.code === 'CONFLICT' && /Legacy requests/.test(error.message));
  assert.equal((await Requests.findById(legacy._id).lean()).status, 'PENDING');
});
