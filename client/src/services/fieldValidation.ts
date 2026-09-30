const personName = /^[\p{L}\p{M}]+(?:[ '\-][\p{L}\p{M}]+)*$/u;
const catalogue = /^[\p{L}\p{M}\p{N}\s.,&'()/+\-]*$/u;
const prose = /^[\p{L}\p{M}\p{N}\s.,;:!?'"()&%/+\-]*$/u;

export function personNameError(value: string, label: string, max = 25) {
  const clean = value.trim().replace(/\s+/g, ' ');
  return !clean || clean.length > max || !personName.test(clean)
    ? `${label} must use 1–${max} letters, spaces, apostrophes, or hyphens.` : '';
}

export function catalogueTextError(value: string, label: string, max: number, required = false) {
  const clean = value.trim().replace(/\s+/g, ' ');
  if (!clean && !required) return '';
  return !clean || clean.length > max || !catalogue.test(clean)
    ? `${label} must use ${required ? `1–${max}` : `at most ${max}`} letters, numbers, and standard punctuation.` : '';
}

export function proseTextError(value: string, label: string, max: number, required = false) {
  const clean = value.trim().replace(/\s+/g, ' ');
  if (!clean && !required) return '';
  return !clean || clean.length > max || !prose.test(clean)
    ? `${label} must use ${required ? `1–${max}` : `at most ${max}`} characters with standard text and punctuation.` : '';
}

export function manilaToday() {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Manila', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
}

export function recordDateError(value: string, today = manilaToday()) {
  return !/^\d{4}-\d{2}-\d{2}$/.test(value) || value < '2020-01-01' || value > today
    ? `Recorded date must be from 2020-01-01 through ${today}.` : '';
}
