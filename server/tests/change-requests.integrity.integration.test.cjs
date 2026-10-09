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

// Disposable in-memory replica set: transactions are supported and the real
// production database is never touched. Isolation is asserted, not assumed.
let replica; let driver;
before(async () => {
  replica = await MongoMemoryReplSet.create({ replSet: { count: 1, storageEngine: 'wiredTiger' } });
  const uri = replica.getUri('shelflifeai_test_change_request_integrity');
  assert.match(uri, /shelflifeai_test_change_request_integrity/);
  assert.doesNotMatch(uri, /shelflifeai(?:\?|$|\/)/);
  driver = new Mongoose();
  await driver.connect(uri);
});
after(async () => { await driver?.disconnect(); await replica?.stop(); });

const models = () => ({ Users: userModel(driver), Ingredients: ingredientModel(driver), Batches: inventoryBatchModel(driver), Requests: changeRequestModel(driver), Counters: changeRequestCounterModel(driver), Audits: auditRecordModel(driver) });

async function seed(name, minimumStock) {
  const { Users, Ingredients, Batches, Requests, Counters, Audits } = models();
  await Promise.all([Users.init(), Ingredients.init(), Batches.init(), Requests.init(), Counters.init()]);
  const passwordHash = 'scrypt$131072$8$1$aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa$' + 'a'.repeat(128);
  const staff = await Users.create({ email: `staff.${Date.now()}.${Math.random()}@shelflife.com`, firstName: 'Integrity', lastName: 'Staff', passwordHash, role: 'Inventory Staff' });
  const manager = await Users.create({ email: `manager.${Date.now()}.${Math.random()}@shelflife.com`, firstName: 'Integrity', lastName: 'Manager', passwordHash, role: 'Manager' });
  const ingredient = await Ingredients.create({ name, category: 'Meat', unitOfMeasure: 'kg', minimumStock, createdBy: staff._id });
  await Batches.create({ ingredientId: ingredient._id, batchID: `INT-${Date.now()}-${Math.floor(Math.random() * 1000)}`, quantity: 10, unit: 'kg', dateReceived: new Date(), expirationDate: new Date('2030-01-01'), createdBy: staff._id });
  return { staff, manager, ingredient, Requests, Counters, Ingredients, Audits, Batches, Users };
}

test('a stale ingredient value blocks approval with 409 CONFLICT and never applies the requested value', async () => {
  const { staff, manager, ingredient, Requests, Counters, Ingredients, Audits, Batches } = await seed('Stale Value Ingredient', 2);
  const service = createChangeRequests(driver, Requests, Counters, Ingredients, Batches, models().Users, Audits);
  const staffActor = { id: staff._id.toString(), name: 'Integrity Staff', role: 'Inventory Staff' };
  const managerActor = { id: manager._id.toString(), name: 'Integrity Manager', role: 'Manager' };
  const request = await service.create(staffActor, { requestType: 'MINIMUM_STOCK_CHANGE', ingredientId: ingredient._id.toString(), targetField: 'minimumStock', requestedValue: '8', reason: 'Raise minimum stock' });
  assert.equal(request.currentValue, '2');

  // Someone else changes master data after the request was submitted.
  await Ingredients.collection.updateOne({ _id: ingredient._id }, { $set: { minimumStock: 5 } });

  await assert.rejects(() => service.review(managerActor, request.id, 'APPROVED'), error => error.code === 'CONFLICT' && /changed after this request was submitted/.test(error.message));

  // The requested value (8) must not be applied, the concurrent value (5) must survive.
  assert.equal((await Ingredients.findById(ingredient._id).lean()).minimumStock, 5);
  const stored = await Requests.findById(request.id).lean();
  assert.equal(stored.status, 'PENDING');
  assert.equal(stored.reviewedBy, undefined);
  assert.equal(stored.reviewedAt, undefined);
  // No decision audit was written for the blocked approval.
  assert.equal(await Audits.countDocuments({ targetType: 'ChangeRequest', targetId: request.id, action: 'UPDATE' }), 0);
  assert.equal(await Audits.countDocuments({ targetType: 'Ingredient', targetId: ingredient._id }), 0);
});

test('a failure inside the approval transaction rolls back the ingredient update, request state, and audit records', async () => {
  const { staff, manager, ingredient, Requests, Counters, Ingredients, Audits, Batches, Users } = await seed('Rollback Ingredient', 2);
  const service = createChangeRequests(driver, Requests, Counters, Ingredients, Batches, Users, Audits);
  const staffActor = { id: staff._id.toString(), name: 'Integrity Staff', role: 'Inventory Staff' };
  const managerActor = { id: manager._id.toString(), name: 'Integrity Manager', role: 'Manager' };
  const request = await service.create(staffActor, { requestType: 'MINIMUM_STOCK_CHANGE', ingredientId: ingredient._id.toString(), targetField: 'minimumStock', requestedValue: '8', reason: 'Raise minimum stock' });
  const submissionAudits = await Audits.countDocuments({ targetType: 'ChangeRequest', targetId: request.id, action: 'CREATE' });
  assert.equal(submissionAudits, 1);

  // The service writes the Ingredient audit first, then the ChangeRequest audit.
  // Failing on the second one lands the fault AFTER ingredients.updateOne has run
  // inside the transaction, but BEFORE the transaction completes.
  let auditWrites = 0;
  const auditsFailingOnSecondWrite = {
    create: async (docs, options) => {
      auditWrites += 1;
      if (auditWrites === 2) throw new Error('forced failure after ingredient update');
      return Audits.create(docs, options);
    },
  };
  const faulty = createChangeRequests(driver, Requests, Counters, Ingredients, Batches, Users, auditsFailingOnSecondWrite);

  await assert.rejects(() => faulty.review(managerActor, request.id, 'APPROVED'), /forced failure after ingredient update/);
  assert.equal(auditWrites, 2, 'the fault must land after the ingredient update, not before it');

  // Everything the transaction touched must be back to its pre-transaction state.
  const storedIngredient = await Ingredients.findById(ingredient._id).lean();
  assert.equal(storedIngredient.minimumStock, 2, 'the ingredient update must roll back');
  const stored = await Requests.findById(request.id).lean();
  assert.equal(stored.status, 'PENDING', 'the request must stay PENDING');
  assert.equal(stored.reviewedBy, undefined, 'no reviewer may be recorded');
  assert.equal(stored.reviewedAt, undefined, 'no review timestamp may be recorded');
  assert.equal(await Audits.countDocuments({ targetType: 'ChangeRequest', targetId: request.id }), 1, 'only the original submission audit may remain');
  assert.equal(await Audits.countDocuments({ targetType: 'Ingredient', targetId: ingredient._id }), 0, 'the rolled-back ingredient audit must not persist');

  // The request is still actionable once the fault is gone.
  const applied = await service.review(managerActor, request.id, 'APPROVED');
  assert.equal(applied.status, 'APPROVED');
  assert.equal((await Ingredients.findById(ingredient._id).lean()).minimumStock, 8);
  assert.equal(await Audits.countDocuments({ targetType: 'Ingredient', targetId: ingredient._id, action: 'UPDATE' }), 1);
});

test('approving an already-approved request is refused and the ingredient is not applied twice', async () => {
  const { staff, manager, ingredient, Requests, Counters, Ingredients, Audits, Batches, Users } = await seed('Double Decision Ingredient', 2);
  const service = createChangeRequests(driver, Requests, Counters, Ingredients, Batches, Users, Audits);
  const staffActor = { id: staff._id.toString(), name: 'Integrity Staff', role: 'Inventory Staff' };
  const managerActor = { id: manager._id.toString(), name: 'Integrity Manager', role: 'Manager' };
  const request = await service.create(staffActor, { requestType: 'MINIMUM_STOCK_CHANGE', ingredientId: ingredient._id.toString(), targetField: 'minimumStock', requestedValue: '8', reason: 'Raise minimum stock' });
  const first = await service.review(managerActor, request.id, 'APPROVED');
  assert.equal(first.status, 'APPROVED');
  assert.equal((await Ingredients.findById(ingredient._id).lean()).minimumStock, 8);

  await assert.rejects(() => service.review(managerActor, request.id, 'APPROVED'), error => error.code === 'CONFLICT');
  await assert.rejects(() => service.review(managerActor, request.id, 'REJECTED', 'Changed my mind'), error => error.code === 'CONFLICT');

  assert.equal((await Ingredients.findById(ingredient._id).lean()).minimumStock, 8);
  assert.equal(await Audits.countDocuments({ targetType: 'Ingredient', targetId: ingredient._id, action: 'UPDATE' }), 1, 'a decided request must only ever apply once');
  assert.equal((await Requests.findById(request.id).lean()).status, 'APPROVED');
});
