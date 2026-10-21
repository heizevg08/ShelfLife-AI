const assert = require('node:assert/strict');
const { test } = require('node:test');
const { execFileSync } = require('node:child_process');
const { createInventoryBatchStore } = require('../dist/services/inventory-batch-store');

const id = value => ({ toString: () => String(value).padStart(24, '0') });
const date = value => new Date(`${value}T00:00:00.000Z`);
const ingredient = { _id: id(90), name: 'Ingredient', category: 'Pantry', unitOfMeasure: 'kg' };
const chain = rows => ({ lean: () => ({ exec: async () => rows }) });
const selectable = rows => ({ select: () => chain(rows) });
function batch(number, expiration, quantity = 1, createdAt = '2026-10-01') {
  return { _id: id(number), ingredientId: id(90), batchID: `B-${number}`, quantity, unit: 'kg', dateReceived: date('2026-10-01'), expirationDate: date(expiration), createdBy: id(91), createdAt: date(createdAt), updatedAt: date(createdAt) };
}
function store(rows) {
  return createInventoryBatchStore({}, { find: () => ({ sort: () => chain(rows) }) }, {}, { find: () => selectable([ingredient]) }, { find: () => selectable([]) }, {});
}

test('Manager FEFO filters before global sorting and pagination without changing ordinary lists', async () => {
  const rows = Array.from({ length: 12 }, (_, index) => batch(index + 1, `2026-11-${String(index + 10).padStart(2, '0')}`));
  rows.push(batch(13, '2026-10-12'), batch(14, '2026-10-10'), batch(15, '2026-10-09'), batch(16, '2026-10-11', 0));
  const inventory = store(rows);
  const now = new Date('2026-10-10T15:59:59.000Z');
  const eligible = await inventory.list({ page: 1, pageSize: 5, sort: 'fefo', eligibleFefo: true }, now);
  assert.deepEqual(eligible.items.map(item => item.batchID), ['B-13', 'B-1', 'B-2', 'B-3', 'B-4']);
  assert.equal(eligible.total, 13);
  const ordinary = await inventory.list({ page: 1, pageSize: 20, sort: 'fefo' }, now);
  assert.equal(ordinary.total, 16);
  // Still-usable batches come first in earliest-expiry order; the expired ones
  // (B-14, B-15) sink to the end, most recently expired first, and the depleted
  // batch B-16 (0 kg) ranks last of all because it holds nothing to use.
  assert.deepEqual(ordinary.items.slice(0, 3).map(item => item.batchID), ['B-13', 'B-1', 'B-2']);
  assert.equal(ordinary.items[ordinary.items.length - 1].batchID, 'B-16');
  assert.equal(ordinary.items[ordinary.items.length - 1].displayStatus, 'No Stock');
  assert.deepEqual(ordinary.items.slice(-3, -1).map(item => item.batchID), ['B-14', 'B-15']);
  const midnight = await inventory.list({ page: 1, pageSize: 5, sort: 'fefo', eligibleFefo: true }, new Date('2026-10-10T16:00:00.000Z'));
  assert.equal(midnight.items.some(item => item.batchID === 'B-14'), false);
});

test('Manager FEFO retains expiration, newer-created, then ID tie-breakers', async () => {
  const inventory = store([batch(2, '2026-10-20', 1, '2026-10-02'), batch(1, '2026-10-20', 1, '2026-10-02'), batch(3, '2026-10-20', 1, '2026-10-03')]);
  const result = await inventory.list({ page: 1, pageSize: 5, sort: 'fefo', eligibleFefo: true }, new Date('2026-10-10T00:00:00.000Z'));
  assert.deepEqual(result.items.map(item => item.batchID), ['B-3', 'B-2', 'B-1']);
});

test('Manager FEFO eligibility is independent of host timezone', () => {
  const script = `const {createInventoryBatchStore}=require(${JSON.stringify(require.resolve('../dist/services/inventory-batch-store'))}); const d=v=>new Date(v+'T00:00:00.000Z'); const id={toString:()=> '1'.repeat(24)}; const row={_id:id,ingredientId:id,batchID:'TOMORROW',quantity:1,unit:'kg',dateReceived:d('2026-10-01'),expirationDate:d('2026-10-11'),createdBy:id,createdAt:d('2026-10-01'),updatedAt:d('2026-10-01')}; const chain=x=>({lean:()=>({exec:async()=>x})}); const store=createInventoryBatchStore({}, {find:()=>({sort:()=>chain([row])})},{},{find:()=>({select:()=>chain([{_id:id,name:'A',category:'Pantry',unitOfMeasure:'kg'}])})},{find:()=>({select:()=>chain([])})},{}); store.list({page:1,pageSize:5,sort:'fefo',eligibleFefo:true},new Date('2026-10-10T15:59:59.000Z')).then(x=>process.stdout.write(String(x.total)));`;
  for (const tz of ['UTC', 'Asia/Manila', 'America/Los_Angeles']) {
    assert.equal(execFileSync(process.execPath, ['-e', script], { env: { ...process.env, TZ: tz }, encoding: 'utf8' }), '1');
  }
});
