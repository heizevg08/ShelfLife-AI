const { test } = require('node:test');
const assert = require('node:assert/strict');
const { reportWorkbook } = require('../dist/services/report-workbook');
const { reportQuery } = require('../dist/validators/report');
const { createApp } = require('../dist/app');
const { HttpError } = require('../dist/middleware/error.middleware');
const internalId = 'a'.repeat(24);
const missingInternalId = 'b'.repeat(24);

const tables = {
  'inventory-summary': { columns: ['Record Type', 'Generated At (PHT)', 'Ingredient ID', 'Ingredient', 'Category', 'Batch ID', 'Quantity On Hand', 'Unit', 'Expiration Date', 'Unit Cost (PHP)', 'Unit Cost Source', 'Inventory Value (PHP)', 'Valuation Status'], rows: [['BATCH', '2026-10-14 10:00:00', internalId, '=Rice', 'Dry', 'SL-1', 2, 'kg', '2026-10-20', 0, 'Batch', 0, 'Complete'], ['SUMMARY', '2026-10-14 10:00:00', null, null, null, null, null, null, null, null, null, 0, 'Complete']], dataRows: 1, empty: false },
  'usage-consumption': { columns: ['Usage Date (PHT)', 'Ingredient ID', 'Ingredient', 'Unit', 'Quantity Used', 'Usage Record Count', 'Data Status'], rows: [['2026-10-14', internalId, 'Rice', 'kg', 3, 1, 'Complete']], dataRows: 1, empty: false },
  'expiration-waste': { columns: ['Record Type', 'Generated At (PHT)', 'Period From', 'Period To', 'Ingredient ID', 'Ingredient', 'Batch ID', 'Expiration Date', 'Current Quantity', 'Unit', 'Waste Record Count', 'Quantity Wasted In Period', 'Waste Cost In Period (PHP)', 'Data Status'], rows: [['ORPHAN_WASTE', '2026-10-14 10:00:00', '2026-10-14', '2026-10-14', missingInternalId, null, 'SL-1', '2026-10-20', 2, 'kg', 1, 0, 0, 'Missing ingredient reference']], dataRows: 1, empty: false },
};
const query = reportQuery('usage-consumption', { from: '2026-10-14', to: '2026-10-14' });
const reports = {
  table: async input => tables[input.reportId],
  auditWorkbook: async () => {},
};

test('combined workbook has valid ZIP, three worksheets, typed dates/numbers and safe text', async () => {
  const { Workbook } = (await import('@excel.js/exceljs')).default;
  const result = await reportWorkbook(reports, query, new Date('2026-10-14T02:00:00Z'));
  assert.equal(Buffer.from(result.buffer).subarray(0, 2).toString(), 'PK');
  assert.deepEqual(result.dataRows, [1, 1, 1]);
  assert.deepEqual(result.reports, [{ reportId: 'inventory-summary', dataRows: 1 }, { reportId: 'usage-consumption', dataRows: 1 }, { reportId: 'expiration-waste', dataRows: 1 }]);
  const opened = new Workbook();
  await opened.xlsx.load(result.buffer);
  assert.deepEqual(opened.worksheets.map(sheet => sheet.name), ['Inventory Summary', 'Usage & Consumption', 'Expiration & Waste']);
  const inventory = opened.getWorksheet('Inventory Summary');
  assert.equal(inventory.getRow(1).getCell(1).value, 'Inventory Summary');
  assert.equal(inventory.getRow(2).getCell(1).value, 'Report Prepared At (Philippine Time)');
  assert.equal(inventory.getRow(2).getCell(2).value, '2026-10-14 10:00:00');
  assert.ok(inventory.getRow(4).values.includes('Ingredient ID'));
  assert.ok(!inventory.getRow(4).values.includes('Record Type'));
  assert.equal(inventory.getRow(5).getCell(1).value, internalId);
  assert.equal(inventory.getRow(5).getCell(2).value, "'=Rice");
  assert.equal(inventory.getRow(5).getCell(8).value, 0);
  assert.equal(inventory.getRow(5).getCell(10).value, 0);
  assert.equal(inventory.getRow(6).getCell(2).value, 'Recorded Inventory Total');
  assert.equal(inventory.getRow(6).getCell(10).value, 0);
  assert.ok(opened.getWorksheet('Usage & Consumption').getRow(5).getCell(3).value instanceof Date);
  assert.equal(opened.getWorksheet('Usage & Consumption').getRow(5).getCell(1).value, internalId);
  assert.equal(opened.getWorksheet('Usage & Consumption').getRow(5).getCell(4).value, 3);
  assert.ok(opened.getWorksheet('Usage & Consumption').getRow(4).values.includes('Usage Date'));
  assert.ok(!opened.getWorksheet('Usage & Consumption').getRow(4).values.some(value => typeof value === 'string' && value.includes('(PHT)')));
  assert.equal(opened.getWorksheet('Expiration & Waste').getRow(5).getCell(1).value, missingInternalId);
  assert.equal(opened.getWorksheet('Expiration & Waste').getRow(5).getCell(9).value, 'Ingredient record unavailable');
  for (const sheet of opened.worksheets) {
    assert.ok(sheet.getRow(4).values.includes('Ingredient ID'));
  }
});

test('individual workbooks reopen with exactly the selected report and its mapped data', async () => {
  const { Workbook } = (await import('@excel.js/exceljs')).default;
  const expected = [
    ['inventory-summary', 'Inventory Summary', 5, 2, internalId],
    ['usage-consumption', 'Usage & Consumption', 4, 3, internalId],
    ['expiration-waste', 'Expiration & Waste', 8, 0, missingInternalId],
  ];
  for (const [reportId, name, dataColumn, expectedValue, expectedCode] of expected) {
    const result = await reportWorkbook(reports, query, new Date('2026-10-14T02:00:00Z'), reportId);
    const opened = new Workbook();
    await opened.xlsx.load(result.buffer);
    assert.deepEqual(opened.worksheets.map(sheet => sheet.name), [name]);
    assert.deepEqual(result.reports.map(report => report.reportId), [reportId]);
    assert.equal(opened.worksheets[0].getRow(5).getCell(dataColumn).value, expectedValue);
    assert.equal(opened.worksheets[0].getRow(5).getCell(1).value, expectedCode);
    if (reportId === 'inventory-summary') assert.equal(opened.worksheets[0].getRow(5).getCell(2).value, "'=Rice");
    assert.ok(opened.worksheets[0].getRow(4).values.includes('Ingredient ID'));
  }
});

test('workbook route denies non-report roles, audits before delivery and refuses audit failure', async t => {
  let status = 'Success';
  let lastActor;
  const auditCalls = [];
  const auth = { authenticate: async header => { if (!header) throw new HttpError(401, 'Authentication required'); return { id: 'a'.repeat(24), role: header.slice(7) === 'manager' ? 'Manager' : header.slice(7) }; } };
  const service = { ...reports, auditWorkbook: async (actor, _query, exportedReports, result) => { lastActor = actor; auditCalls.push({ reports: exportedReports, result }); if (status === 'Failed' && result === 'Success') throw new Error('audit unavailable'); } };
  const server = createApp([], () => true, auth, undefined, undefined, undefined, undefined, undefined, undefined, undefined, service).listen(0);
  t.after(() => new Promise(resolve => server.close(resolve)));
  const url = `http://127.0.0.1:${server.address().port}/api/reports/operational/export.xlsx?from=2026-10-14&to=2026-10-14`;
  const individualUrl = url.replace('/export.xlsx?', '/expiration-waste/export.xlsx?');
  assert.equal((await fetch(url)).status, 401);
  assert.equal((await fetch(individualUrl)).status, 401);
  for (const role of ['Inventory Staff', 'Super Admin']) assert.equal((await fetch(url, { headers: { Authorization: `Bearer ${role}` } })).status, 403);
  for (const role of ['Inventory Staff', 'Super Admin']) assert.equal((await fetch(individualUrl, { headers: { Authorization: `Bearer ${role}` } })).status, 403);
  const response = await fetch(url, { headers: { Authorization: 'Bearer manager' } });
  assert.equal(response.status, 200);
  assert.match(response.headers.get('content-type'), /spreadsheetml/);
  assert.match(response.headers.get('content-disposition'), /management-report-2026-10-14-2026-10-14.xlsx/);
  assert.equal(Buffer.from(await response.arrayBuffer()).subarray(0, 2).toString(), 'PK');
  assert.deepEqual(auditCalls[0], { reports: [{ reportId: 'inventory-summary', dataRows: 1 }, { reportId: 'usage-consumption', dataRows: 1 }, { reportId: 'expiration-waste', dataRows: 1 }], result: 'Success' });
  const individual = await fetch(individualUrl, { headers: { Authorization: 'Bearer manager' } });
  assert.equal(individual.status, 200);
  assert.match(individual.headers.get('content-disposition'), /expiration-waste-2026-10-14-2026-10-14\.xlsx/);
  const { Workbook } = (await import('@excel.js/exceljs')).default;
  const openedIndividual = new Workbook();
  await openedIndividual.xlsx.load(Buffer.from(await individual.arrayBuffer()));
  assert.deepEqual(openedIndividual.worksheets.map(sheet => sheet.name), ['Expiration & Waste']);
  assert.deepEqual(auditCalls[1], { reports: [{ reportId: 'expiration-waste', dataRows: 1 }], result: 'Success' });
  status = 'Failed';
  const failed = await fetch(url, { headers: { Authorization: 'Bearer manager' } });
  assert.equal(failed.status, 500);
  assert.doesNotMatch(failed.headers.get('content-type'), /spreadsheetml/);
  assert.equal(auditCalls.at(-1).result, 'Failed');
  assert.deepEqual(auditCalls.at(-1).reports, [{ reportId: 'inventory-summary', dataRows: 0 }, { reportId: 'usage-consumption', dataRows: 0 }, { reportId: 'expiration-waste', dataRows: 0 }]);
  const failedIndividual = await fetch(individualUrl, { headers: { Authorization: 'Bearer manager' } });
  assert.equal(failedIndividual.status, 500);
  assert.equal(auditCalls.at(-1).result, 'Failed');
  assert.deepEqual(auditCalls.at(-1).reports, [{ reportId: 'expiration-waste', dataRows: 0 }]);
  status = 'Success';
  const adminWorkbook = await fetch(url, { headers: { Authorization: 'Bearer Admin' } });
  assert.equal(adminWorkbook.status, 200);
  assert.match(adminWorkbook.headers.get('content-disposition'), /management-report-2026-10-14-2026-10-14.xlsx/);
  assert.equal(lastActor.role, 'Admin');
  const adminIndividual = await fetch(individualUrl, { headers: { Authorization: 'Bearer Admin' } });
  assert.equal(adminIndividual.status, 200);
  assert.equal(lastActor.role, 'Admin');
});

test('individual XLSX route audits its own report and rejects an invalid report/date query', async t => {
  const auditCalls = [];
  const auth = { authenticate: async () => ({ id: 'a'.repeat(24), role: 'Manager' }) };
  const service = { ...reports, auditWorkbook: async (_actor, _query, exportedReports, result) => auditCalls.push({ reports: exportedReports, result }) };
  const server = createApp([], () => true, auth, undefined, undefined, undefined, undefined, undefined, undefined, undefined, service).listen(0);
  t.after(() => new Promise(resolve => server.close(resolve)));
  const base = `http://127.0.0.1:${server.address().port}/api/reports/operational`;
  const params = '?from=2026-10-14&to=2026-10-14';
  assert.equal((await fetch(`${base}/bad-report/export.xlsx${params}`)).status, 400);
  assert.equal((await fetch(`${base}/inventory-summary/export.xlsx${params}`)).status, 400);
  const response = await fetch(`${base}/usage-consumption/export.xlsx${params}`);
  assert.equal(response.status, 200);
  assert.deepEqual(auditCalls[0], { reports: [{ reportId: 'usage-consumption', dataRows: 1 }], result: 'Success' });
});

test('any oversized worksheet rejects the entire workbook without truncation', async () => {
  for (const oversized of ['inventory-summary', 'usage-consumption', 'expiration-waste']) {
    const service = { table: async input => { if (input.reportId === oversized) { const error = new Error('Narrow the report'); error.status = 413; throw error; } return tables[input.reportId]; } };
    await assert.rejects(reportWorkbook(service, query), error => error.status === 413);
    await assert.rejects(reportWorkbook(service, query, new Date(), oversized), error => error.status === 413);
  }
});

test('forecasting report workbooks export individual sheets and enforce PoLP on XLSX endpoint', async t => {
  const { Workbook } = (await import('@excel.js/exceljs')).default;
  const mockTables = {
    'demand-forecast': { columns: ['Record Type', 'Generated At (PHT)', 'Ingredient ID', 'Ingredient', 'Category', 'Unit', 'Current Stock', 'Avg Daily Usage', 'Forecasted Demand', 'Stock Coverage (Days)', 'Risk Level', 'Recommended Action'], rows: [['INGREDIENT_FORECAST', '2026-10-14 10:00:00', internalId, 'Rice', 'Dry', 'kg', 20, 2, 60, 10, 'Low', 'Maintain Stock']], dataRows: 1, empty: false },
    'forecast-vs-actual': { columns: ['Date (PHT)', 'Ingredient ID', 'Ingredient', 'Category', 'Unit', 'Forecasted Demand', 'Actual Usage', 'Variance', 'Variance (%)', 'Status'], rows: [['2026-10-14', internalId, 'Rice', 'Dry', 'kg', 5, 4.5, -0.5, -10, 'Accurate (±10%)']], dataRows: 1, empty: false },
    'forecast-accuracy': { columns: ['Generated At (PHT)', 'Ingredient ID', 'Ingredient', 'Category', 'Unit', 'Accuracy Score (%)', 'Evaluation Status', 'Evaluated Days', 'MAE', 'RMSE', 'WAPE (%)', 'Notes'], rows: [['2026-10-14 10:00:00', internalId, 'Rice', 'Dry', 'kg', 92.5, 'Evaluated', 14, 0.4, 0.6, 7.5, 'Accuracy target met']], dataRows: 1, empty: false },
    'expiration-risk': { columns: ['Generated At (PHT)', 'Ingredient ID', 'Ingredient', 'Category', 'Batch ID', 'Expiration Date', 'Days to Expiry', 'On Hand Quantity', 'Unit', 'Avg Daily Usage', 'Projected Excess', 'At-Risk Cost (PHP)', 'Risk Level', 'FEFO Action'], rows: [['2026-10-14 10:00:00', internalId, 'Rice', 'Dry', 'SL-1', '2026-10-20', 6, 8, 'kg', 1, 2, 20, 'Medium', 'Priority Kitchen Prep (FEFO)']], dataRows: 1, empty: false },
    'ai-insights-recommendations': { columns: ['Generated At (PHT)', 'Ingredient ID', 'Ingredient', 'Category', 'Current Stock', 'Unit', 'Days of Supply', 'Risk Level', 'Action Priority', 'Recommended Action', 'Evidence & Operational Insight'], rows: [['2026-10-14 10:00:00', internalId, 'Rice', 'Dry', 8, 'kg', 8, 'Medium', 'P3 - Moderate', 'Monitor Stock', 'Supply covers 8 days']], dataRows: 1, empty: false },
  };
  const mockService = {
    table: async input => mockTables[input.reportId],
    auditWorkbook: async () => {},
  };

  const expectedSheets = [
    ['demand-forecast', 'Demand Forecast'],
    ['forecast-vs-actual', 'Forecast vs. Actual'],
    ['forecast-accuracy', 'Forecast Accuracy'],
    ['expiration-risk', 'Expiration Risk'],
    ['ai-insights-recommendations', 'AI Insights & Recommendations'],
  ];

  for (const [id, sheetName] of expectedSheets) {
    const res = await reportWorkbook(mockService, query, new Date('2026-10-14T02:00:00Z'), id);
    const opened = new Workbook();
    await opened.xlsx.load(res.buffer);
    assert.deepEqual(opened.worksheets.map(s => s.name), [sheetName]);
    assert.ok(opened.worksheets[0].getRow(5).values.includes(internalId));
    assert.ok(opened.worksheets[0].getRow(5).values.includes('Rice'));
  }

  // HTTP PoLP check: Admin forbidden, Manager allowed
  const auth = { authenticate: async header => ({ id: 'a'.repeat(24), role: header?.slice(7) === 'Admin' ? 'Admin' : 'Manager' }) };
  const server = createApp([], () => true, auth, undefined, undefined, undefined, undefined, undefined, undefined, undefined, mockService).listen(0);
  t.after(() => new Promise(resolve => server.close(resolve)));
  const port = server.address().port;

  const adminRes = await fetch(`http://127.0.0.1:${port}/api/reports/operational/demand-forecast/export.xlsx?from=2026-10-14&to=2026-10-14`, { headers: { Authorization: 'Bearer Admin' } });
  assert.equal(adminRes.status, 403);

  const managerRes = await fetch(`http://127.0.0.1:${port}/api/reports/operational/demand-forecast/export.xlsx?from=2026-10-14&to=2026-10-14`, { headers: { Authorization: 'Bearer Manager' } });
  assert.equal(managerRes.status, 200);
  assert.match(managerRes.headers.get('content-disposition'), /demand-forecast-2026-10-14-2026-10-14\.xlsx/);
});
