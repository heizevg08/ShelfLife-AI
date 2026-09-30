import { describe, expect, test } from 'vitest';
import { recordFormError } from '../src/pages/workspace/recordValidation';

describe('usage and waste form validation', () => {
  test('rejects zero, negative, and over-precision quantities', () => {
    for (const value of ['0', '-1', '1.0001', 'not-a-number']) expect(recordFormError('usage', value, '', '')).toBeTruthy();
    expect(recordFormError('usage', '1.250', '', '')).toBeUndefined();
  });
  test('requires notes for Other waste while retaining optional notes for other reasons', () => {
    expect(recordFormError('waste', '1', 'Other', '   ')).toContain('Notes are required');
    expect(recordFormError('waste', '1', 'Damaged', '')).toBeUndefined();
    expect(recordFormError('waste', '1', 'Other', 'Spillage during delivery')).toBeUndefined();
  });
});
