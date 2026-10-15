import { ManagerDailyRecordChart, ManagerDailyRecordLegend, type DailyPoint } from './ManagerDailyRecordChart';
import { Status } from './primitives';
import { businessDateSeries } from './forecast-chart-data';
import { businessDayRange, businessWeekRange } from '../../utils/business-day';

// Presentation for the Manager Alerts trend.
//
// WHY THESE PANELS MOUNT THE LOCKED CHART COMPONENTS RATHER THAN THEIR OWN: the owner
// approved Manager /UsageWaste as the authoritative chart reference, and Manager
// /Forecasting reuses it. Alerts therefore draws its trend through the same
// `ManagerDailyRecordChart` the other two pages use.
//
// The trend needs THREE lines here (High, Medium and Low) where the other two pages need
// two. The owner approved widening the shared chart to a configurable series count with
// defaults that reproduce the locked pages exactly, so the reference was generalised rather
// than copied: `labels` now carries one entry per drawn series, in order, and the chart
// draws exactly those. Usage & Waste and Forecasting still pass their two series and render
// unchanged.
//
// Every number these components draw comes from the caller. Nothing here fetches, predicts
// or invents a value, and the production route passes no measurement at all.

export type AlertPriorityKey = 'high' | 'medium' | 'low';

// The three priority lines, in order of seriousness. Order is meaningful: the first entry
// also supplies the chart's area fill and its left-most legend entry, exactly as the
// two-series pages rely on.
export const ALERT_PRIORITY_LABELS: Record<AlertPriorityKey, string> = { high: 'High', medium: 'Medium', low: 'Low' };

// The approved period contract, identical to Manager Forecasting's: This Week is the
// Philippine Monday-Sunday calendar week, while the numbered options are inclusive rolling
// windows of whole business days. No other period is offered, so the page can never name a
// window the rest of the application does not already understand.
export const ALERT_TREND_PERIODS = ['This Week', 'Last 7 Days', 'Last 30 Days', 'Last 90 Days'] as const;
export type AlertTrendPeriod = typeof ALERT_TREND_PERIODS[number];

// WHY THIS EXISTS: the locked reference chart keeps its date axis, gridlines and inset
// surface when a period holds no records, because it is ALWAYS handed the dates of the
// window that was selected - a week still has seven of them even when nothing happened on
// them. Alerts has no rows yet, so an empty list would drop the whole axis and leave a
// frame that could equally mean a failed load. These points carry NO measurement: all three
// priority slots stay absent, so nothing here can be read as a real alert count.
export function alertTrendPoints(period: AlertTrendPeriod): DailyPoint[] {
  const days = Number(period.match(/\d+/)?.[0] ?? 7);
  const { from, to } = period === 'This Week' ? businessWeekRange() : businessDayRange(days);
  return businessDateSeries(from, to).map(date => ({ date, usage: null, waste: null, high: null, medium: null, low: null }));
}

// This Week names its weekdays in the calendar-week form; the rolling windows label dates
// across their whole span. Both are the reference's own two modes, not new ones.
export const alertTrendAxis = (period: AlertTrendPeriod) => period === 'This Week' ? 'calendar-week' as const : 'rolling' as const;

export function AlertTrendLegend({ visible, onToggle }: { visible: Record<AlertPriorityKey, boolean>; onToggle: (key: AlertPriorityKey) => void }) {
  return <ManagerDailyRecordLegend<AlertPriorityKey> visible={visible} onToggle={onToggle} labels={ALERT_PRIORITY_LABELS} />;
}

export function AlertTrendChart({ ariaLabel, points, visible, period, emptyLabel, emptyDescription }: {
  ariaLabel: string;
  points: readonly DailyPoint[];
  visible: Record<AlertPriorityKey, boolean>;
  period: AlertTrendPeriod;
  emptyLabel: string;
  emptyDescription: string;
}) {
  return <ManagerDailyRecordChart
      ariaLabel={ariaLabel}
      points={points}
      visible={visible}
      labels={ALERT_PRIORITY_LABELS}
      dateAxis={alertTrendAxis(period)}
      valueSuffix=" alerts"
      svgLabel={`Alerts raised per day, split by priority. ${emptyDescription}`.trim()}
      emptyLabel={emptyLabel}
      emptyDescription={emptyDescription}
      emptyActions={<Status>Preview · data pending</Status>}
    />;
}
