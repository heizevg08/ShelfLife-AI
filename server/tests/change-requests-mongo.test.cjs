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

test('MongoDB typed requests atomically reject stale, double, edited, archived and duplicate-counter operations', { skip: process.env.RUN_MONGO_HARDENING_TESTS !== 'true' }, async () => {
  const driver = new Mongoose(), prefix = `typed_change_${randomUUID().replaceAll('-', '')}_`, models = [];
  let connected = false, replicaSet;
  const isolated = factory => { const base = factory(driver); const model = driver.model(`Test${base.modelName}${prefix}`, base.schema.clone(), prefix + base.collection.name); models.push(model); return model; };
  try {
    // Use an isolated single-node replica set locally when no external Mongo URI is supplied.
    // Transactions require a replica set, and this path never connects to Atlas.
    const uri = process.env.MONGO_URI || (replicaSet = await MongoMemoryReplSet.create({ replSet: { count: 1, storageEngine: 'wiredTiger' } })).getUri();
    await driver.connect(uri, { dbName: 'shelflifeai', autoIndex: false, autoCreate: false, serverSelectionTimeoutMS: 5000 }); connected = true;
    const ingredients = isolated(ingredientModel), requests = isolated(changeRequestModel), counters = isolated(changeRequestCounterModel), audits = isolated(auditRecordModel);
    for (const model of models) { await model.createCollection(); await model.createIndexes(); }
    const manager = { id: '1'.repeat(24), role: 'Inventory Manager' }, staff = { id: '2'.repeat(24), role: 'Inventory Staff' };
    const ingredient = await ingredients.create({ name: `Typed request ${prefix}`, category: 'Other', unitOfMeasure: 'kg', minimumStock: 1, createdBy: manager.id });
    const service = createChangeRequests(driver, requests, counters, ingredients, audits, () => new Date('2026-10-06T16:00:00.000Z'));
    const body = { requestType: 'MINIMUM_STOCK_CHANGE', ingredientId: ingredient.id, requestedValue: '2.500', reason: 'Confirmed by current stock review.' };
    const [first, second] = await Promise.all([service.create(staff, body), service.create(staff, body)]);
    assert.notEqual(first.requestID, second.requestID); assert.match(first.requestID, /^REQ-20261007-\d{3}$/);
    const outcomes = await Promise.allSettled([service.review(manager, first.id, 'APPROVED', { expectedVersion: 0 }), service.review(manager, first.id, 'APPROVED', { expectedVersion: 0 })]);
    assert.equal(outcomes.filter(result => result.status === 'fulfilled').length, 1); assert.equal(outcomes.filter(result => result.status === 'rejected' && result.reason.status === 409).length, 1);
    const requestVersionStale = await service.create(staff, body);
    await assert.rejects(service.review(manager, requestVersionStale.id, 'REJECTED', { expectedVersion: 1, reviewNote: 'Stale version.' }), error => error.status === 409);
    const stale = await service.create(staff, body); await ingredients.updateOne({ _id: ingredient._id }, { $inc: { version: 1 } });
    await assert.rejects(service.review(manager, stale.id, 'APPROVED', { expectedVersion: 0 }), error => error.status === 409);
    const archived = await service.create(staff, body); await ingredients.updateOne({ _id: ingredient._id }, { $set: { isActive: false } });
    await assert.rejects(service.review(manager, archived.id, 'APPROVED', { expectedVersion: 0 }), error => error.status === 409);
  } finally {
    if (connected) try { for (const model of models) await model.collection.drop(); } finally { await driver.disconnect(); }
    if (replicaSet) await replicaSet.stop();
  }
});
