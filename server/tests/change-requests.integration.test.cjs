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
  const input = { requestType: 'MINIMUM_STOCK_CHANGE', ingredientId: ingredient._id.toString(), targetField: 'minimumStock', requestedValue: '8', reason: 'Correct minimum stock' };
  const [one, two] = await Promise.all([service.create(actor, input), service.create(actor, input)]);
  assert.match(one.requestID, /^REQ-\d{8}-\d{3}$/); assert.notEqual(one.requestID, two.requestID);
  assert.equal(one.currentValue, '2'); assert.equal(one.requestedValue, '8'); assert.equal(one.targetField, 'minimumStock'); assert.equal(one.requestedBy.name, 'Development Inventory Staff');
  const stored = await Requests.findById(one.id).lean(); assert.equal(stored.status, 'PENDING'); assert.equal(stored.currentValue, '2'); assert.equal(stored.requestedValue, '8'); assert.equal(stored.requestedBy.toString(), actor.id); assert.equal(stored.reviewedBy, undefined);
  assert.equal(await Audits.countDocuments({ targetType: 'ChangeRequest', targetName: one.requestID }), 1);
  const reviewed = await service.review({ id: manager._id.toString(), name: 'Fallback Manager', role: 'Manager' }, one.id, 'APPROVED');
  assert.equal(reviewed.reviewedBy.name, 'Development Manager');
  assert.equal((await Ingredients.findById(ingredient._id).lean()).minimumStock, 8);
  assert.equal((await Batches.findById(batch._id).lean()).quantity, 10);
  const legacy = await Requests.create({ requestID: 'REQ-LEGACY-001', requestType: 'QUANTITY_ADJUSTMENT', ingredientId: ingredient._id, targetField: 'minimumStock', currentValue: '8', requestedValue: '9', reason: 'Legacy fixture', requestedBy: staff._id, status: 'PENDING' });
  await assert.rejects(() => service.review({ id: manager._id.toString(), name: 'Development Manager', role: 'Manager' }, legacy._id.toString(), 'APPROVED'), error => error.code === 'CONFLICT' && /Legacy requests/.test(error.message));
  assert.equal((await Requests.findById(legacy._id).lean()).status, 'PENDING');
});
