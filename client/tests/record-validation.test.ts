import { describe, expect, test } from 'vitest';
import { manilaToday, recordFormError } from '../src/pages/workspace/recordValidation';

describe('usage and waste form validation', () => {
  test('rejects zero, negative, and over-precision quantities', () => {
    for (const value of ['0', '-1', '1.0001', 'not-a-number', '1'.repeat(19)]) expect(recordFormError('usage', value, '', '')).toBeTruthy();
    expect(recordFormError('usage', '1.250', '', '')).toBeUndefined();
  });
  test('requires notes for Other waste while retaining optional notes for other reasons', () => {
    expect(recordFormError('waste', '1', 'Other', '   ')).toContain('Notes are required');
    expect(recordFormError('waste', '1', 'Damaged', '')).toBeUndefined();
    expect(recordFormError('waste', '1', 'Other', 'Spillage during delivery')).toBeUndefined();
  });
  test('matches the server note and Manila future-date constraints', () => {
    expect(recordFormError('usage', '1', '', '@#$@')).toContain('standard text');
    expect(recordFormError('usage', '1', '', 'Prepared for lunch.', '2999-01-01')).toContain('today or an earlier date');
    expect(recordFormError('usage', '1', '', 'Prepared for lunch.', manilaToday())).toBeUndefined();
  });
});
