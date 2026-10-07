const { test } = require('node:test');
const assert = require('node:assert/strict');
const { randomUUID } = require('node:crypto');
const { Mongoose } = require('mongoose');
const { MongoMemoryReplSet } = require('mongodb-memory-server');
const { ingredientModel } = require('../dist/models/ingredient');
const { changeRequestModel } = require('../dist/models/change-request');
const { changeRequestCounterModel } = require('../dist/models/change-request-counter');
const { auditRecordModel } = require('../dist/models/audit-record');
const { createChangeRequests } = require('../dist/services/change-requests');

test('MongoDB typed requests atomically preserve IDs, reviews, audits, validation, and rollback', { skip: process.env.RUN_MONGO_HARDENING_TESTS !== 'true' }, async () => {
  const driver = new Mongoose(), prefix = `typed_change_${randomUUID().replaceAll('-', '')}_`, models = [];
  let connected = false, replicaSet;
  const isolated = factory => { const base = factory(driver); const model = driver.model(`Test${base.modelName}${prefix}`, base.schema.clone(), prefix + base.collection.name); models.push(model); return model; };
  try {
    // Use an isolated single-node replica set locally when no external Mongo URI is supplied.
    // Transactions require a replica set, and this path never connects to Atlas.
    const configuredUri = process.env.MONGO_URI;
    if (configuredUri && (/^mongodb\+srv:/i.test(configuredUri) || /\.mongodb\.net/i.test(configuredUri))) throw new Error('Refusing to run local transaction coverage against Atlas');
    const uri = configuredUri || (replicaSet = await MongoMemoryReplSet.create({ replSet: { count: 1, storageEngine: 'wiredTiger' } })).getUri();
    await driver.connect(uri, { dbName: 'shelflifeai', autoIndex: false, autoCreate: false, serverSelectionTimeoutMS: 5000 }); connected = true;
    const ingredients = isolated(ingredientModel), requests = isolated(changeRequestModel), counters = isolated(changeRequestCounterModel), audits = isolated(auditRecordModel);
    for (const model of models) { await model.createCollection(); await model.createIndexes(); }

    const manager = { id: '1'.repeat(24), role: 'Inventory Manager' }, staff = { id: '2'.repeat(24), role: 'Inventory Staff' };
    const serviceAt = (time, auditModel = audits) => createChangeRequests(driver, requests, counters, ingredients, auditModel, () => new Date(time));
    const makeIngredient = async () => ingredients.create({ name: `Typed request ${randomUUID()}`, category: 'Other', unitOfMeasure: 'kg', minimumStock: 1, createdBy: manager.id });
    const bodyFor = (ingredientId, requestedValue = '2.500') => ({ requestType: 'MINIMUM_STOCK_CHANGE', ingredientId: ingredientId.toString(), requestedValue, reason: 'Confirmed by current stock review.' });
    const countAudit = filter => audits.countDocuments(filter).exec();

    // Actual counter boundary: the Manila date changes at 16:00 UTC.
    const boundaryIngredient = await makeIngredient();
    const beforeMidnight = await serviceAt('2026-10-06T15:59:59.999Z').create(staff, bodyFor(boundaryIngredient.id));
    const afterMidnight = await serviceAt('2026-10-06T16:00:00.000Z').create(staff, bodyFor(boundaryIngredient.id));
    assert.equal(beforeMidnight.requestID, 'REQ-20261006-001');
    assert.equal(afterMidnight.requestID, 'REQ-20261007-001');
    assert.equal((await counters.findOne({ dateKey: '20261006' }).lean().exec()).sequence, 1);
    assert.equal((await counters.findOne({ dateKey: '20261007' }).lean().exec()).sequence, 1);

    // A separate Manila day proves concurrent creates reserve every sequence exactly once.
    const counterIngredient = await makeIngredient();
    const counterService = serviceAt('2026-10-07T16:00:00.000Z');
    const concurrent = await Promise.all(Array.from({ length: 25 }, () => counterService.create(staff, bodyFor(counterIngredient.id))));
    const sequences = concurrent.map(request => Number(request.requestID.slice(-3))).sort((left, right) => left - right);
    assert.equal(new Set(concurrent.map(request => request.requestID)).size, 25);
    assert.deepEqual(sequences, Array.from({ length: 25 }, (_, index) => index + 1));
    assert.equal((await counters.findOne({ dateKey: '20261008' }).lean().exec()).sequence, 25);

    const approvalIngredient = await makeIngredient();
    const approvalService = serviceAt('2026-10-07T16:00:00.000Z');
    const approvalRequest = await approvalService.create(staff, bodyFor(approvalIngredient.id));
    const approvalBefore = await ingredients.findById(approvalIngredient.id).lean().exec();
    const outcomes = await Promise.allSettled(Array.from({ length: 5 }, () => approvalService.review(manager, approvalRequest.id, 'APPROVED', { expectedVersion: 0 })));
    assert.equal(outcomes.filter(result => result.status === 'fulfilled').length, 1);
    assert.equal(outcomes.filter(result => result.status === 'rejected' && result.reason.status === 409).length, 4);
    const approvalAfter = await ingredients.findById(approvalIngredient.id).lean().exec();
    const approvedRequest = await requests.findById(approvalRequest.id).lean().exec();
    assert.equal(approvalAfter.minimumStock, 2.5);
    assert.equal(approvalAfter.version, approvalBefore.version + 1);
    assert.equal(approvedRequest.status, 'APPROVED');
    assert.equal(approvedRequest.version, 1);
    assert.equal(await countAudit({ action: 'CHANGE_REQUEST_APPROVED', targetType: 'ChangeRequest', targetId: approvedRequest._id }), 1);
    assert.equal(await countAudit({ action: 'UPDATE', targetType: 'Ingredient', targetId: approvalIngredient._id, reason: `Approved ${approvalRequest.requestID}` }), 1);
    const ingredientAudit = await audits.findOne({ action: 'UPDATE', targetType: 'Ingredient', targetId: approvalIngredient._id }).lean().exec();
    assert.equal(ingredientAudit.oldValue.minimumStock, 1);
    assert.equal(ingredientAudit.newValue.minimumStock, 2.5);
    assert.equal(ingredientAudit.oldValue.version, approvalBefore.version);
    assert.equal(ingredientAudit.newValue.version, approvalBefore.version + 1);

    const staleRequest = await approvalService.create(staff, bodyFor(approvalIngredient.id));
    await assert.rejects(approvalService.review(manager, staleRequest.id, 'REJECTED', { expectedVersion: 1, reviewNote: 'Stale version.' }), error => error.status === 409);

    const editedIngredient = await makeIngredient();
    const editedRequest = await approvalService.create(staff, bodyFor(editedIngredient.id));
    await ingredients.updateOne({ _id: editedIngredient._id }, { $inc: { version: 1 } });
    await assert.rejects(approvalService.review(manager, editedRequest.id, 'APPROVED', { expectedVersion: 0 }), error => error.status === 409);

    const archivedIngredient = await makeIngredient();
    const archivedRequest = await approvalService.create(staff, bodyFor(archivedIngredient.id));
    await ingredients.updateOne({ _id: archivedIngredient._id }, { $set: { isActive: false } });
    await assert.rejects(approvalService.review(manager, archivedRequest.id, 'APPROVED', { expectedVersion: 0 }), error => error.status === 409);

    const rollbackIngredient = await makeIngredient();
    const rollbackRequest = await approvalService.create(staff, bodyFor(rollbackIngredient.id));
    const failingAudits = { create: async entries => {
      if (entries.some(entry => entry.action === 'CHANGE_REQUEST_APPROVED')) throw new Error('Injected audit failure');
      return audits.create(entries);
    } };
    await assert.rejects(serviceAt('2026-10-07T16:00:00.000Z', failingAudits).review(manager, rollbackRequest.id, 'APPROVED', { expectedVersion: 0 }), /Injected audit failure/);
    const rollbackIngredientAfter = await ingredients.findById(rollbackIngredient.id).lean().exec();
    const rollbackRequestAfter = await requests.findById(rollbackRequest.id).lean().exec();
    assert.equal(rollbackIngredientAfter.minimumStock, 1);
    assert.equal(rollbackIngredientAfter.version, 0);
    assert.equal(rollbackRequestAfter.status, 'PENDING');
    assert.equal(rollbackRequestAfter.version, 0);
    assert.equal(await countAudit({ action: 'CHANGE_REQUEST_APPROVED', targetId: rollbackRequestAfter._id }), 0);
    assert.equal(await countAudit({ action: 'UPDATE', targetType: 'Ingredient', targetId: rollbackIngredient._id }), 0);

    const rejectedIngredient = await makeIngredient();
    const rejectedRequest = await approvalService.create(staff, bodyFor(rejectedIngredient.id));
    const rejected = await approvalService.review(manager, rejectedRequest.id, 'REJECTED', { expectedVersion: 0, reviewNote: 'The current threshold is still appropriate.' });
    const rejectedIngredientAfter = await ingredients.findById(rejectedIngredient.id).lean().exec();
    const rejectedRequestAfter = await requests.findById(rejectedRequest.id).lean().exec();
    assert.equal(rejectedIngredientAfter.minimumStock, 1);
    assert.equal(rejectedIngredientAfter.version, 0);
    assert.equal(rejected.status, 'REJECTED');
    assert.equal(rejectedRequestAfter.reviewedBy.toString(), manager.id);
    assert.ok(rejectedRequestAfter.reviewedAt instanceof Date);
    assert.equal(rejectedRequestAfter.reviewNote, 'The current threshold is still appropriate.');
    assert.equal(await countAudit({ action: 'CHANGE_REQUEST_REJECTED', targetType: 'ChangeRequest', targetId: rejectedRequestAfter._id }), 1);
    await assert.rejects(approvalService.review(manager, rejectedRequest.id, 'REJECTED', { expectedVersion: 1, reviewNote: 'Again.' }), error => error.status === 409);
    await assert.rejects(approvalService.review(manager, rejectedRequest.id, 'APPROVED', { expectedVersion: 1 }), error => error.status === 409);

    for (const invalidValue of ['1e-7', '1.0005']) {
      const invalidIngredient = await makeIngredient();
      const invalidRequest = await approvalService.create(staff, bodyFor(invalidIngredient.id));
      const storedInvalidRequest = await requests.findById(invalidRequest.id).lean().exec();
      await requests.collection.updateOne({ _id: storedInvalidRequest._id }, { $set: { requestedValue: invalidValue } });
      await assert.rejects(approvalService.review(manager, invalidRequest.id, 'APPROVED', { expectedVersion: 0 }), error => error.status === 400);
      const invalidIngredientAfter = await ingredients.findById(invalidIngredient.id).lean().exec();
      const invalidRequestAfter = await requests.findById(invalidRequest.id).lean().exec();
      assert.equal(invalidIngredientAfter.minimumStock, 1);
      assert.equal(invalidIngredientAfter.version, 0);
      assert.equal(invalidRequestAfter.status, 'PENDING');
      assert.equal(invalidRequestAfter.version, 0);
      assert.equal(await countAudit({ action: 'CHANGE_REQUEST_APPROVED', targetId: invalidRequestAfter._id }), 0);
    }
  } finally {
    if (connected) try { for (const model of models) await model.collection.drop(); } finally { await driver.disconnect(); }
    if (replicaSet) await replicaSet.stop();
  }
});
