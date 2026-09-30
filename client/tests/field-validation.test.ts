import { expect, test } from 'vitest';
import { catalogueTextError, personNameError, proseTextError, recordDateError } from '../src/services/fieldValidation';
import { recordFormError } from '../src/pages/workspace/recordValidation';

test('client field contracts mirror the strict API-facing formats', () => {
  expect(personNameError("Ana-Maria O'Connor", 'Name')).toBe('');
  expect(personNameError('Ana123', 'Name')).not.toBe('');
  expect(catalogueTextError('Chicken Breast (Boneless)', 'Ingredient', 100, true)).toBe('');
  expect(catalogueTextError('Chicken <script>', 'Ingredient', 100, true)).not.toBe('');
  expect(proseTextError('Prepared for lunch.', 'Notes', 500)).toBe('');
  expect(proseTextError('@#$@', 'Notes', 500)).not.toBe('');
});

test('record dates cannot be implausibly old or in the future', () => {
  expect(recordDateError('1968-06-18', '2026-10-01')).not.toBe('');
  expect(recordDateError('2999-01-01', '2026-10-01')).not.toBe('');
  expect(recordDateError('2026-10-01', '2026-10-01')).toBe('');
  expect(recordFormError('waste', '1.250', 'Damaged', 'Dropped safely.', '2026-10-01')).toBeUndefined();
});
