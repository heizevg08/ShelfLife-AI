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

test('MongoDB typed Change Request transactions', { skip: process.env.RUN_CHANGE_REQUEST_MONGO_TESTS !== 'true' }, async (t) => {
  const driver = new Mongoose();
  const prefix = `typed_change_${randomUUID().replaceAll('-', '')}_`;
  const models = [];
  let connected = false;
  let replicaSet;
  const isolated = factory => {
    const base = factory(driver);
    const model = driver.model(`Test${base.modelName}${prefix}`, base.schema.clone(), prefix + base.collection.name);
    models.push(model);
    return model;
  };

  try {
    // This suite intentionally always owns its local replica set and never connects to Atlas.
    replicaSet = await MongoMemoryReplSet.create({ replSet: { count: 1, storageEngine: 'wiredTiger' } });
    await driver.connect(replicaSet.getUri(), { dbName: 'shelflifeai', autoIndex: false, autoCreate: false, serverSelectionTimeoutMS: 5000 });
    connected = true;
    const ingredients = isolated(ingredientModel);
    const requests = isolated(changeRequestModel);
    const counters = isolated(changeRequestCounterModel);
    const audits = isolated(auditRecordModel);
    for (const model of models) {
      await model.createCollection();
      await model.createIndexes();
    }

    const manager = { id: '1'.repeat(24), role: 'Inventory Manager' };
    const staff = { id: '2'.repeat(24), role: 'Inventory Staff' };
    const serviceAt = (time, auditModel = audits) => createChangeRequests(driver, requests, counters, ingredients, auditModel, () => new Date(time));
    const makeIngredient = async () => ingredients.create({ name: `Typed request ${randomUUID()}`, category: 'Other', unitOfMeasure: 'kg', minimumStock: 1, createdBy: manager.id });
    const bodyFor = (ingredientId, requestedValue = '2.500') => ({ requestType: 'MINIMUM_STOCK_CHANGE', ingredientId: ingredientId.toString(), requestedValue, reason: 'Confirmed by current stock review.' });
    const countAudit = filter => audits.countDocuments(filter).exec();

    await t.test('Manila boundary gives each date its own counter beginning at 001', async () => {
      const ingredient = await makeIngredient();
      const beforeMidnight = await serviceAt('2026-10-06T15:59:59.999Z').create(staff, bodyFor(ingredient.id));
      const afterMidnight = await serviceAt('2026-10-06T16:00:00.000Z').create(staff, bodyFor(ingredient.id));
      assert.equal(beforeMidnight.requestID, 'REQ-20261006-001');
      assert.equal(afterMidnight.requestID, 'REQ-20261007-001');
      assert.equal((await counters.findOne({ dateKey: '20261006' }).lean().exec()).sequence, 1);
      assert.equal((await counters.findOne({ dateKey: '20261007' }).lean().exec()).sequence, 1);
    });

    await t.test('25 concurrent requests reserve every sequence exactly once', async () => {
      const ingredient = await makeIngredient();
      const service = serviceAt('2026-10-07T16:00:00.000Z');
      const concurrent = await Promise.all(Array.from({ length: 25 }, () => service.create(staff, bodyFor(ingredient.id))));
      const sequences = concurrent.map(request => Number(request.requestID.slice(-3))).sort((left, right) => left - right);
      assert.equal(new Set(concurrent.map(request => request.requestID)).size, 25);
      assert.deepEqual(sequences, Array.from({ length: 25 }, (_, index) => index + 1));
      assert.equal((await counters.findOne({ dateKey: '20261008' }).lean().exec()).sequence, 25);
    });

    await t.test('five concurrent approvals change the ingredient and audits exactly once', async () => {
      const ingredient = await makeIngredient();
      const service = serviceAt('2026-10-07T16:00:00.000Z');
      const request = await service.create(staff, bodyFor(ingredient.id));
      const ingredientBefore = await ingredients.findById(ingredient.id).lean().exec();
      const outcomes = await Promise.allSettled(Array.from({ length: 5 }, () => service.review(manager, request.id, 'APPROVED', { expectedVersion: 0 })));
      assert.equal(outcomes.filter(result => result.status === 'fulfilled').length, 1);
      assert.equal(outcomes.filter(result => result.status === 'rejected' && result.reason.status === 409).length, 4);
      const ingredientAfter = await ingredients.findById(ingredient.id).lean().exec();
      const requestAfter = await requests.findById(request.id).lean().exec();
      assert.equal(ingredientAfter.minimumStock, 2.5);
      assert.equal(ingredientAfter.version, ingredientBefore.version + 1);
      assert.equal(requestAfter.status, 'APPROVED');
      assert.equal(requestAfter.version, 1);
      assert.equal(await countAudit({ action: 'CHANGE_REQUEST_APPROVED', targetType: 'ChangeRequest', targetId: requestAfter._id }), 1);
      assert.equal(await countAudit({ action: 'UPDATE', targetType: 'Ingredient', targetId: ingredient._id, reason: `Approved ${request.requestID}` }), 1);
      const ingredientAudit = await audits.findOne({ action: 'UPDATE', targetType: 'Ingredient', targetId: ingredient._id }).lean().exec();
      assert.equal(ingredientAudit.oldValue.minimumStock, 1);
      assert.equal(ingredientAudit.newValue.minimumStock, 2.5);
      assert.equal(ingredientAudit.oldValue.version, ingredientBefore.version);
      assert.equal(ingredientAudit.newValue.version, ingredientBefore.version + 1);
    });

    await t.test('stale request version returns 409', async () => {
      const ingredient = await makeIngredient();
      const request = await serviceAt('2026-10-07T16:00:00.000Z').create(staff, bodyFor(ingredient.id));
      await assert.rejects(serviceAt('2026-10-07T16:00:00.000Z').review(manager, request.id, 'REJECTED', { expectedVersion: 1, reviewNote: 'Stale version.' }), error => error.status === 409);
    });

    await t.test('ingredient edits after submission block approval with 409', async () => {
      const ingredient = await makeIngredient();
      const service = serviceAt('2026-10-07T16:00:00.000Z');
      const request = await service.create(staff, bodyFor(ingredient.id));
      await ingredients.updateOne({ _id: ingredient._id }, { $inc: { version: 1 } });
      await assert.rejects(service.review(manager, request.id, 'APPROVED', { expectedVersion: 0 }), error => error.status === 409);
    });

    await t.test('archived ingredients block approval with 409', async () => {
      const ingredient = await makeIngredient();
      const service = serviceAt('2026-10-07T16:00:00.000Z');
      const request = await service.create(staff, bodyFor(ingredient.id));
      await ingredients.updateOne({ _id: ingredient._id }, { $set: { isActive: false } });
      await assert.rejects(service.review(manager, request.id, 'APPROVED', { expectedVersion: 0 }), error => error.status === 409);
    });

    await t.test('audit failure after the ingredient update rolls back every write', async () => {
      const ingredient = await makeIngredient();
      const request = await serviceAt('2026-10-07T16:00:00.000Z').create(staff, bodyFor(ingredient.id));
      const failingAudits = {
        create: async (entries) => {
          if (entries.some(entry => entry.action === 'CHANGE_REQUEST_APPROVED')) throw new Error('Injected audit failure');
          return audits.create(entries);
        }
      };
      await assert.rejects(serviceAt('2026-10-07T16:00:00.000Z', failingAudits).review(manager, request.id, 'APPROVED', { expectedVersion: 0 }), /Injected audit failure/);
      const ingredientAfter = await ingredients.findById(ingredient.id).lean().exec();
      const requestAfter = await requests.findById(request.id).lean().exec();
      assert.equal(ingredientAfter.minimumStock, 1);
      assert.equal(ingredientAfter.version, 0);
      assert.equal(requestAfter.status, 'PENDING');
      assert.equal(requestAfter.version, 0);
      assert.equal(await countAudit({ action: 'CHANGE_REQUEST_APPROVED', targetId: requestAfter._id }), 0);
      assert.equal(await countAudit({ action: 'UPDATE', targetType: 'Ingredient', targetId: ingredient._id }), 0);
    });

    await t.test('rejection leaves the ingredient unchanged and closes the request', async () => {
      const ingredient = await makeIngredient();
      const service = serviceAt('2026-10-07T16:00:00.000Z');
      const request = await service.create(staff, bodyFor(ingredient.id));
      const rejected = await service.review(manager, request.id, 'REJECTED', { expectedVersion: 0, reviewNote: 'The current threshold is still appropriate.' });
      const ingredientAfter = await ingredients.findById(ingredient.id).lean().exec();
      const requestAfter = await requests.findById(request.id).lean().exec();
      assert.equal(ingredientAfter.minimumStock, 1);
      assert.equal(ingredientAfter.version, 0);
      assert.equal(rejected.status, 'REJECTED');
      assert.equal(requestAfter.reviewedBy.toString(), manager.id);
      assert.ok(requestAfter.reviewedAt instanceof Date);
      assert.equal(requestAfter.reviewNote, 'The current threshold is still appropriate.');
      assert.equal(await countAudit({ action: 'CHANGE_REQUEST_REJECTED', targetType: 'ChangeRequest', targetId: requestAfter._id }), 1);
      await assert.rejects(service.review(manager, request.id, 'REJECTED', { expectedVersion: 1, reviewNote: 'Again.' }), error => error.status === 409);
      await assert.rejects(service.review(manager, request.id, 'APPROVED', { expectedVersion: 1 }), error => error.status === 409);
    });

    await t.test('stored invalid values return 400 without state changes', async () => {
      const service = serviceAt('2026-10-07T16:00:00.000Z');
      for (const invalidValue of ['1e-7', '1.0005']) {
        const ingredient = await makeIngredient();
        const request = await service.create(staff, bodyFor(ingredient.id));
        const storedRequest = await requests.findById(request.id).lean().exec();
        await requests.collection.updateOne({ _id: storedRequest._id }, { $set: { requestedValue: invalidValue } });
        await assert.rejects(service.review(manager, request.id, 'APPROVED', { expectedVersion: 0 }), error => error.status === 400);
        const ingredientAfter = await ingredients.findById(ingredient.id).lean().exec();
        const requestAfter = await requests.findById(request.id).lean().exec();
        assert.equal(ingredientAfter.minimumStock, 1);
        assert.equal(ingredientAfter.version, 0);
        assert.equal(requestAfter.status, 'PENDING');
        assert.equal(requestAfter.version, 0);
        assert.equal(await countAudit({ action: 'CHANGE_REQUEST_APPROVED', targetId: requestAfter._id }), 0);
      }
    });
  } finally {
    if (connected) {
      try {
        for (const model of models) await model.collection.drop();
      } finally {
        await driver.disconnect();
      }
    }
    if (replicaSet) await replicaSet.stop();
  }
});
