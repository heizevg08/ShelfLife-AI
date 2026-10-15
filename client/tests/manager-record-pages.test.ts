import assert from 'node:assert/strict';
import test from 'node:test';
import { collectRecordPages } from '../src/components/application/manager-record-pages';

test('collects every API page before local ledger filters and counts run', async () => {
  const calls: number[] = [];
  const records = Array.from({ length: 307 }, (_, index) => index);
  const result = await collectRecordPages(async page => {
    calls.push(page);
    return { items: records.slice((page - 1) * 150, page * 150), total: records.length, page, pageSize: 150 };
  });
  assert.deepEqual(calls, [1, 2, 3]);
  assert.deepEqual(result, records);
});

test('fails closed if a paginated response omits records', async () => {
  await assert.rejects(collectRecordPages(async page => ({ items: page === 1 ? [1] : [], total: 2, page, pageSize: 1 })), /Incomplete record list/);
});

test('empty pages are complete, while changing metadata or duplicate records fail closed', async () => {
  assert.deepEqual(await collectRecordPages(async page => ({ items: [], total: 0, page, pageSize: 150 })), []);
  await assert.rejects(collectRecordPages(async page => ({ items: [{ id: 'same' }], total: 2, page, pageSize: 1 }), item => item.id), /Incomplete record list/);
  await assert.rejects(collectRecordPages(async page => ({ items: [page], total: page === 1 ? 2 : 3, page, pageSize: 1 })), /Incomplete record list/);
});
