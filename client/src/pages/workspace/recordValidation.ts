import { proseTextError, recordDateError } from '../../services/fieldValidation';

export function recordFormError(kind: 'usage' | 'waste', quantity: string, reason: string, notes: string, recordedAt?: string) {
  if (!/^(?:0|[1-9]\d*)(?:\.\d{1,3})?$/.test(quantity) || Number(quantity) <= 0) return 'Enter a positive quantity with at most 3 decimal places.';
  if (kind === 'waste' && !reason) return 'Select a waste reason.';
  if (kind === 'waste' && reason === 'Other' && !notes.trim()) return 'Notes are required when the reason is Other.';
  const notesError = proseTextError(notes, 'Notes', 500);
  if (notesError) return notesError;
  if (recordedAt) return recordDateError(recordedAt) || undefined;
  return undefined;
}
