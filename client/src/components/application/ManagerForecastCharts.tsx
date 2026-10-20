import { ApplicationBarBreakdown, ApplicationPendingState } from './ApplicationPatterns';
import { ManagerDailyRecordChart, ManagerDailyRecordLegend, type DailyPoint, type DailySeries } from './ManagerDailyRecordChart';
import { formatCompactPeso, formatExactPeso } from '../../utils/compact-number';
import {
  formatQuantity,
  rankInsights,
  toDailyPoints,
  type CategoryDemandItem,
  type DemandKind,
  type ForecastInsight,
  type ForecastPoint,
  type ForecastSeriesKey,
  type ForecastSeriesMeta,
} from './forecast-chart-data';

// Presentation for the retained Manager Forecasting trend and insights panels.
//
// WHY THESE PANELS RENDER THE USAGE & WASTE COMPONENTS RATHER THAN THEIR OWN: the owner
// approved Manager /UsageWaste as the authoritative reference for chart presentation
// across the applicable Manager modules. An earlier pass here drew a chart that merely
// LOOKED like that one - its own markup, its own `sl-mgr-fc-*` class names, its own copy
// of the plot panel, gridlines and tooltip. That is an imitation: the two charts drift
// apart the moment either is touched, and a Manager sees two different chart idioms in
// one application. So the trend panel below mounts `ManagerDailyRecordChart` itself, and
// the bar panel mounts `ApplicationBarBreakdown` itself. Forecasting supplies its own
// labels, values and empty state through the props those components already expose; it
// does not restyle them.
//
// Every number these components draw comes from the caller. They never fetch, never
// compute a prediction and never invent a value; the production route passes nothing
// until a real forecasting service exists.

// The reference chart's two value slots are named for their first user. Forecasting
// renames them for display only: slot `usage` carries the Forecast series and slot `waste`
// carries the Actual series. The class names, plot, gridlines and tooltip are unchanged,
// so the two pages keep one chart grammar.
const FORECAST_LABELS: Record<DailySeries, string> = { usage: 'Forecast', waste: 'Actual' };
const SERIES_ORDER: readonly ForecastSeriesKey[] = ['forecast', 'actual'];
const SERIES_SLOT: Record<ForecastSeriesKey, DailySeries> = { forecast: 'usage', actual: 'waste' };
const slotVisible = (visible: Record<ForecastSeriesKey, boolean>): Record<DailySeries, boolean> =>
  ({ usage: visible.forecast, waste: visible.actual });

const shortDate = new Intl.DateTimeFormat('en-PH', { month: 'short', day: 'numeric', timeZone: 'UTC' }).format;
const dateLabel = (date: string) => shortDate(new Date(`${date}T00:00:00Z`));

// Forecast Insights uses the established system-wide empty state. The trend uses
// the shared chart's in-plot panel, while empty demand follows the locked reason
// card's tile-and-explanation hierarchy without supplying a category value.
export function ForecastPanelPending({ description }: { description: string }) {
  return <div className="sl-mgr-fc-pending"><ApplicationPendingState description={description} /></div>;
}

// ---------------------------------------------------------------------------
// Forecast vs. Actual
// ---------------------------------------------------------------------------

// The Usage & Waste trend card, with its two series relabelled. Nothing about the plot,
// the gridlines, the axes, the tooltip or the responsive behaviour is reimplemented here.
//
// A gap in a series stays a gap inside that component: a measured zero is a real point on
// the baseline, while a day with no forecast ends the line and is named in the note below
// the plot. Bridging a gap would draw a straight line through days nobody measured;
// dropping it silently would hide that the record is missing. Neither is acceptable on a
// decision-support surface, and the note is what tells the Manager which of the two
// happened.
export function ForecastVsActualChart({
  ariaLabel,
  points,
  meta,
  visible,
  calendarWeek = false,
  emptyLabel = 'No forecast plotted yet',
  emptyDescription,
}: {
  ariaLabel: string;
  points: readonly ForecastPoint[];
  meta: ForecastSeriesMeta;
  visible: Record<ForecastSeriesKey, boolean>;
  calendarWeek?: boolean;
  emptyLabel?: string;
  emptyDescription?: string;
}) {
  const daily: DailyPoint[] = toDailyPoints(points);

  // A day the model did not predict and a day nothing was recorded on are both "no
  // measurement": each is absent from the series rather than drawn as zero.
  const forecastDays = points.filter(point => point.forecast !== null).length;
  const actualDays = points.filter(point => point.actual !== null).length;
  const drawable = forecastDays > 0 || actualDays > 0;

  // Both missing facts are named in words, so a Manager reads why a line stops instead of
  // assuming the panel failed to load.
  const gaps = SERIES_ORDER.filter(series => visible[series]).flatMap(series =>
    points.filter(point => point[series] === null).map(point => `${FORECAST_LABELS[SERIES_SLOT[series]].toLowerCase()} for ${dateLabel(point.date)}`));

  return <div className="sl-mgr-fc-trend">
    {/* The subject line names the ingredient, the unit and the forecast's own horizon, so
        it is drawn only when a forecast is actually plotted. With no data it would state a
        forecast date and horizon for a prediction that does not exist. */}
    {drawable && <p className="sl-mgr-fc-subject">
      <strong>{meta.ingredient}</strong><span aria-hidden="true"> · </span>{meta.unit}
      <span aria-hidden="true"> · </span>forecast made {dateLabel(meta.asOf)}
      <span aria-hidden="true"> · </span>{meta.horizonDays}-day horizon
    </p>}
    <ManagerDailyRecordChart
      ariaLabel={ariaLabel}
      points={daily}
      visible={slotVisible(visible)}
      dateAxis={calendarWeek ? 'calendar-week' : 'rolling'}
      labels={FORECAST_LABELS}
      valueSuffix={` ${meta.unit}`}
      svgLabel={drawable
        ? `Forecast and actual ${meta.unit} of ${meta.ingredient} by date. Focus or select a point for its exact value.`
        : `Forecast versus actual chart, no data plotted yet. ${emptyDescription ?? ''}`.trim()}
      emptyLabel={emptyLabel}
      emptyDescription={emptyDescription ?? 'Forecasted and actual consumption will be plotted here once a validated forecasting service supplies them.'}
    />
    {drawable && <p className="sl-mgr-fc-gap-note sl-sr-only">{gaps.length
      ? `Not plotted: ${gaps.join(', ')}. A missing day is left blank rather than drawn as zero.`
      : 'Every day in this window has both a forecast and a recorded actual.'}</p>}
  </div>;
}

export function ForecastVsActualLegend({ visible, onToggle }: { visible: Record<ForecastSeriesKey, boolean>; onToggle: (series: ForecastSeriesKey) => void }) {
  // The reference legend itself, driven by the Forecast/Actual slots. Its class names,
  // pressed state and "last series cannot switch off" behaviour are the established ones.
  return <ManagerDailyRecordLegend
    visible={slotVisible(visible)}
    labels={FORECAST_LABELS}
    onToggle={slot => onToggle(slot === 'usage' ? 'forecast' : 'actual')}
  />;
}

// ---------------------------------------------------------------------------
// Category Demand
// ---------------------------------------------------------------------------

// WHY ONE CARD PER UNIT: ingredient units are free text on the real records, and kg, L
// and pcs are different physical quantities. Summing them, or ranking them against each
// other on one axis, would produce a number that means nothing - the same reason the
// shared "most used" ranking refuses to compare across units. Each unit therefore gets
// its own labelled block and its own zero baseline, and the two demand kinds are drawn as
// one row per category per kind so historical and predicted values are never added
// together or mistaken for each other.
export function CategoryDemandBreakdown({
  ariaLabel,
  items,
  kinds = ['historical', 'forecast'],
}: {
  ariaLabel: string;
  items: readonly CategoryDemandItem[];
  kinds?: readonly DemandKind[];
}) {
  const units = [...new Set(items.filter(item => kinds.includes(item.kind)).map(item => item.unit))].sort((a, b) => a.localeCompare(b));
  const categories = [...new Set(items.map(item => item.category))];
  const valueOf = (category: string, unit: string, kind: DemandKind) =>
    items.find(item => item.category === category && item.unit === unit && item.kind === kind)?.value;

  // Bars are ranked highest to lowest within their own unit, using the larger of the two
  // demand kinds for that category, and the ranking is stated in words for screen readers.
  const ranked = (unit: string) => categories
    .map(category => ({ category, historical: valueOf(category, unit, 'historical'), forecast: valueOf(category, unit, 'forecast') }))
    .filter(row => row.historical !== undefined || row.forecast !== undefined)
    .map(row => ({ ...row, sort: Math.max(row.historical ?? 0, row.forecast ?? 0) }))
    .sort((a, b) => b.sort - a.sort || a.category.localeCompare(b.category));

  return <div className="sl-mgr-fc-demand" role="group" aria-label={ariaLabel}>
    <p className="sl-mgr-fc-demand-note">Each unit is charted on its own scale. Quantities in different units are never added together or ranked against each other.</p>
    <div className="sl-mgr-fc-demand-legend" aria-hidden="true">
      <span><i data-kind="historical" />Historical demand</span>
      <span><i data-kind="forecast" />Forecast demand</span>
    </div>
    {units.map(unit => {
      const rows = ranked(unit);
      const max = rows.reduce((largest, row) => Math.max(largest, row.historical ?? 0, row.forecast ?? 0), 0);
      return <section className="sl-mgr-fc-demand-unit" key={unit} aria-label={`${unit} demand`}>
        <h4 className="sl-mgr-fc-demand-unit-title">Measured in {unit}</h4>
        <ul className="sl-mgr-fc-demand-list">
          {rows.map((row, index) => <li className="sl-mgr-fc-demand-row" key={row.category}>
            <span className="sl-mgr-fc-demand-label"><span className="sl-mgr-fc-demand-rank" aria-label={`Rank ${index + 1}`}>{index + 1}</span>{row.category}</span>
            <span className="sl-mgr-fc-demand-bars">
              {(['historical', 'forecast'] as const).map(kind => row[kind] === undefined ? null : <span className="sl-mgr-fc-demand-bar" data-kind={kind} key={kind}>
                <i style={{ width: max > 0 ? `${((row[kind] as number) / max) * 100}%` : '0%' }} />
              </span>)}
            </span>
            <strong className="sl-mgr-fc-demand-values">
              <span data-kind="historical">{row.historical === undefined ? '—' : formatQuantity(row.historical)}</span>
              <span data-kind="forecast">{row.forecast === undefined ? '—' : formatQuantity(row.forecast)}</span>
            </strong>
          </li>)}
        </ul>
        <p className="sl-mgr-fc-demand-caption">Ranked highest to lowest within {unit}. Values are {unit}.</p>
      </section>;
    })}
  </div>;
}

// A single-unit ranking renders through the Waste by Reason bars themselves, so an
// already-compatible set of rows uses the established idiom instead of a look-alike.
export function CategoryDemandRanked({ ariaLabel, caption, rows }: {
  ariaLabel: string;
  caption: string;
  rows: readonly { label: string; value: number; tone?: string; percentage?: string }[];
}) {
  const max = rows.reduce((largest, row) => Math.max(largest, row.value), 0);
  return <ApplicationBarBreakdown
    ariaLabel={ariaLabel}
    caption={caption}
    ranked
    showPercentages
    items={rows.map(row => ({ label: row.label, value: row.value, tone: row.tone, percentage: row.percentage ?? (max > 0 ? `${Math.round(row.value / max * 100)}%` : '—') }))}
  />;
}

// The shared bar primitive stays mounted with no items. The locked reason card's
// summary tiles and compact explanation make the empty bar region recognizable;
// unavailable demand must not be displayed as zero or given a fictional category.
export function CategoryDemandEmpty({ description }: { description: string }) {
  return <div className="sl-mgr-fc-demand-empty">
    <div className="sl-manager-reason-tiles" aria-label="Demand summary unavailable">
      <article className="sl-manager-reason-tile" data-tile="records"><span>Historical Demand</span><strong>—</strong></article>
      <article className="sl-manager-reason-tile" data-tile="cause"><span>Forecast Demand</span><strong>—</strong></article>
    </div>
    <ApplicationBarBreakdown ariaLabel="Category demand chart, no data plotted yet" items={[]} />
    <div className="sl-manager-reason-empty" role="status">
      <p><strong>No live records yet.</strong></p>
      <p>{description}</p>
    </div>
    <p className="sl-mgr-fc-demand-unit-note">Demand categories appear here when compatible-unit records are available.</p>
  </div>;
}

// ---------------------------------------------------------------------------
// Forecast Insights
// ---------------------------------------------------------------------------

// Each card states WHAT was noticed, WHY, and the EVIDENCE in words. No card carries a
// risk score, a confidence figure or a severity number, because no risk formula has been
// approved. Potential waste appears only where the caller supplies both a quantity and a
// cost; otherwise the line is omitted rather than dashed, so a missing figure can never
// be read as a measured zero.
export function ForecastInsightCards({
  ariaLabel,
  insights,
  ingredientName,
}: {
  ariaLabel: string;
  insights: readonly ForecastInsight[];
  ingredientName?: string;
}) {
  const ranked = rankInsights(insights);
  const activeIngredient = ingredientName || ranked[0]?.ingredient;
  return <div className="sl-mgr-fc-insights" role="group" aria-label={ariaLabel}>
    {activeIngredient && (
      <div className="sl-mgr-fc-insight-scope">
        <span className="sl-mgr-fc-insight-scope-pill">{activeIngredient}</span>
      </div>
    )}
    <ol className="sl-mgr-fc-insight-list">
      {ranked.map((insight, index) => {
        const hasSpecificBatch = insight.batchId && insight.batchId !== 'All Batches' && insight.batchId !== '—';
        const batchBadgeText = [
          hasSpecificBatch ? `Batch ${insight.batchId.replace(/^Batch #/, '#')}` : (insight.batchId === 'All Batches' ? 'All Batches' : ''),
          insight.expiresOn ? `Exp ${dateLabel(insight.expiresOn)}` : '',
        ].filter(Boolean).join(' · ');
        const hasWaste = insight.potentialWasteQuantity !== undefined && insight.potentialWasteCost !== undefined;
        const wasteEst = hasWaste && Number.isFinite(insight.potentialWasteCost) ? formatCompactPeso(insight.potentialWasteCost as number) : null;
        return <li className="sl-mgr-fc-insight" data-tone={insight.tone} key={insight.id}>
          <header className="sl-mgr-fc-insight-head">
            <span className="sl-mgr-fc-insight-rank" aria-hidden="true">{index + 1}</span>
            <div className="sl-mgr-fc-insight-head-info">
              <strong className="sl-mgr-fc-insight-reason">{insight.reason}</strong>
              {batchBadgeText && <span className="sl-mgr-fc-insight-batch">{batchBadgeText}</span>}
            </div>
          </header>
          {(insight.evidence && insight.evidence !== insight.reason) && (
            <p className="sl-mgr-fc-insight-evidence">
              {insight.evidence}
              {wasteEst && <span className="sl-mgr-fc-insight-waste-inline" title={Number.isFinite(insight.potentialWasteCost) ? formatExactPeso(insight.potentialWasteCost as number) : undefined}> · Est. waste <strong>{wasteEst}</strong></span>}
            </p>
          )}
          <p className="sl-mgr-fc-insight-action"><strong>Action:</strong> {insight.action.replace(/^Suggested next step:\s*/i, '')}</p>
        </li>;
      })}
    </ol>
    <p className="sl-mgr-fc-insight-note">AI-assisted advisories — Suggestions only. Nothing here changes stock; operational decisions stay with the Manager.</p>
  </div>;
}

export function ForecastInsightsEmpty() {
  return <div className="sl-mgr-fc-insights sl-mgr-fc-insights-empty" role="status" aria-label="Forecast insights pending validated data">
    <ol className="sl-mgr-fc-insight-list" aria-hidden="true">
      {[0, 1, 2].map(index => <li className="sl-mgr-fc-insight sl-mgr-fc-insight-placeholder" key={index}><i /><i /><i /></li>)}
    </ol>
  </div>;
}
