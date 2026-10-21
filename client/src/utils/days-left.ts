/**
 * Show a batch's remaining days without counting past its expiration date.
 * Expired batches stop at zero; the Status column says "Expired" instead.
 * @param daysLeft - Whole days until expiry; negative once expired.
 * @returns Remaining days, never below zero.
 */
export function daysLeftRemaining(daysLeft: number) {
  return Math.max(0, daysLeft);
}
