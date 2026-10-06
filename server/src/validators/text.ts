import { invalid } from './administration';

// Keep identity fields human-readable while allowing common real-world names.
// These rules deliberately reject digits, control characters, and punctuation
// other than spaces, apostrophes, and hyphens.
const personName = /^[\p{L}\p{M}]+(?:[ '\-][\p{L}\p{M}]+)*$/u;

// Operational notes and descriptions may contain ordinary prose and numbers,
// but never control characters or markup/operator characters.
const prose = /^[\p{L}\p{M}\p{N}\s.,;:!?'"()&%/+\-]*$/u;
const catalogue = /^[\p{L}\p{M}\p{N}\s.,&'()/+\-]*$/u;
const batchCode = /^[A-Za-z0-9][A-Za-z0-9._/-]*$/;

function normalise(value: string) { return value.trim().replace(/\s+/g, ' '); }

export function personNameInput(value: unknown, field: string, required = true, max = 25): string {
  if (value === undefined && !required) return '';
  if (typeof value !== 'string') invalid(field);
  const clean = normalise(value);
  if ((required && !clean) || clean.length > max || (clean && !personName.test(clean))) {
    invalid(field, `Use 1–${max} letters, spaces, apostrophes, or hyphens`);
  }
  return clean;
}

export function catalogueText(value: unknown, field: string, required: boolean, max: number): string {
  if (value === undefined && !required) return '';
  if (typeof value !== 'string') invalid(field);
  const clean = normalise(value);
  if ((required && !clean) || clean.length > max || (clean && !catalogue.test(clean))) {
    invalid(field, required ? `Enter 1–${max} letters, numbers, and standard punctuation` : `Use at most ${max} letters, numbers, and standard punctuation`);
  }
  return clean;
}

export function proseText(value: unknown, field: string, required: boolean, max: number): string {
  if (value === undefined && !required) return '';
  if (typeof value !== 'string') invalid(field);
  const clean = normalise(value);
  if ((required && !clean) || clean.length > max || (clean && !prose.test(clean))) {
    invalid(field, required ? `Enter 1–${max} characters using standard text and punctuation` : `Use at most ${max} characters using standard text and punctuation`);
  }
  return clean;
}

export function batchCodeInput(value: unknown): string {
  if (typeof value !== 'string') invalid('batchCode');
  const clean = normalise(value);
  if (!clean || clean.length > 100 || !batchCode.test(clean)) invalid('batchCode', 'Use 1–100 letters, numbers, dots, hyphens, underscores, or slashes');
  return clean;
}
