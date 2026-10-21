const largeNumberSuffixes = ['', 'K', 'M', 'B', 'T'];
const exactCurrencyFormatter = new Intl.NumberFormat('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
/**
 * Fit finite values into KPI cards using the familiar K/M/B/T scale.
 * @param value - Number to display.
 * @returns Compact value, or an unavailable marker for non-finite input.
 */
export function formatCompactNumber(value: number) {
  if (!Number.isFinite(value)) return '—';
  const magnitude = Math.abs(value);
  if (magnitude < 1_000) return value.toLocaleString('en-PH', { maximumFractionDigits: 1 });

  let exponent = Math.min(Math.floor(Math.log10(magnitude) / 3), largeNumberSuffixes.length - 1);
  if (exponent < largeNumberSuffixes.length - 1 && Math.round(magnitude / (1000 ** exponent) * 10) / 10 >= 1000) exponent += 1;
  const suffix = largeNumberSuffixes[exponent];
  if (suffix) {
    const scaled = value / (1000 ** exponent);
    // Keep summary cards on the familiar K/M/B/T scale. When a value exceeds that scale,
    // show a truthful lower bound instead of scientific notation or an unfamiliar suffix.
    if (exponent === largeNumberSuffixes.length - 1 && Math.abs(scaled) >= 1_000_000_000_000) {
      return value < 0 ? '−999.9T+' : '999.9T+';
    }
    const formatted = scaled.toLocaleString('en-PH', { maximumFractionDigits: 1 });
    return `${formatted}${suffix}`;
  }

  return value.toLocaleString('en-PH', { maximumFractionDigits: 1 });
}

/**
 * Apply the peso symbol to a compact KPI value.
 * @param value - Peso amount to display.
 * @returns Compact currency or an unavailable marker.
 */
export function formatCompactPeso(value: number) {
  if (!Number.isFinite(value)) return '—';
  return `₱${formatCompactNumber(value)}`;
}

/**
 * Keep monetary detail at two decimal places instead of compacting it.
 * @param value - Peso amount to display.
 * @returns Exact formatted currency.
 */
export function formatExactPeso(value: number) {
  return `₱${exactCurrencyFormatter.format(value)}`;
}
