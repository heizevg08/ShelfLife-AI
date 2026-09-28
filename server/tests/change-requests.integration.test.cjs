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
  const staff = await Users.create({ email: 'staff@test.shelflife.com', firstName: 'Staff', lastName: 'A', passwordHash: 'scrypt$131072$8$1$aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa$aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa', role: 'Inventory Staff' });
  const ingredient = await Ingredients.create({ name: 'Integration Ingredient', category: 'Test', unitOfMeasure: 'kg', createdBy: staff._id });
  const batch = await Batches.create({ ingredientId: ingredient._id, batchID: 'INT-001', quantity: 10, unit: 'kg', dateReceived: new Date(), expirationDate: new Date('2030-01-01'), createdBy: staff._id });
  const service = createChangeRequests(driver, Requests, Counters, Ingredients, Batches, Users, Audits);
  const actor = { id: staff._id.toString(), name: 'Staff A', role: 'Inventory Staff' };
  const input = { requestType: 'QUANTITY_ADJUSTMENT', ingredientId: ingredient._id.toString(), batchId: batch._id.toString(), targetField: 'quantity', currentValue: '10 kg', requestedValue: '8 kg', reason: 'Count correction' };
  const [one, two] = await Promise.all([service.create(actor, input), service.create(actor, input)]);
  assert.match(one.requestID, /^REQ-\d{8}-\d{3}$/); assert.notEqual(one.requestID, two.requestID);
  const stored = await Requests.findById(one.id).lean(); assert.equal(stored.status, 'PENDING'); assert.equal(stored.requestedBy.toString(), actor.id); assert.equal(stored.reviewedBy, undefined);
  assert.equal(await Audits.countDocuments({ targetType: 'ChangeRequest', targetName: one.requestID }), 1);
});
