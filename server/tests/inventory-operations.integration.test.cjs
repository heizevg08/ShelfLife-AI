const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const { createServer } = require('node:http');
const { once } = require('node:events');
const { randomBytes } = require('node:crypto');
const { Mongoose } = require('mongoose');
const { MongoMemoryReplSet } = require('mongodb-memory-server');
const { userModel } = require('../dist/models/user');
const { ingredientModel } = require('../dist/models/ingredient');
const { inventoryBatchModel } = require('../dist/models/inventory-batch');
const { inventoryBatchCounterModel } = require('../dist/models/inventory-batch-counter');
const { usageRecordModel } = require('../dist/models/usage-record');
const { wasteRecordModel } = require('../dist/models/waste-record');
const { auditRecordModel } = require('../dist/models/audit-record');
const { createInventoryBatchStore } = require('../dist/services/inventory-batch-store');
const { createUsageRecordStore } = require('../dist/services/usage-record-store');
const { createWasteRecordStore } = require('../dist/services/waste-record-store');
const { createInventoryBatches } = require('../dist/services/inventory-batches');
const { createUsageRecords } = require('../dist/services/usage-records');
const { createWasteRecords } = require('../dist/services/waste-records');
const { createAuth } = require('../dist/services/auth');
const { createApp } = require('../dist/app');

let replica; let driver;
before(async () => {
  replica = await MongoMemoryReplSet.create({ replSet: { count: 1, storageEngine: 'wiredTiger' } });
  driver = new Mongoose();
  await driver.connect(replica.getUri('shelflifeai_test_inventory_operations'));
});
after(async () => { await driver?.disconnect(); await replica?.stop(); });

test('bulk Stock-In, Usage, and Waste commit atomically and roll back on any invalid row', async () => {
  const Users = userModel(driver), Ingredients = ingredientModel(driver), Batches = inventoryBatchModel(driver), Counters = inventoryBatchCounterModel(driver), Usage = usageRecordModel(driver), Waste = wasteRecordModel(driver), Audits = auditRecordModel(driver);
  await Promise.all([Users.init(), Ingredients.init(), Batches.init(), Counters.init(), Usage.init(), Waste.init()]);
  const staff = await Users.create({ email: 'operations@shelflife.com', firstName: 'Inventory', lastName: 'Staff', passwordHash: 'scrypt$131072$8$1$aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa$aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa', role: 'Inventory Staff' });
  const manager = await Users.create({ email: 'manager@shelflife.com', firstName: 'Inventory', lastName: 'Manager', passwordHash: 'scrypt$131072$8$1$bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb$bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb', role: 'Manager' });
  const ingredient = await Ingredients.create({ name: 'Bulk Ingredient', category: 'Meat', unitOfMeasure: 'kg', minimumStock: 1, standardUnitCost: 4, createdBy: staff._id });
  const other = await Ingredients.create({ name: 'Other Ingredient', category: 'Produce', unitOfMeasure: 'kg', minimumStock: 1, standardUnitCost: 3, createdBy: staff._id });
  const zeroCost = await Ingredients.create({ name: 'Zero Cost Ingredient', category: 'Other', unitOfMeasure: 'kg', minimumStock: 0, standardUnitCost: 0, createdBy: staff._id });
  const noCost = await Ingredients.create({ name: 'No Cost Ingredient', category: 'Other', unitOfMeasure: 'kg', minimumStock: 0, createdBy: staff._id });
  const actor = { id: staff._id.toString(), name: 'Inventory Staff', role: 'Inventory Staff' };
  const inventory = createInventoryBatchStore(driver, Batches, Counters, Ingredients, Users, Audits);
  const stockItems = [
    { ingredientId: ingredient._id.toString(), dateReceived: new Date('2030-01-01'), quantity: 10, expirationDate: new Date('2030-02-01'), unitCost: 5 },
    { ingredientId: ingredient._id.toString(), dateReceived: new Date('2030-01-01'), quantity: 7, expirationDate: new Date('2030-02-02') },
    { ingredientId: other._id.toString(), dateReceived: new Date('2030-01-01'), quantity: 4, expirationDate: new Date('2030-02-03'), unitCost: 2 },
  ];
  const createdBatches = await inventory.createMany(actor, stockItems);
  assert.equal(createdBatches.length, 3);
  assert.equal(new Set(createdBatches.map(batch => batch.batchID)).size, 3);
  assert.deepEqual(createdBatches.map(batch => batch.ingredient.id), [ingredient._id.toString(), ingredient._id.toString(), other._id.toString()]);
  assert.equal(await Audits.countDocuments({ targetType: 'InventoryBatch' }), 3);
  const beforeFailedStock = await Batches.countDocuments();
  const auditsBeforeFailedStock = await Audits.countDocuments({ targetType: 'InventoryBatch' });
  await assert.rejects(() => inventory.createMany(actor, [stockItems[0], { ...stockItems[0], ingredientId: new driver.Types.ObjectId().toString() }]), error => error.code === 'NOT_FOUND');
  assert.equal(await Batches.countDocuments(), beforeFailedStock);
  assert.equal(await Audits.countDocuments({ targetType: 'InventoryBatch' }), auditsBeforeFailedStock);

  const usage = createUsageRecordStore(driver, Usage, Batches, Ingredients, Users, Audits);
  const usageItems = [
    { ingredientId: ingredient._id.toString(), batchId: createdBatches[0].id, quantityUsed: 2, dateUsed: new Date('2030-01-02') },
    { ingredientId: ingredient._id.toString(), batchId: createdBatches[0].id, quantityUsed: 3, dateUsed: new Date('2030-01-02') },
  ];
  const usageRecords = await usage.createMany(actor, usageItems);
  assert.equal(usageRecords.length, 2);
  assert.equal((await Batches.findById(createdBatches[0].id).lean()).quantity, 5);
  assert.equal(await Audits.countDocuments({ targetType: 'UsageRecord' }), 2);
  const usageAuditsBeforeFailure = await Audits.countDocuments({ targetType: 'UsageRecord' });
  await assert.rejects(() => usage.createMany(actor, [{ ...usageItems[0], quantityUsed: 3 }, { ...usageItems[1], quantityUsed: 3 }]), error => error.code === 'VALIDATION_ERROR');
  await assert.rejects(() => usage.createMany(actor, [{ ...usageItems[0], ingredientId: other._id.toString() }]), error => error.code === 'VALIDATION_ERROR');
  assert.equal((await Batches.findById(createdBatches[0].id).lean()).quantity, 5);
  assert.equal(await Usage.countDocuments(), 2);
  assert.equal(await Audits.countDocuments({ targetType: 'UsageRecord' }), usageAuditsBeforeFailure);

  const waste = createWasteRecordStore(driver, Waste, Batches, Ingredients, Users, Audits);
  const wasteItems = [
    { ingredientId: ingredient._id.toString(), batchId: createdBatches[0].id, quantityWasted: 1, reason: 'Spoiled', dateWasted: new Date('2030-01-02') },
    { ingredientId: ingredient._id.toString(), batchId: createdBatches[0].id, quantityWasted: 1, reason: 'Expired', dateWasted: new Date('2030-01-02') },
    { ingredientId: ingredient._id.toString(), batchId: createdBatches[1].id, quantityWasted: 2, reason: 'Damaged', dateWasted: new Date('2030-01-02') },
  ];
  const wasteRecords = await waste.createMany(actor, wasteItems);
  assert.deepEqual(wasteRecords.map(record => record.wasteCost), [5, 5, 8]);
  assert.equal(await Audits.countDocuments({ targetType: 'WasteRecord' }), 3);
  const quantitiesBeforeFailure = await Batches.find({ _id: { $in: createdBatches.map(batch => batch.id) } }).sort({ batchID: 1 }).select('quantity').lean();
  const wasteAuditsBeforeFailure = await Audits.countDocuments({ targetType: 'WasteRecord' });
  await assert.rejects(() => waste.createMany(actor, [{ ...wasteItems[0], quantityWasted: 2 }, { ...wasteItems[1], quantityWasted: 2 }]), error => error.code === 'VALIDATION_ERROR');
  await assert.rejects(() => waste.createMany(actor, [wasteItems[0], { ...wasteItems[1], ingredientId: other._id.toString() }]), error => error.code === 'VALIDATION_ERROR');
  const quantitiesAfterFailure = await Batches.find({ _id: { $in: createdBatches.map(batch => batch.id) } }).sort({ batchID: 1 }).select('quantity').lean();
  assert.deepEqual(quantitiesAfterFailure.map(batch => batch.quantity), quantitiesBeforeFailure.map(batch => batch.quantity));
  assert.equal(await Waste.countDocuments(), 3);
  assert.equal(await Audits.countDocuments({ targetType: 'WasteRecord' }), wasteAuditsBeforeFailure);

  const costEdgeBatches = await inventory.createMany(actor, [
    { ingredientId: zeroCost._id.toString(), dateReceived: new Date('2030-01-01'), quantity: 2, expirationDate: new Date('2030-02-01') },
    { ingredientId: noCost._id.toString(), dateReceived: new Date('2030-01-01'), quantity: 2, expirationDate: new Date('2030-02-01') },
  ]);
  const zeroCostWaste = await waste.createMany(actor, [{ ingredientId: zeroCost._id.toString(), batchId: costEdgeBatches[0].id, quantityWasted: 1, reason: 'Other', dateWasted: new Date('2030-01-02') }]);
  assert.equal(zeroCostWaste[0].wasteCost, 0);
  await assert.rejects(() => waste.createMany(actor, [{ ingredientId: noCost._id.toString(), batchId: costEdgeBatches[1].id, quantityWasted: 1, reason: 'Other', dateWasted: new Date('2030-01-02') }]), error => error.code === 'VALIDATION_ERROR');
  assert.equal((await Batches.findById(costEdgeBatches[1].id).lean()).quantity, 2);

  const auth = createAuth({ byId: async id => Users.findById(id).select('+passwordHash').exec(), byEmail: async () => null }, randomBytes(48).toString('hex'));
  const app = createApp([], () => true, auth, undefined, undefined, undefined,
    createInventoryBatches(inventory, () => new Date('2030-01-03T12:00:00.000Z')),
    createUsageRecords(usage, () => new Date('2030-01-03T12:00:00.000Z')),
    createWasteRecords(waste, () => new Date('2030-01-03T12:00:00.000Z')));
  const http = createServer(app); http.listen(0, '127.0.0.1'); await once(http, 'listening');
  const token = auth.issue(staff).accessToken, managerToken = auth.issue(manager).accessToken, base = `http://127.0.0.1:${http.address().port}/api`;
  const post = (path, body, accessToken = token) => fetch(base + path, { method: 'POST', headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
  try {
    const stockResponse = await post('/inventory-batches/bulk', { items: [{ ingredientId: ingredient._id.toString(), dateReceived: '2030-01-03', quantity: 6, expirationDate: '2030-03-01', unitCost: 2 }] });
    assert.equal(stockResponse.status, 201); const routeBatch = (await stockResponse.json()).batches[0];
    const usageResponse = await post('/usage-records/bulk', { items: [{ ingredientId: ingredient._id.toString(), batchId: routeBatch.id, dateUsed: '2030-01-03', quantityUsed: 1 }] });
    assert.equal(usageResponse.status, 201); assert.equal((await usageResponse.json()).count, 1);
    const wasteResponse = await post('/waste-records/bulk', { items: [{ ingredientId: ingredient._id.toString(), batchId: routeBatch.id, dateWasted: '2030-01-03', quantityWasted: 1, reason: 'Other' }] });
    assert.equal(wasteResponse.status, 201); assert.equal((await wasteResponse.json()).count, 1);
    assert.equal((await post('/inventory-batches/bulk', { items: [{ ingredientId: ingredient._id.toString(), dateReceived: '2030-01-03', quantity: 1, expirationDate: '2030-03-01', createdBy: staff._id.toString() }] })).status, 400);
    assert.equal((await post('/usage-records/bulk', { items: [{ ingredientId: ingredient._id.toString(), batchId: routeBatch.id, dateUsed: '2030-01-03', quantityUsed: 1, unit: 'kg' }] })).status, 400);
    assert.equal((await post('/waste-records/bulk', { items: [{ ingredientId: ingredient._id.toString(), batchId: routeBatch.id, dateWasted: '2030-01-03', quantityWasted: 1, reason: 'Unknown' }] })).status, 400);
    assert.equal((await post('/inventory-batches/bulk', { items: [{ ingredientId: ingredient._id.toString(), dateReceived: '2030-01-03', quantity: 1, expirationDate: '2030-03-01' }] }, managerToken)).status, 403);
  } finally { http.closeAllConnections(); await new Promise(resolve => http.close(resolve)); }
});
