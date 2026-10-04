const prosePattern = /^[\p{L}\p{M}\p{N}\s.,;:!?'"()&%/+\-]*$/u;

export function manilaToday(now = new Date()) {
  const parts = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Manila', year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(now);
  const value = (type: 'year' | 'month' | 'day') => parts.find(part => part.type === type)?.value;
  return `${value('year')}-${value('month')}-${value('day')}`;
}

export function recordFormError(kind: 'usage' | 'waste', quantity: string, reason: string, notes: string, recordedAt?: string) {
  if (!/^(?:0|[1-9]\d{0,17})(?:\.\d{1,3})?$/.test(quantity) || BigInt(quantity.replace('.', '')) === 0n) return 'Enter a positive quantity with at most 3 decimal places and 18 integer digits.';
  if (recordedAt !== undefined && (!/^\d{4}-\d{2}-\d{2}$/.test(recordedAt) || recordedAt > manilaToday())) return 'Use today or an earlier date.';
  if (kind === 'waste' && !reason) return 'Select a waste reason.';
  if (kind === 'waste' && reason === 'Other' && !notes.trim()) return 'Notes are required when the reason is Other.';
  if (notes.length > 500) return 'Notes must be at most 500 characters.';
  if (notes.trim() && !prosePattern.test(notes.trim())) return 'Notes may contain standard text and punctuation only.';
  return undefined;
}
