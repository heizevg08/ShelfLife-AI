const { test } = require('node:test');
const assert = require('node:assert/strict');
const { inventoryBatchWorkbook } = require('../dist/services/inventory-batch-workbook');
const { createApp } = require('../dist/app');
const { HttpError } = require('../dist/middleware/error.middleware');

const batch = {
  id: 'a'.repeat(24), batchID: 'SL-20261010-001',
  ingredient: { id: 'b'.repeat(24), name: '=Rice', category: 'Pantry', unitOfMeasure: 'kg' },
  quantity: 12.5, unit: 'kg', dateReceived: '2026-10-10T00:00:00.000Z', expirationDate: '2026-11-10T00:00:00.000Z',
  displayStatus: 'In Stock', daysLeft: 31, createdBy: { id: 'c'.repeat(24), name: 'Admin User' },
  createdAt: '2026-10-10T00:00:00.000Z', updatedAt: '2026-10-10T00:00:00.000Z',
};
const auditCalls = [];
const service = {
  list: async query => ({ items: query.page === 1 ? [batch] : [], page: query.page, pageSize: query.pageSize, total: 1 }),
  detail: async () => batch, summary: async () => ({}), stockInSummary: async () => ({}), auditExport: async (...args) => { auditCalls.push(args); }, create: async () => null, createMany: async () => [], ready: async () => {},
};

test('Admin inventory-period workbook follows the established XLSX format and preserves typed values', async () => {
  const { Workbook } = (await import('@excel.js/exceljs')).default;
  const result = await inventoryBatchWorkbook(service, { page: 1, pageSize: 150 }, new Date('2026-10-16T00:00:00Z'));
  assert.equal(Buffer.from(result.buffer).subarray(0, 2).toString(), 'PK');
  assert.equal(result.dataRows, 1);
  const opened = new Workbook();
  await opened.xlsx.load(result.buffer);
  const sheet = opened.getWorksheet('Inventory Period');
  assert.equal(sheet.getRow(1).getCell(1).value, 'Inventory Period Report');
  assert.equal(sheet.getRow(2).getCell(1).value, 'Report Prepared At (Philippine Time)');
  assert.deepEqual(sheet.getRow(4).values.slice(1), ['Ingredient', 'Batch ID', 'Quantity', 'Unit', 'Date Received', 'Expiration Date', 'Status']);
  assert.equal(sheet.getRow(5).getCell(1).value, "'=Rice");
  assert.equal(sheet.getRow(5).getCell(3).value, 12.5);
  assert.ok(sheet.getRow(5).getCell(5).value instanceof Date);
});

test('inventory-period XLSX route is Admin-only and validates inclusive date parameters', async t => {
  const auth = { authenticate: async header => { if (!header) throw new HttpError(401, 'Authentication required'); return { id: 'd'.repeat(24), role: header.slice(7) }; } };
  const server = createApp([], () => true, auth, undefined, undefined, undefined, service).listen(0);
  t.after(() => new Promise(resolve => server.close(resolve)));
  const base = `http://127.0.0.1:${server.address().port}/api/inventory-batches/export.xlsx`;
  assert.equal((await fetch(base)).status, 401);
  for (const role of ['Manager', 'Inventory Staff', 'Super Admin']) assert.equal((await fetch(base, { headers: { Authorization: `Bearer ${role}` } })).status, 403);
  assert.equal((await fetch(`${base}?from=2026-10-11&to=2026-10-10`, { headers: { Authorization: 'Bearer Admin' } })).status, 400);
  const response = await fetch(`${base}?from=2026-10-10&to=2026-10-10`, { headers: { Authorization: 'Bearer Admin' } });
  assert.equal(response.status, 200);
  assert.match(response.headers.get('content-type'), /spreadsheetml/);
  assert.match(response.headers.get('content-disposition'), /inventory-period-report-2026-10-10-2026-10-10\.xlsx/);
  assert.equal(Buffer.from(await response.arrayBuffer()).subarray(0, 2).toString(), 'PK');
  assert.deepEqual(auditCalls.at(-1).slice(1), ['2026-10-10', '2026-10-10', 1]);
  assert.equal(auditCalls.at(-1)[0].role, 'Admin');
});
