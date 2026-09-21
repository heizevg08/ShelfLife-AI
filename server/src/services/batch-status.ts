import type { SystemConfig } from './system-config';

const manila = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Manila', year: 'numeric', month: '2-digit', day: '2-digit' });
export function manilaDate(now: Date) {
  const parts = Object.fromEntries(manila.formatToParts(now).map(part => [part.type, part.value]));
  return `${parts.year}-${parts.month}-${parts.day}`;
}
export function batchStatus(expirationDate: string, config: Pick<SystemConfig, 'approachingDays' | 'criticalDays'>, now: Date) {
  const days = (Date.parse(`${expirationDate}T00:00:00Z`) - Date.parse(`${manilaDate(now)}T00:00:00Z`)) / 86400000;
  if (days < 0) return 'Expired';
  if (days <= config.criticalDays) return 'Critical';
  if (days <= config.approachingDays) return 'Approaching Expiry';
  return 'Normal';
}
