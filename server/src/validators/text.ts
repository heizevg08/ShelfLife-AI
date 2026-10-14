import { invalid } from './administration';

// Keep identity fields human-readable while allowing common real-world names.
// These rules deliberately reject digits, control characters, and punctuation
// other than spaces, apostrophes, and hyphens.
const personName = /^[\p{L}\p{M}]+(?:[ '\-][\p{L}\p{M}]+)*$/u;

// Operational notes and descriptions may contain ordinary prose and numbers,
// but never control characters or markup/operator characters.
const prose = /^[\p{L}\p{M}\p{N}\s.,;:!?'"()&%/+\-]*$/u;
const catalogue = /^[\p{L}\p{M}\p{N}\s.,&%'()/+\-]*$/u;
const ingredientNameBrand = /^[\p{L}\p{M}\p{N}\s]*$/u;
const ingredientDescription = /^[\p{L}\p{M}\p{N}\s.,;:!?"'()&%/+\-]*$/u;
const batchCode = /^[A-Za-z0-9][A-Za-z0-9._/-]*$/;
const forbiddenText = /[\u0000-\u0008\u000B-\u001F\u007F-\u009F\u200B-\u200D\u2060\uFEFF]/u;

function normalise(value: string, field: string, singleLine = true) {
  if (forbiddenText.test(value) || (singleLine && /[\t\r\n]/u.test(value))) invalid(field, 'Control characters are not permitted');
  return value.normalize('NFC').trim().replace(/\s+/g, ' ');
}

export function personNameInput(value: unknown, field: string, required = true, max = 25): string {
  if (value === undefined && !required) return '';
  if (typeof value !== 'string') invalid(field);
  const clean = normalise(value, field);
  if ((required && !clean) || clean.length > max || (clean && !personName.test(clean))) {
    invalid(field, `Use 1–${max} letters, spaces, apostrophes, or hyphens`);
  }
  return clean;
}

export function catalogueText(value: unknown, field: string, required: boolean, max: number): string {
  if (value === undefined && !required) return '';
  if (typeof value !== 'string') invalid(field);
  const clean = normalise(value, field);
  if ((required && !clean) || clean.length > max || (clean && !catalogue.test(clean))) {
    invalid(field, required ? `Enter 1–${max} letters, numbers, and standard punctuation` : `Use at most ${max} letters, numbers, and standard punctuation`);
  }
  return clean;
}

export function ingredientNameBrandText(value: unknown, field: string, required: boolean): string {
  if (value === undefined && !required) return '';
  if (typeof value !== 'string') invalid(field);
  const clean = normalise(value, field);
  const letters = (clean.match(/[\p{L}\p{M}]/gu) || []).length;
  const numbers = (clean.match(/\p{N}/gu) || []).length;
  if ((required && !clean) || letters > 25 || numbers > 3 || (clean && !ingredientNameBrand.test(clean))) {
    invalid(field, 'Use at most 25 letters and 3 numbers, with no special characters');
  }
  return clean;
}

export function ingredientDescriptionText(value: unknown, field: string, required = false): string {
  if (value === undefined && !required) return '';
  if (typeof value !== 'string') invalid(field);
  const clean = normalise(value, field, false);
  const numbers = (clean.match(/\p{N}/gu) || []).length;
  const specialCharacters = (clean.match(/[^\p{L}\p{M}\p{N}\s]/gu) || []).length;
  if ((required && !clean) || clean.length > 100 || numbers > 12 || specialCharacters > 5 || (clean && !ingredientDescription.test(clean))) {
    invalid(field, 'Use at most 100 characters, 5 special characters, and 12 numbers');
  }
  return clean;
}

export function proseText(value: unknown, field: string, required: boolean, max: number): string {
  if (value === undefined && !required) return '';
  if (typeof value !== 'string') invalid(field);
  const clean = normalise(value, field, false);
  if ((required && !clean) || clean.length > max || (clean && !prose.test(clean))) {
    invalid(field, required ? `Enter 1–${max} characters using standard text and punctuation` : `Use at most ${max} characters using standard text and punctuation`);
  }
  return clean;
}

export function batchCodeInput(value: unknown): string {
  if (typeof value !== 'string') invalid('batchCode');
  if (forbiddenText.test(value) || /\s/u.test(value) || value !== value.trim()) invalid('batchCode', 'Batch codes cannot contain leading, trailing, or internal whitespace');
  const clean = value.normalize('NFC');
  if (!clean || clean.length > 100 || !batchCode.test(clean)) invalid('batchCode', 'Use 1–100 letters, numbers, dots, hyphens, underscores, or slashes');
  return clean;
}
