// Types and pure helpers for the three approved Manager Forecasting panels.
//
// The chart these helpers feed is the Manager Usage & Waste trend, which the owner
// approved as the presentation reference for the applicable Manager modules. So this
// module depends on that component's own point type rather than defining a second one:
// Forecasting maps its series onto the reference chart's two value slots.
//
// This module intentionally contains types and deterministic transformations only. The
// production Manager /Forecasting page renders truthful unavailable states until an
// authoritative forecasting service exists. Nothing here is a measurement, model output,
// prediction, development fixture, or synthetic dataset.
import type { DailyPoint } from './ManagerDailyRecordChart';
import { shiftBusinessDate } from '../../utils/business-day';

export type ForecastSeriesKey = 'forecast' | 'actual';

// A point distinguishes three different facts that a number alone cannot:
//   forecast: null  -> no forecast was produced for this day (unavailable)
//   actual:   null  -> nothing was recorded for this day (unavailable)
//   0               -> a real, measured zero
// Collapsing null into 0 would draw a line dropping to the baseline, which reads as
// "demand was zero" rather than "we do not know". That is the one lie these panels must
// never tell, so the chart plots only non-null values and breaks the line across gaps.
export type ForecastPoint = { date: string; forecast: number | null; actual: number | null };

export type ForecastSeriesMeta = { ingredient: string; unit: string; asOf: string; horizonDays: number };

export type DemandKind = 'historical' | 'forecast';

// WHY UNIT IS PART OF THE ITEM, NOT A COLUMN: ingredient units are free text on the real
// records, and kilograms, litres and pieces are not addable. Carrying the unit on every
// item means a total can only ever be computed inside one unit, so no view built on this
// helper can produce a physically meaningless sum.
export type CategoryDemandItem = { category: string; unit: string; value: number; kind: DemandKind };

export type ForecastInsightTone = 'critical' | 'attention' | 'neutral' | 'positive';

// An insight carries the REASON and the EVIDENCE in plain words, never a score. There is
// no approved risk formula, so no card may show a risk index, a confidence percentage or
// a ranked severity number: those would imply a calculation that does not exist.
export type ForecastInsight = {
  id: string;
  ingredient: string;
  batchId: string;
  reason: string;
  evidence: string;
  action: string;
  tone: ForecastInsightTone;
  // Potential waste is only shown where the caller supplies a real quantity and cost.
  // A card without them renders no waste line at all rather than a dash that could be
  // mistaken for a measured value.
  potentialWasteQuantity?: number;
  unit?: string;
  potentialWasteCost?: number;
  expiresOn?: string;
};

// ---------------------------------------------------------------------------
// Pure helpers. Kept free of DOM and React so the rules can be tested directly.
// ---------------------------------------------------------------------------

export const isMeasured = (value: number | null | undefined): value is number =>
  typeof value === 'number' && Number.isFinite(value);

// Adapter onto the Manager Usage & Waste trend chart. Its two value slots are named for
// their first user, so Forecasting maps its own series onto them and passes its own
// labels. A `null` in either series stays `null`: the chart reads that as "not measured"
// and breaks the line, which is exactly the Forecast/Available distinction we need. The
// dates are already one row per business day, so no gap filling happens here.
export const toDailyPoints = (points: readonly ForecastPoint[]): DailyPoint[] =>
  points.map(point => ({ date: point.date, usage: point.forecast, waste: point.actual }));

// The business calendar dates from `from` to `to` inclusive, one row per day.
//
// WHY THIS EXISTS: the approved reference chart keeps its date axis and gridlines when a
// period holds no records, because it is ALWAYS handed the window that was selected - a
// week still has seven dates even when nothing happened on them. Forecasting has no rows
// at all yet, so passing an empty list dropped the whole axis and left a frame that could
// equally mean a failed load. Building the window's dates restores the reference's empty
// chart surface without inventing a single measurement.
export function businessDateSeries(from: string, to: string): string[] {
  const dates: string[] = [];
  for (let date = from; date <= to; date = shiftBusinessDate(date, 1)) dates.push(date);
  return dates;
}

// One point per business day in the window, with BOTH series absent. `null` is the
// truthful value here: no forecast was produced and nothing was recorded. It must never be
// `0`, which the chart would draw as a measured zero and a Manager would read as "demand
// was nothing that day" rather than "there is no forecast yet".
export const emptyForecastWindow = (from: string, to: string): ForecastPoint[] =>
  businessDateSeries(from, to).map(date => ({ date, forecast: null, actual: null }));

// One contiguous run of measured days becomes one line segment. A gap ENDS the segment
// instead of being bridged, so the drawn line never crosses a day whose value is unknown.
// A run of a single day yields a segment of length 1, which the chart renders as a dot
// with no line - an isolated measurement is still a measurement.
export function forecastSegments(points: readonly ForecastPoint[], key: ForecastSeriesKey): number[][] {
  const runs: number[][] = [];
  let run: number[] = [];
  points.forEach((point, index) => {
    if (!isMeasured(point[key])) {
      if (run.length) runs.push(run);
      run = [];
      return;
    }
    run.push(index);
  });
  if (run.length) runs.push(run);
  return runs;
}

// The days a series cannot draw, reported so the panel can say WHY the line stops rather
// than leaving a silent break a Manager would read as a rendering fault.
export const missingDays = (points: readonly ForecastPoint[], key: ForecastSeriesKey): string[] =>
  points.filter(point => !isMeasured(point[key])).map(point => point.date);

// Ingredient quantities are real numbers, not record counts, so the axis allows a
// fractional step. It still walks the same 1-2-2.5-5-10 family and always starts at zero,
// so every gridline lands on a value a person reads at a glance.
export function quantityAxisScale(peak: number, intervals = 4): { step: number; ceiling: number; ticks: number[] } {
  const safe = Math.max(0, peak);
  if (safe <= 0) return { step: 1, ceiling: 0, ticks: [0] };
  const rough = safe / intervals;
  const magnitude = 10 ** Math.floor(Math.log10(rough));
  const step = [1, 2, 2.5, 5, 10].map(multiplier => multiplier * magnitude)
    .find(candidate => Math.ceil(safe / candidate) <= intervals) ?? rough;
  const ceiling = Number((Math.ceil(safe / step) * step).toFixed(6));
  const count = Math.round(ceiling / step);
  return { step, ceiling, ticks: Array.from({ length: count + 1 }, (_, index) => Number((index * step).toFixed(6))) };
}

export const formatQuantity = (value: number): string =>
  Number.isInteger(value) ? value.toLocaleString() : value.toFixed(1);

// Which day labels to draw on the date axis. Every `every`th day is labelled, and the last
// day is always named so the window's end is readable. On a narrow screen those two rules
// can collide: when the final day lands immediately after the last regular label, the two
// labels overlap into unreadable text. That regular label is therefore dropped, keeping the
// row evenly spread. The final day is never dropped - the window must stay readable.
export function axisLabelIndices(length: number, every: number): number[] {
  if (length <= 0) return [];
  const step = Math.max(1, every);
  const indices = Array.from({ length }, (_, index) => index).filter(index => index % step === 0);
  const last = length - 1;
  if (indices[indices.length - 1] !== last) {
    const previous = indices[indices.length - 1];
    if (previous !== undefined && last - previous < step) indices.pop();
    indices.push(last);
  }
  return indices;
}

// Grouping by unit is the enforcement point for "compare compatible units only". Two
// categories measured in kilograms and litres can never appear in the same ranking,
// because the group key includes the unit and no cross-group total is ever produced.
export function demandByUnit(items: readonly CategoryDemandItem[], kind: DemandKind): { unit: string; items: { label: string; value: number }[] }[] {
  const groups = new Map<string, { label: string; value: number }[]>();
  for (const item of items) {
    if (item.kind !== kind) continue;
    const bucket = groups.get(item.unit) ?? [];
    bucket.push({ label: item.category, value: item.value });
    groups.set(item.unit, bucket);
  }
  // Highest first inside each unit, and a stable name tie-break so the order is
  // deterministic when two categories hold the same value.
  return [...groups.entries()]
    .map(([unit, rows]) => ({ unit, items: rows.sort((a, b) => b.value - a.value || a.label.localeCompare(b.label)) }))
    .sort((a, b) => a.unit.localeCompare(b.unit));
}

export const demandUnits = (items: readonly CategoryDemandItem[]): string[] =>
  [...new Set(items.map(item => item.unit))].sort((a, b) => a.localeCompare(b));

// Worst first, so the Manager reads the items needing attention before the quiet ones.
// Ordering uses only the declared tone, never an invented severity number.
const TONE_ORDER: Record<ForecastInsightTone, number> = { critical: 0, attention: 1, neutral: 2, positive: 3 };
export const rankInsights = (insights: readonly ForecastInsight[]): ForecastInsight[] =>
  [...insights].sort((a, b) => TONE_ORDER[a.tone] - TONE_ORDER[b.tone] || a.ingredient.localeCompare(b.ingredient) || a.batchId.localeCompare(b.batchId));
