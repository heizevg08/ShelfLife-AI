import type { DailyPoint } from './ManagerDailyRecordChart';
import type { WasteAnalytics, WasteReason } from '../../services/waste-records';

export function insightEmphasisSegments(text: string, anchors: readonly string[]): { text: string; emphasized: boolean }[] {
  const ordered = [...anchors].sort((a, b) => b.length - a.length);
  const pattern = new RegExp(`(${ordered.map(anchor => anchor.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|')})`, 'gi');
  return text.split(pattern).filter(Boolean).map(part => ({ text: part, emphasized: ordered.some(anchor => anchor.toLowerCase() === part.toLowerCase()) }));
}

const weekday = new Intl.DateTimeFormat('en-PH', { weekday: 'long', timeZone: 'UTC' });
const shortDate = new Intl.DateTimeFormat('en-PH', { month: 'short', day: 'numeric', timeZone: 'UTC' });
const list = new Intl.ListFormat('en-PH', { style: 'long', type: 'conjunction' });
const countText = (count: number) => `${count} ${count === 1 ? 'record' : 'records'}`;
const calendarLabel = (date: string, range: string) => {
  const value = new Date(`${date}T00:00:00Z`);
  // A week is short and weekdays are what the Manager thinks in, so the peak is named
  // by weekday. A month is long enough that a date reads more precisely than a
  // weekday that repeats four or five times over the period.
  return range === 'Today' ? 'today' : range === 'Monthly' ? shortDate.format(value) : weekday.format(value);
};

export function dailyPeakInsight(points: readonly DailyPoint[], kind: 'usage' | 'waste', range: string): string {
  const label = kind === 'usage' ? 'Usage' : 'Waste';
  // A day with no measurement is excluded from the peak rather than read as 0: a period
  // whose only entries are unmeasured would otherwise report "no records" as if it had
  // measured a quiet week. Usage & Waste always passes numbers, so its result is unchanged.
  const peak = Math.max(0, ...points.map(point => (typeof point[kind] === 'number' ? point[kind] : 0)));
  if (peak === 0) return `No ${kind} records in this period.`;
  if (range === 'Today') return `${label} today: ${countText(peak)}.`;
  const days = points.filter(point => point[kind] === peak);
  if (days.length > 1) return `${label} peaked on multiple days (${countText(peak)} each).`;
  return `${label} peaked on ${calendarLabel(days[0].date, range)} (${countText(peak)}).`;
}

export function zeroWasteReasonInsight(byReason: WasteAnalytics['byReason'], reasons: readonly WasteReason[]): string {
  const zero = reasons.filter(reason => byReason[reason] === 0);
  if (!zero.length) return 'Every supported waste reason has at least one record in this period.';
  return `No waste records for ${list.format(zero)} in this period.`;
}

// The zero-count reasons are shown as chips under one heading. The names are returned
// as a list, never a sentence, because the card renders them as separate chips.
export function zeroWasteReasonNames(byReason: WasteAnalytics['byReason'], reasons: readonly WasteReason[]): WasteReason[] {
  return reasons.filter(reason => (byReason[reason] ?? 0) === 0);
}

// The two summary tiles read the same record counts the bars do. Counting records, not
// quantities, keeps the figure unit-free: adding kilograms to litres would produce a
// number that means nothing.
export function wasteRecordCount(byReason: WasteAnalytics['byReason'], reasons: readonly WasteReason[]): number {
  return reasons.reduce((sum, reason) => sum + (byReason[reason] ?? 0), 0);
}

// The biggest cause is the reason (or reasons) sharing the highest record count. A tie
// names every tied reason instead of a count such as "2 reasons tied": the Manager's next
// action depends on WHICH causes lead, and the count alone answers a question nobody
// asked. Naming them still never picks a false winner, because all of them are shown.
// The reasons are filtered in the canonical WASTE_REASONS order, so the list is stable
// between renders. A period with no records reports unavailable, not a zero winner.
export function biggestWasteCause(byReason: WasteAnalytics['byReason'], reasons: readonly WasteReason[]): { value: string; note: string } {
  const total = wasteRecordCount(byReason, reasons);
  if (total === 0) return { value: '—', note: 'No waste records in this period' };
  const peak = Math.max(...reasons.map(reason => byReason[reason] ?? 0));
  // A zero peak cannot happen above (total > 0 means some reason is > 0), but the guard
  // keeps a malformed payload from ever printing "0 reasons" as a cause.
  if (peak <= 0) return { value: '—', note: 'No waste records in this period' };
  const tied = reasons.filter(reason => (byReason[reason] ?? 0) === peak);
  if (tied.length > 1) return { value: tied.join(', '), note: `${countText(peak)} each · ${Math.round(peak * tied.length / total * 100)}% of waste records` };
  return { value: tied[0], note: `${countText(peak)} · ${Math.round(peak / total * 100)}% of waste records` };
}

// General inventory guidance, shown only when the data points at one dominant cause and
// only as plain operational advice. It is deliberately not a prediction: nothing here is
// produced by a trained model, so the card never implies one made the suggestion.
export function wasteGuidance(byReason: WasteAnalytics['byReason'], reasons: readonly WasteReason[]): string | null {
  if (wasteRecordCount(byReason, reasons) === 0) return null;
  const peak = Math.max(...reasons.map(reason => byReason[reason] ?? 0));
  const tied = reasons.filter(reason => (byReason[reason] ?? 0) === peak);
  // Two equal causes give no single dominant one, so there is nothing specific to advise.
  if (tied.length > 1) return null;
  switch (tied[0]) {
    case 'Expired': return 'Most waste is Expired. Rotating stock so the nearest expiry is used first helps catch items before their date passes.';
    case 'Spoiled': return 'Most waste is Spoiled. Checking storage conditions and the shelf life recorded on delivery helps reduce it.';
    case 'Damaged': return 'Most waste is Damaged. Reviewing how stock is stored and handled on the floor helps reduce it.';
    case 'Over-prepared': return 'Most waste is Over-prepared. Preparing closer to the demand the records show helps reduce it.';
    default: return null;
  }
}

export function topWasteIngredientInsight(top: WasteAnalytics['topIngredients']): string {
  if (!top.length) return 'No top waste item in this period.';
  const peak = top[0].count;
  const tied = top.filter(item => item.count === peak);
  // The endpoint returns only five ranks. If all five tie, a sixth may also tie.
  // A general statement avoids implying this is the complete set of names.
  if (tied.length === top.length && top.length === 5) return `Multiple ingredients share the highest waste record count (${countText(peak)} each).`;
  if (tied.some(item => item.name.startsWith('Unavailable ingredient ('))) return tied.length === 1
    ? `Top waste ingredient name unavailable (${countText(peak)}).`
    : `Multiple ingredients share the highest waste record count (${countText(peak)} each); some names are unavailable.`;
  return `Top waste ${tied.length === 1 ? 'item' : 'items'}: ${list.format(tied.map(item => item.name))} (${countText(peak)}${tied.length > 1 ? ' each' : ''}).`;
}
