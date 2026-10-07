const { test } = require('node:test');
const assert = require('node:assert/strict');
const { randomUUID } = require('node:crypto');
const { Mongoose } = require('mongoose');
const { ingredientModel } = require('../dist/models/ingredient');
const { inventoryBatchModel } = require('../dist/models/inventory-batch');
const { usageRecordModel, wasteRecordModel } = require('../dist/models/inventory-record');
const { auditRecordModel } = require('../dist/models/audit-record');
const { createInventoryRecords } = require('../dist/services/inventory-records');

test('MongoDB usage and waste records preserve FEFO, Decimal128 snapshots, compensations, archives and audit labels', { skip: process.env.RUN_MONGO_HARDENING_TESTS !== 'true' ? true : !process.env.MONGO_URI ? 'RUN_MONGO_HARDENING_TESTS=true requires MONGO_URI' : false }, async () => {
  const driver = new Mongoose(), prefix = `record_test_${randomUUID().replaceAll('-', '')}_`, models = [];
  let connected = false;
  const isolated = factory => { const base = factory(driver); const model = driver.model(`Test${base.modelName}${prefix}`, base.schema.clone(), prefix + base.collection.name); models.push(model); return model; };
  try {
    await driver.connect(process.env.MONGO_URI, { dbName: 'shelflifeai', autoIndex: false, autoCreate: false, serverSelectionTimeoutMS: 5000 }); connected = true;
    const ingredients = isolated(ingredientModel), batches = isolated(inventoryBatchModel), usage = isolated(usageRecordModel), waste = isolated(wasteRecordModel), audits = isolated(auditRecordModel);
    for (const model of models) { await model.createCollection(); await model.createIndexes(); }
    const manager = { id: '1'.repeat(24), role: 'Inventory Manager' }, staff = { id: '2'.repeat(24), role: 'Inventory Staff' }, admin = { id: '3'.repeat(24), role: 'Admin' };
    const ingredient = await ingredients.create({ name: `Usage fixture ${prefix}`, category: 'Other', unitOfMeasure: 'kg', createdBy: manager.id });
    const makeBatch = (batchCode, expirationDate, quantity = '10.000', unitCost = '4.1234') => batches.create({ ingredientId: ingredient._id, batchCode, initialQuantity: quantity, quantity, unit: 'kg', unitCost, dateReceived: '2026-09-20', expirationDate, createdBy: manager.id });
    const first = await makeBatch('FEFO-1', '2026-10-01'), second = await makeBatch('FEFO-2', '2026-10-02');
    const usageService = createInventoryRecords(driver, 'UsageRecord', usage, batches, ingredients, audits);
    const wasteService = createInventoryRecords(driver, 'WasteRecord', waste, batches, ingredients, audits);
    const candidates = await usageService.eligibleBatches(staff, ingredient.id, { limit: '25' });
    assert.deepEqual(candidates.items.map(item => item.id), [first.id, second.id]);
    await assert.rejects(usageService.create(admin, { ingredientId: ingredient.id, batchId: first.id, quantity: '1', recordedAt: '2026-09-30' }), error => error.status === 403);
    const original = await usageService.create(manager, { ingredientId: ingredient.id, batchId: first.id, quantity: '1.250', recordedAt: '2026-09-30', notes: 'Prep' });
    await wasteService.create(staff, { ingredientId: ingredient.id, batchId: second.id, quantity: '0.500', recordedAt: '2026-09-30', reason: 'Other', notes: 'Dropped' });
    assert.equal(original.unitCostSnapshot, '4.1234'); assert.equal(original.totalCostSnapshot, '5.15');
    await assert.rejects(usageService.create(staff, { ingredientId: ingredient.id, batchId: first.id, quantity: '99.000', recordedAt: '2026-09-30' }), error => error.status === 400);
    const afterUsage = await batches.findById(first.id).lean(); assert.equal(afterUsage.quantity.toString(), '8.750');
    await batches.updateOne({ _id: first._id }, { $set: { unitCost: '9.0000' } });
    assert.equal((await usage.findById(original.id).lean()).unitCostSnapshot.toString(), '4.1234');
    const correction = await usageService.correct(manager, original.id, { expectedVersion: afterUsage.version, correctedQuantity: '0.750', reason: 'Verified prep count' });
    assert.equal(correction.type, 'correction'); assert.equal(correction.correctionOf, original.id);
    assert.equal((await usage.findById(original.id).lean()).quantity.toString(), '1.250');
    assert.equal((await batches.findById(first.id).lean()).quantity.toString(), '9.250');
    const beforeVoid = await batches.findById(first.id).lean(); await usageService.archive(manager, original.id, { expectedVersion: beforeVoid.version });
    assert.equal((await batches.findById(first.id).lean()).quantity.toString(), '10.000');
    const labels = await audits.find({ targetType: { $in: ['UsageRecord', 'WasteRecord'] } }).lean();
    assert.ok(labels.some(audit => audit.reason === 'UsageRecordCreated'));
    assert.ok(labels.some(audit => audit.reason === 'UsageRecordCorrected'));
    assert.ok(labels.some(audit => audit.reason === 'UsageRecordVoided'));
    assert.ok(labels.some(audit => audit.reason === 'WasteRecordCreated'));
  } finally {
    if (connected) try { for (const model of models) await model.collection.drop(); } finally { await driver.disconnect(); }
  }
});
