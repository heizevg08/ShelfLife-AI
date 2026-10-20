import { test } from 'node:test';
import assert from 'node:assert/strict';
import { formatCompactNumber, formatCompactPeso } from '../src/utils/compact-number';

test('promotes rounded KPI values to the next compact suffix', () => {
  assert.equal(formatCompactNumber(999_999), '1M');
  assert.equal(formatCompactPeso(999_999), '₱1M');
  assert.equal(formatCompactNumber(-999_999), '-1M');
  assert.equal(formatCompactPeso(Number.POSITIVE_INFINITY), '—');
});
