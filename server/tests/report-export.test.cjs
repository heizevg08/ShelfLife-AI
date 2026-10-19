const { test } = require('node:test');
const assert = require('node:assert/strict');
const { reportQuery } = require('../dist/validators/report');
const { createReportExports, reportCsv } = require('../dist/services/report-export');
const { createApp } = require('../dist/app');
const { HttpError } = require('../dist/middleware/error.middleware');

const key = text => ({ toString: () => text });
const date = text => new Date(`${text}T00:00:00.000Z`);
const find = rows => ({ find: () => ({ select: () => ({ lean: () => ({ exec: async () => rows }) }) }) });
const batch = { _id: key('b1'), ingredientId: key('i1'), batchID: 'SL-1', quantity: 8, unit: 'kg', expirationDate: date('2026-10-20'), unitCost: 12 };
const ingredient = { _id: key('i1'), name: 'Rice', category: 'Dry', standardUnitCost: 10 };
function service({ batches = [batch], ingredients = [ingredient], usage = [], waste = [], audit = async () => {} } = {}) {
  return createReportExports({ batches: find(batches), ingredients: find(ingredients), usage: find(usage), waste: find(waste), audits: { create: audit } });
}

test('report ranges reject unknown inputs and retain inclusive day 90', () => {
  const valid = reportQuery('usage-consumption', { from: '2026-01-01', to: '2026-03-31' });
  assert.equal(valid.start.toISOString(), '2025-12-31T16:00:00.000Z');
  assert.equal(valid.end.toISOString(), '2026-03-31T16:00:00.000Z');
  for (const [name, params] of [['usage-consumption', { from: '2026-01-01', to: '2026-04-01' }], ['inventory-summary', { from: '2026-01-01' }], ['usage-consumption', { from: '2026-02-30', to: '2026-03-01' }], ['usage-consumption', { from: '2026-02-01', to: '2026-02-02', branch: 'x' }], ['bad', {}]]) {
    assert.throws(() => reportQuery(name, params), error => error.status === 400);
  }
});

test('inventory valuation is complete or unavailable and includes missing references', async () => {
  const data = service({ batches: [batch, { ...batch, _id: key('b2'), ingredientId: key('missing'), batchID: 'SL-2', unitCost: undefined, quantity: 2 }] });
  const result = await data.table(reportQuery('inventory-summary', {}));
  assert.equal(result.rows.length, 3);
  assert.equal(result.rows[0][11], 96);
  assert.equal(result.rows[1][11], null);
  assert.equal(result.rows[1][12], 'Missing ingredient reference');
  assert.equal(result.rows[2][11], null);
  assert.equal(result.rows[2][12], 'Unavailable');
  assert.equal((await service({ batches: [] }).table(reportQuery('inventory-summary', {}))).rows[0][11], 0);
});

test('orphan waste stays visible, units remain separate, and empty transactions export header only', async () => {
  const scope = reportQuery('expiration-waste', { from: '2026-10-14', to: '2026-10-14' });
  const waste = [{ batchId: key('gone'), ingredientId: key('i1'), unit: 'L', quantityWasted: 2, wasteCost: 29, dateWasted: date('2026-10-14') }];
  const result = await service({ waste }).table(scope);
  assert.equal(result.rows[1][0], 'ORPHAN_WASTE');
  assert.equal(result.rows[1][13], 'Missing batch reference');
  assert.equal(result.rows[1][8], null);
  assert.equal(result.rows[1][9], 'L');
  const empty = await service().table(scope);
  assert.equal(empty.rows.length, 0);
  assert.equal(reportCsv(empty).split('\r\n').length, 2);
});

test('usage grouping separates units, preserves missing ingredient, and CSV neutralizes formulas', async () => {
  const usage = [{ ingredientId: key('i1'), unit: 'kg', quantityUsed: 2, dateUsed: date('2026-10-14') }, { ingredientId: key('i1'), unit: 'L', quantityUsed: 1, dateUsed: date('2026-10-14') }, { ingredientId: key('gone'), unit: 'kg', quantityUsed: 0, dateUsed: date('2026-10-14') }];
  const result = await service({ usage }).table(reportQuery('usage-consumption', { from: '2026-10-14', to: '2026-10-14' }));
  assert.equal(result.rows.length, 3);
  assert.equal(result.rows.find(row => row[1] === 'gone')[6], 'Missing ingredient reference');
  assert.equal(result.rows.find(row => row[1] === 'gone')[4], 0);
  assert.match(reportCsv({ columns: ['Name'], rows: [['=SUM(1,1)']], dataRows: 1, empty: false }), /"'=SUM\(1,1\)"/);
  for (const value of ['+1', '-1', '@SUM(A1)', '\t=1', '  =1']) assert.ok(reportCsv({ columns: ['Name'], rows: [[value]], dataRows: 1, empty: false }).includes(`"'${value}"`));
  assert.ok(reportCsv({ columns: ['Name'], rows: [['Rice,"quoted"\nrow']], dataRows: 1, empty: false }).includes('"Rice,""quoted""\nrow"'));
});

test('more than 5,000 data rows fail closed instead of truncating', async () => {
  const batches = Array.from({ length: 5001 }, (_, index) => ({ ...batch, batchID: `SL-${index}`, _id: key(`b${index}`) }));
  await assert.rejects(service({ batches }).table(reportQuery('inventory-summary', {})), error => error.status === 413);
});

test('route denies unauthenticated and non-report callers before report generation', async t => {
  let reads = 0;
  const auth = { authenticate: async header => { if (!header) throw new HttpError(401, 'Authentication required'); return { id: 'a'.repeat(24), role: header.slice(7) === 'manager' ? 'Manager' : header.slice(7) }; } };
  const reports = { table: async () => { reads++; return { columns: ['Name'], rows: [], dataRows: 0, empty: true }; }, audit: async () => {} };
  const server = createApp([], () => true, auth, undefined, undefined, undefined, undefined, undefined, undefined, undefined, reports).listen(0);
  t.after(() => new Promise(resolve => server.close(resolve)));
  const url = `http://127.0.0.1:${server.address().port}/api/reports/operational/usage-consumption/preview?from=2026-10-14&to=2026-10-14`;
  assert.equal((await fetch(url)).status, 401);
  for (const role of ['Inventory Staff', 'Super Admin']) assert.equal((await fetch(url, { headers: { Authorization: `Bearer ${role}` } })).status, 403);
  assert.equal(reads, 0);
  assert.equal((await fetch(url, { headers: { Authorization: 'Bearer manager' } })).status, 200);
  assert.equal(reads, 1);
  assert.equal((await fetch(url, { headers: { Authorization: 'Bearer Admin' } })).status, 200);
  assert.equal(reads, 2);
  const legacyCsv = await fetch(url.replace('/preview?', '/export.csv?'), { headers: { Authorization: 'Bearer manager' } });
  assert.equal(legacyCsv.status, 404);
});

test('legacy CSV export route is unavailable', async t => {
  const auth = { authenticate: async () => ({ id: 'a'.repeat(24), role: 'Manager' }) };
  const reports = { table: async () => ({ columns: ['Name'], rows: [['Rice']], dataRows: 1, empty: false }), audit: async () => { throw new Error('audit unavailable'); } };
  const server = createApp([], () => true, auth, undefined, undefined, undefined, undefined, undefined, undefined, undefined, reports).listen(0);
  t.after(() => new Promise(resolve => server.close(resolve)));
  const response = await fetch(`http://127.0.0.1:${server.address().port}/api/reports/operational/inventory-summary/export.csv`);
  assert.equal(response.status, 404);
  assert.doesNotMatch(response.headers.get('content-type') ?? '', /text\/csv/);
  assert.doesNotMatch(await response.text(), /Rice/);
});

test('recent exports route denies other roles and scopes history to the authenticated account', async t => {
  let requestedActor;
  const auth = { authenticate: async header => { if (!header) throw new HttpError(401, 'Authentication required'); return { id: header === 'Bearer other' ? 'b'.repeat(24) : 'a'.repeat(24), role: header === 'Bearer manager' || header === 'Bearer other' ? 'Manager' : header.slice(7) }; } };
  const reports = { table: async () => { throw new Error('history must not read reports'); }, audit: async () => {}, recentExports: async actor => { requestedActor = actor; return [{ reportId: 'usage-consumption', format: 'xlsx', exportedAt: '2026-10-14T00:00:00.000Z', periodFrom: '2026-10-08', periodTo: '2026-10-14' }]; } };
  const server = createApp([], () => true, auth, undefined, undefined, undefined, undefined, undefined, undefined, undefined, reports).listen(0);
  t.after(() => new Promise(resolve => server.close(resolve)));
  const url = `http://127.0.0.1:${server.address().port}/api/reports/my-exports`;
  assert.equal((await fetch(url)).status, 401);
  for (const role of ['Inventory Staff', 'Super Admin']) assert.equal((await fetch(url, { headers: { Authorization: `Bearer ${role}` } })).status, 403);
  assert.equal(requestedActor, undefined);
  assert.equal((await fetch(`${url}?userId=${'b'.repeat(24)}`, { headers: { Authorization: 'Bearer manager' } })).status, 400);
  assert.deepEqual(await (await fetch(url, { headers: { Authorization: 'Bearer manager' } })).json(), { items: [{ reportId: 'usage-consumption', format: 'xlsx', exportedAt: '2026-10-14T00:00:00.000Z', periodFrom: '2026-10-08', periodTo: '2026-10-14' }] });
  assert.equal(requestedActor, 'a'.repeat(24));
  await fetch(url, { headers: { Authorization: 'Bearer other' } });
  assert.equal(requestedActor, 'b'.repeat(24));
  assert.equal((await fetch(url, { headers: { Authorization: 'Bearer Admin' } })).status, 200);
  assert.equal(requestedActor, 'a'.repeat(24));
});
