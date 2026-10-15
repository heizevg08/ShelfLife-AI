import { businessDateInputValue } from './business-day';

export type FefoUrgency = { label: 'High' | 'Medium' | 'Low'; tone: 'critical' | 'attention' | 'success'; daysRemaining: number };

// Inventory expiration is a date-only field serialized by the API at UTC midnight.
// Compare calendar dates, not instants, so today's batch remains High through
// the end of the Philippine business day in every browser timezone.
export function fefoUrgency(expirationDate: string, reference: Date = new Date()): FefoUrgency | null {
  const expiry = /^(\d{4})-(\d{2})-(\d{2})(?:T00:00:00(?:\.000)?Z)?$/.exec(expirationDate);
  if (!expiry) return null;
  const today = businessDateInputValue(reference);
  const [year, month, day] = today.split('-').map(Number);
  const daysRemaining = Math.round((Date.UTC(Number(expiry[1]), Number(expiry[2]) - 1, Number(expiry[3])) - Date.UTC(year, month - 1, day)) / 86_400_000);
  if (daysRemaining < 0) return null;
  if (daysRemaining <= 3) return { label: 'High', tone: 'critical', daysRemaining };
  if (daysRemaining <= 7) return { label: 'Medium', tone: 'attention', daysRemaining };
  return { label: 'Low', tone: 'success', daysRemaining };
}
