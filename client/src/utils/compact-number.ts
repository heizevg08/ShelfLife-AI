const largeNumberSuffixes = ['', 'K', 'M', 'B', 'T'];
const exactCurrencyFormatter = new Intl.NumberFormat('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
export function formatCompactNumber(value: number) {
  const magnitude = Math.abs(value);
  if (magnitude < 1_000) return value.toLocaleString('en-PH', { maximumFractionDigits: 1 });

  const exponent = Math.min(Math.floor(Math.log10(magnitude) / 3), largeNumberSuffixes.length - 1);
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

export function formatCompactPeso(value: number) {
  return `₱${formatCompactNumber(value)}`;
}

export function formatExactPeso(value: number) {
  return `₱${exactCurrencyFormatter.format(value)}`;
}
