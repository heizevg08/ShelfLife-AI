const { test } = require('node:test');
const assert = require('node:assert/strict');
const { Mongoose } = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');
const { ingredientModel } = require('../dist/models/ingredient');
const { inventoryBatchModel } = require('../dist/models/inventory-batch');
const { usageRecordModel } = require('../dist/models/usage-record');
const { wasteRecordModel } = require('../dist/models/waste-record');
const { auditRecordModel } = require('../dist/models/audit-record');
const { createReportExports, reportCsv } = require('../dist/services/report-export');
const { reportWorkbook } = require('../dist/services/report-workbook');
const { reportQuery } = require('../dist/validators/report');

test('isolated Mongo fixtures produce three truthful report contracts and an audit record', async t => {
  const mongo = await MongoMemoryServer.create();
  const driver = new Mongoose();
  await driver.connect(mongo.getUri('shelflifeai_report_test'));
  t.after(async () => { await driver.disconnect(); await mongo.stop(); });
  const models = { ingredients: ingredientModel(driver), batches: inventoryBatchModel(driver), usage: usageRecordModel(driver), waste: wasteRecordModel(driver), audits: auditRecordModel(driver) };
  const ingredientId = new driver.Types.ObjectId(), missingId = new driver.Types.ObjectId(), batchId = new driver.Types.ObjectId(), actorId = new driver.Types.ObjectId();
  await driver.connection.collection('ingredients').insertOne({ _id: ingredientId, name: 'Rice', category: 'Dry', unitOfMeasure: 'kg', standardUnitCost: 10, createdBy: actorId });
  await driver.connection.collection('inventorybatches').insertMany([
    { _id: batchId, ingredientId, batchID: 'SL-1', quantity: 8, unit: 'kg', expirationDate: new Date('2026-10-20'), dateReceived: new Date('2026-10-01'), unitCost: 12, createdBy: actorId },
    { ingredientId: missingId, batchID: 'SL-2', quantity: 2, unit: 'L', expirationDate: new Date('2026-10-22'), dateReceived: new Date('2026-10-01'), createdBy: actorId },
  ]);
  await driver.connection.collection('usageRecords').insertMany([
    { ingredientId, batchId, quantityUsed: 2, unit: 'kg', dateUsed: new Date('2026-10-14'), staffId: actorId },
    { ingredientId, batchId, quantityUsed: 1, unit: 'L', dateUsed: new Date('2026-10-14'), staffId: actorId },
    { ingredientId: missingId, batchId, quantityUsed: 3, unit: 'kg', dateUsed: new Date('2026-10-14'), staffId: actorId },
    { ingredientId, batchId, quantityUsed: 9, unit: 'kg', dateUsed: new Date('2026-10-15'), staffId: actorId },
  ]);
  await driver.connection.collection('wasteRecords').insertMany([
    { ingredientId, batchId, quantityWasted: 2, unit: 'kg', wasteCost: 24, dateWasted: new Date('2026-10-14'), reason: 'Spoiled', recordedBy: actorId },
    { ingredientId: missingId, batchId: new driver.Types.ObjectId(), quantityWasted: 1, unit: 'L', wasteCost: 5, dateWasted: new Date('2026-10-14'), reason: 'Other', recordedBy: actorId },
  ]);
  const service = createReportExports(models);
  const inventory = await service.table(reportQuery('inventory-summary', {}));
  assert.equal(inventory.rows.length, 3);
  assert.equal(inventory.rows.at(-1)[11], null);
  assert.match(reportCsv(inventory), /Ingredient ID/);
  assert.ok(reportCsv(inventory).includes(ingredientId.toString()), 'CSV source contract retains internal ObjectIds');
  const scope = { from: '2026-10-14', to: '2026-10-14' };
  const usage = await service.table(reportQuery('usage-consumption', scope));
  assert.equal(usage.rows.length, 3);
  assert.equal(usage.rows.find(row => row[3] === 'kg' && row[1] === ingredientId.toString())[4], 2);
  const waste = await service.table(reportQuery('expiration-waste', scope));
  assert.equal(waste.rows.find(row => row[0] === 'ORPHAN_WASTE')[12], 5);
  assert.equal(waste.rows.find(row => row[0] === 'BATCH' && row[6] === 'SL-1')[12], 24);
  assert.ok(reportCsv(waste).startsWith('\uFEFF'));
  await driver.connection.collection('usageRecords').insertMany([
    { ingredientId, batchId, quantityUsed: 4, unit: 'kg', dateUsed: new Date('2026-10-13T15:59:59.999Z'), staffId: actorId },
    { ingredientId, batchId, quantityUsed: 5, unit: 'kg', dateUsed: new Date('2026-10-13T16:00:00.000Z'), staffId: actorId },
    { ingredientId, batchId, quantityUsed: 6, unit: 'kg', dateUsed: new Date('2026-10-14T15:59:59.999Z'), staffId: actorId },
    { ingredientId, batchId, quantityUsed: 7, unit: 'kg', dateUsed: new Date('2026-10-14T16:00:00.000Z'), staffId: actorId },
  ]);
  await driver.connection.collection('wasteRecords').insertMany([
    { ingredientId, batchId, quantityWasted: 4, unit: 'kg', wasteCost: 40, dateWasted: new Date('2026-10-13T15:59:59.999Z'), recordedBy: actorId },
    { ingredientId, batchId, quantityWasted: 5, unit: 'kg', wasteCost: 50, dateWasted: new Date('2026-10-13T16:00:00.000Z'), recordedBy: actorId },
    { ingredientId, batchId, quantityWasted: 6, unit: 'kg', wasteCost: 60, dateWasted: new Date('2026-10-14T15:59:59.999Z'), recordedBy: actorId },
    { ingredientId, batchId, quantityWasted: 7, unit: 'kg', wasteCost: 70, dateWasted: new Date('2026-10-14T16:00:00.000Z'), recordedBy: actorId },
  ]);
  const correctedUsage = await service.table(reportQuery('usage-consumption', scope));
  assert.equal(correctedUsage.rows.find(row => row[0] === '2026-10-14' && row[1] === ingredientId.toString() && row[3] === 'kg')[4], 13);
  assert.doesNotMatch(reportCsv(correctedUsage), /2026-10-13/);
  const correctedWaste = await service.table(reportQuery('expiration-waste', scope));
  assert.equal(correctedWaste.rows.find(row => row[0] === 'BATCH' && row[6] === 'SL-1')[12], 134);
  const twoDays = await service.table(reportQuery('usage-consumption', { from: '2026-10-13', to: '2026-10-14' }));
  assert.equal(twoDays.rows.find(row => row[0] === '2026-10-13' && row[1] === ingredientId.toString())[4], 4);
  assert.equal(twoDays.rows.find(row => row[0] === '2026-10-14' && row[1] === ingredientId.toString() && row[3] === 'kg')[4], 13);
  const { Workbook } = (await import('@excel.js/exceljs')).default;
  const generatedWorkbook = await reportWorkbook(service, reportQuery('usage-consumption', scope), new Date(), undefined, ['inventory-summary', 'usage-consumption', 'expiration-waste']);
  const openedWorkbook = new Workbook();
  await openedWorkbook.xlsx.load(generatedWorkbook.buffer);
  assert.deepEqual(openedWorkbook.worksheets.map(sheet => sheet.name), ['Inventory Summary', 'Usage & Consumption', 'Expiration & Waste']);
  assert.equal(openedWorkbook.getWorksheet('Inventory Summary').getRow(2).getCell(1).value, 'Report Prepared At (Philippine Time)');
  assert.equal(openedWorkbook.getWorksheet('Inventory Summary').getRow(5).getCell(1).value, ingredientId.toString());
  assert.equal(openedWorkbook.getWorksheet('Inventory Summary').getRow(6).getCell(1).value, missingId.toString());
  assert.equal(openedWorkbook.getWorksheet('Inventory Summary').getRow(6).getCell(10).value, null);
  assert.equal(openedWorkbook.getWorksheet('Inventory Summary').getRow(6).getCell(11).value, 'Ingredient record unavailable; unit cost unavailable');
  const combinedUsage = openedWorkbook.getWorksheet('Usage & Consumption');
  const combinedRiceUsage = combinedUsage.getRows(5, combinedUsage.rowCount - 4).find(row => row.getCell(2).value === 'Rice' && row.getCell(5).value === 'kg');
  assert.ok(combinedRiceUsage);
  assert.equal(combinedRiceUsage.getCell(1).value, ingredientId.toString());
  assert.ok(combinedRiceUsage.getCell(3).value instanceof Date);
  const unresolvedUsage = combinedUsage.getRows(5, combinedUsage.rowCount - 4).find(row => row.getCell(4).value === 3);
  assert.equal(unresolvedUsage.getCell(1).value, missingId.toString());
  assert.equal(unresolvedUsage.getCell(6).value, 'Ingredient record unavailable');
  const combinedWasteSheet = openedWorkbook.getWorksheet('Expiration & Waste');
  const combinedWaste = combinedWasteSheet.getRows(5, combinedWasteSheet.rowCount - 4).find(row => row.getCell(3).value === 'SL-1');
  assert.ok(combinedWaste);
  assert.equal(combinedWaste.getCell(1).value, ingredientId.toString());
  assert.equal(combinedWaste.getCell(8).value, 134);
  const unresolvedWaste = combinedWasteSheet.getRows(5, combinedWasteSheet.rowCount - 4).find(row => row.getCell(3).value === 'SL-2');
  assert.equal(unresolvedWaste.getCell(1).value, missingId.toString());
  assert.equal(unresolvedWaste.getCell(9).value, 'Ingredient record unavailable');
  const aiWorkbook = await reportWorkbook(service, reportQuery('ai-insights-recommendations', scope), new Date('2026-10-14T02:00:00Z'), 'ai-insights-recommendations');
  const openedAiWorkbook = new Workbook();
  await openedAiWorkbook.xlsx.load(aiWorkbook.buffer);
  const aiRows = openedAiWorkbook.getWorksheet('AI Insights & Recommendations').getRows(5, openedAiWorkbook.getWorksheet('AI Insights & Recommendations').rowCount - 4);
  assert.ok(aiRows.some(row => row.getCell(1).value === ingredientId.toString() && row.getCell(2).value === 'Rice'));
  const individualCases = [
    ['inventory-summary', reportQuery('inventory-summary', {}), 'Inventory Summary'],
    ['usage-consumption', reportQuery('usage-consumption', scope), 'Usage & Consumption'],
    ['expiration-waste', reportQuery('expiration-waste', scope), 'Expiration & Waste'],
  ];
  for (const [reportId, query, worksheetName] of individualCases) {
    const generatedIndividual = await reportWorkbook(service, query, new Date('2026-10-14T02:00:00Z'), reportId);
    const reopenedIndividual = new Workbook();
    await reopenedIndividual.xlsx.load(generatedIndividual.buffer);
    assert.deepEqual(reopenedIndividual.worksheets.map(sheet => sheet.name), [worksheetName]);
    assert.equal(generatedIndividual.reports.length, 1);
    if (reportId === 'inventory-summary') {
      assert.equal(reopenedIndividual.worksheets[0].getRow(5).getCell(1).value, ingredientId.toString());
      assert.equal(reopenedIndividual.worksheets[0].getRow(5).getCell(2).value, 'Rice');
      assert.equal(reopenedIndividual.worksheets[0].getRow(5).getCell(3).value, 'SL-1');
      assert.equal(reopenedIndividual.worksheets[0].getRow(5).getCell(10).value, 96);
      assert.equal(reopenedIndividual.worksheets[0].getRow(6).getCell(1).value, missingId.toString());
      assert.equal(reopenedIndividual.worksheets[0].getRow(6).getCell(10).value, null);
      assert.equal(reopenedIndividual.worksheets[0].getRow(2).getCell(1).value, 'Report Prepared At (Philippine Time)');
    }
    if (reportId === 'usage-consumption') {
      const riceUsage = reopenedIndividual.worksheets[0].getRows(5, reopenedIndividual.worksheets[0].rowCount - 4).find(row => row.getCell(2).value === 'Rice' && row.getCell(5).value === 'kg');
      assert.ok(riceUsage);
      assert.equal(riceUsage.getCell(1).value, ingredientId.toString());
      assert.equal(riceUsage.getCell(3).value.toISOString().slice(0, 10), '2026-10-14');
      assert.equal(riceUsage.getCell(4).value, 13);
    }
    if (reportId === 'expiration-waste') {
      const batchWaste = reopenedIndividual.worksheets[0].getRows(5, reopenedIndividual.worksheets[0].rowCount - 4).find(row => row.getCell(3).value === 'SL-1');
      assert.equal(batchWaste.getCell(1).value, ingredientId.toString());
      assert.equal(batchWaste.getCell(8).value, 134);
    }
  }
  const manager = { id: actorId.toString(), name: 'Report Manager', role: 'Manager' };
  await service.auditWorkbook(manager, scope, generatedWorkbook.reports, 'Success');
  await service.auditWorkbook(manager, scope, [generatedWorkbook.reports.find(report => report.reportId === 'usage-consumption')], 'Success');
  await service.auditWorkbook(manager, scope, [{ reportId: 'expiration-waste', dataRows: 0 }], 'Failed');
  assert.equal(await models.audits.countDocuments({ targetName: 'management-workbook', exportFormat: 'xlsx', status: 'Success' }), 1);
  assert.equal(await models.audits.countDocuments({ targetName: 'usage-consumption', exportFormat: 'xlsx', status: 'Success' }), 1);
  assert.equal(await models.audits.countDocuments({ targetName: 'expiration-waste', exportFormat: 'xlsx', status: 'Failed' }), 1);
  await service.audit({ id: actorId.toString(), role: 'Manager' }, reportQuery('usage-consumption', scope), usage.dataRows, 'Success');
  assert.equal(await models.audits.countDocuments({ action: 'EXPORT', targetType: 'Report', actorRole: 'Manager', exportFormat: 'csv' }), 1);
  const reportHistory = await service.recentExports(actorId.toString());
  assert.deepEqual(reportHistory.map(({ reportId, format, periodFrom, periodTo }) => ({ reportId, format, periodFrom, periodTo })), [
    { reportId: 'usage-consumption', format: 'xlsx', periodFrom: '2026-10-14', periodTo: '2026-10-14' },
    { reportId: 'management-workbook', format: 'xlsx', periodFrom: '2026-10-14', periodTo: '2026-10-14' },
  ]);
  const otherActor = new driver.Types.ObjectId();
  assert.deepEqual(await service.recentExports(otherActor.toString()), []);
  await models.audits.collection.insertMany([
    { userId: actorId, actorRole: 'Manager', action: 'EXPORT', targetType: 'Report', targetName: 'inventory-summary', module: 'Reports & Analytics', status: 'Success', timestamp: new Date('2026-10-15') },
    { userId: actorId, actorRole: 'Manager', action: 'EXPORT', targetType: 'Report', targetName: 'bad-report', exportFormat: 'csv', module: 'Reports & Analytics', status: 'Success', timestamp: new Date('2026-10-16') },
    { userId: actorId, actorRole: 'Manager', action: 'EXPORT', targetType: 'Report', targetName: 'inventory-summary', exportFormat: 'csv', module: 'Reports & Analytics', status: 'Failed', timestamp: new Date('2026-10-17') },
    { userId: otherActor, actorRole: 'Manager', action: 'EXPORT', targetType: 'Report', targetName: 'inventory-summary', exportFormat: 'csv', module: 'Reports & Analytics', status: 'Success', timestamp: new Date('2026-10-18') },
  ]);
  assert.equal((await service.recentExports(actorId.toString())).length, 2, 'CSV, legacy, malformed, failed and other-user records are excluded');
  for (let index = 0; index < 6; index++) await service.auditWorkbook({ id: actorId.toString(), role: 'Manager' }, reportQuery('inventory-summary', {}), [{ reportId: 'inventory-summary', dataRows: 0 }], 'Success');
  const recent = await service.recentExports(actorId.toString());
  assert.equal(recent.length, 5);
  assert.ok(recent.every(row => row.reportId === 'inventory-summary' && row.format === 'xlsx'));
});
