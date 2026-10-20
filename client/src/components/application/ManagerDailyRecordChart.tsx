import { useEffect, useRef, useState } from 'react';
import { axisLabelIndices } from './forecast-chart-data';

export type DailyCount = { date: string; count: number };
// A slot is a measured count, or `null` for a day with no measurement at all. The
// distinction is load-bearing on the Manager Forecasting panel, where a day the model did
// not predict is not the same fact as a day predicted to be zero. Usage & Waste only ever
// passes numbers, so its rendering is unchanged.
export type DailyValue = number | null;
// A point is one business day plus one slot per drawn series. The two named slots keep the
// exact meaning they have always had for Usage & Waste and Forecasting; a panel that needs
// more lines - Manager Alerts draws High, Medium and Low - adds further slots by key and
// lists them in `labels`, so ONE chart serves every panel instead of a second look-alike.
export type DailyPoint = { date: string; usage: DailyValue; waste: DailyValue } & Record<string, string | DailyValue>;

export function dailyRecordPoints(from: string | null, to: string | null, usage: readonly DailyCount[], waste: readonly DailyCount[]): DailyPoint[] {
  const observed = [...usage, ...waste].map(item => item.date).sort();
  const first = from ?? observed[0];
  const last = to ?? observed.at(-1);
  if (!first || !last || first > last) return [];
  const usageByDate = new Map(usage.map(item => [item.date, item.count]));
  const wasteByDate = new Map(waste.map(item => [item.date, item.count]));
  const points: DailyPoint[] = [];
  for (let day = Date.parse(`${first}T00:00:00Z`), end = Date.parse(`${last}T00:00:00Z`); day <= end; day += 86_400_000) {
    const date = new Date(day).toISOString().slice(0, 10);
    points.push({ date, usage: usageByDate.get(date) ?? 0, waste: wasteByDate.get(date) ?? 0 });
  }
  return points;
}

const dateLabel = (date: string) => new Intl.DateTimeFormat('en-PH', { month: 'short', day: 'numeric', timeZone: 'UTC' }).format(new Date(`${date}T00:00:00Z`));
const longWeekday = new Intl.DateTimeFormat('en-PH', { weekday: 'long', timeZone: 'UTC' });
const shortWeekday = new Intl.DateTimeFormat('en-PH', { weekday: 'short', timeZone: 'UTC' });
// The date is a business calendar day, so it is read back in UTC: shifting it to a
// local zone would print the wrong weekday for the same stored value.
const weekdayLabel = (date: string, short: boolean) => (short ? shortWeekday : longWeekday).format(new Date(`${date}T00:00:00Z`));

// Record counts are whole numbers, so the axis must never show a fraction. The step
// comes from the standard 1-2-5 family so every gridline lands on a value a person
// reads at a glance. A small peak keeps a step of 1 (0, 1, 2, 3 ...), and the
// ceiling is the tightest multiple of that step at or above the busiest day, so the
// domain follows the real data instead of a fixed template.
export function dailyAxisScale(peak: number, intervals = 4) {
  const safePeak = Math.max(0, Math.ceil(peak));
  if (safePeak <= intervals) return { step: 1, ceiling: safePeak, ticks: Array.from({ length: safePeak + 1 }, (_, index) => index) };
  const magnitude = 10 ** Math.floor(Math.log10(safePeak / intervals));
  const step = [1, 2, 5, 10].map(multiplier => multiplier * magnitude).find(candidate => Math.ceil(safePeak / candidate) <= intervals) ?? Math.ceil(safePeak / intervals);
  const ceiling = Math.ceil(safePeak / step) * step;
  return { step, ceiling, ticks: Array.from({ length: Math.round(ceiling / step) + 1 }, (_, index) => index * step) };
}

export type DailySeries = 'usage' | 'waste';

// The two slots are named for their first user, the Usage & Waste trend. They are
// presentation slots, not a claim about the data: `labels`, `formatValue` and
// `valueSuffix` let a second panel draw a different pair of series - the Manager
// Forecasting page draws Forecast and Actual through this exact component - so the
// application keeps ONE trend chart rather than a second one that only resembles it.
// Every default reproduces the Usage & Waste panel word for word, so that page's
// rendered output is unchanged by this parameterisation.
export const DAILY_SERIES_LABELS: Record<DailySeries, string> = { usage: 'Usage', waste: 'Waste' };

export function ManagerDailyRecordChart({ ariaLabel, points, visible, emptyLabel, emptyDescription, emptyActions, svgLabel = 'Daily usage and waste record counts. Focus or select a point for its exact value.', labels = DAILY_SERIES_LABELS, formatValue = (value: number) => String(value), valueSuffix = ' records', showEmptyZeroTick = true, dateAxis = 'reference' }: { ariaLabel: string; points: readonly DailyPoint[]; visible: Record<string, boolean>; emptyLabel?: string; emptyDescription?: string; emptyActions?: React.ReactNode; svgLabel?: string; labels?: Record<string, string>; formatValue?: (value: number) => string; valueSuffix?: string; showEmptyZeroTick?: boolean; dateAxis?: 'reference' | 'rolling' | 'calendar-week' }) {
  const frame = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(680);
  // The rendered box height is tracked as well as the width, so the viewBox can be told
  // the exact size it is drawn into. An SVG scales its whole coordinate system to fit
  // while keeping the aspect ratio, so a viewBox shorter than its box is letterboxed:
  // the plot then silently shrinks to a fraction of the space the card gave it. Matching
  // the two means one unit is one pixel in both directions, with no distortion and no
  // dead band above and below the chart.
  const [height, setHeight] = useState(296);
  const [active, setActive] = useState<{ index: number; series: string } | null>(null);
  // The drawn series come from the labels the caller supplied, in order: Usage & Waste and
  // Forecasting pass two, Manager Alerts passes three. Deriving the list here keeps one chart
  // for every panel. Order is preserved, never sorted, because the FIRST key also supplies the
  // area fill and the left-most legend entry - exactly as before for the two-series panels.
  const seriesKeys = Object.keys(labels);
  const primary = seriesKeys[0];
  useEffect(() => {
    if (!frame.current) return;
    const observer = new ResizeObserver(entries => {
      const rect = entries[0]?.contentRect;
      if (!rect) return;
      setWidth(Math.max(260, Math.round(rect.width || 680)));
      setHeight(Math.max(160, Math.round(rect.height || 296)));
    });
    observer.observe(frame.current);
    return () => observer.disconnect();
  }, []);
  // The grid and its dates sit inside the beige surface, with room for the axis labels.
  // The approved reference places the first gridline about 52px from the surface's left
  // edge and the last about 27px from its right edge. The surface itself starts 8px
  // inside the frame, so these plot bounds are measured from the same SVG origin.
  // Vertical positions remain fractions of the measured frame to preserve scaling.
  const panelTop = 6; const panelHeight = Math.max(1, height - 12);
  const left = 60; const right = 35;
  const top = panelTop + panelHeight * 0.12;
  const bottom = Math.max(top + 40, panelTop + panelHeight * 0.86);
  const weekdayY = panelTop + panelHeight * 0.94;
  const plotWidth = Math.max(1, width - left - right);
  // The scale comes from the whole dataset for the selected period, never from the
  // series currently drawn. Hiding a line must not move the gridlines: if the ceiling
  // shrank with the hidden series, the remaining line would jump upwards and read as a
  // rise in activity that never happened. Only a new period may change the axes.
  // Unmeasured days are excluded from the scale entirely: reading a `null` as 0 would
  // collapse the ceiling to a value nobody measured.
  const measuredValues = points.flatMap(point => seriesKeys.map(key => point[key])).filter((value): value is number => typeof value === 'number' && Number.isFinite(value));
  const peak = Math.max(0, ...measuredValues);
  // A period with no records at all still keeps its plot, axes and date labels: the
  // Manager reads which days the window covers and sees that nothing happened, instead
  // of a blank panel that could equally mean a failed load. Only the markers are
  // dropped, because a flat line lying on the zero gridline is indistinguishable from
  // the axis itself.
  const allZero = measuredValues.length === 0 || measuredValues.every(value => value === 0);
  const scale = dailyAxisScale(peak);
  // Both series share this one ceiling, so the gap between the lines is a real
  // difference and an empty period cannot divide the domain by zero. An empty period
  // takes the reference's short ladder instead, so the panel still reads as a chart
  // surface; those extra lines carry no numbers at all, so a week that recorded nothing
  // never claims a value it did not measure.
  const ceiling = allZero ? 3 : Math.max(1, scale.ceiling);
  const gridValues = allZero ? [0, 1, 2, 3] : scale.ticks;
  const x = (index: number) => left + (points.length === 1 ? plotWidth / 2 : index * plotWidth / (points.length - 1));
  const y = (count: number) => bottom - count / ceiling * (bottom - top);
  // One contiguous run of measured days becomes one subpath. A `null` day ends the run,
  // so the line BREAKS there instead of being bridged: drawing straight through an
  // unmeasured day would invent a value between its neighbours. With no gaps the whole
  // series is a single run, so the path is exactly what the reference always drew.
  const segments = (series: string) => {
    const runs: number[][] = [];
    let run: number[] = [];
    points.forEach((point, index) => {
      if (typeof point[series] !== 'number' || !Number.isFinite(point[series] as number)) { if (run.length) runs.push(run); run = []; return; }
      run.push(index);
    });
    if (run.length) runs.push(run);
    return runs;
  };
  const path = (series: string) => segments(series)
    .map(run => run.map((index, position) => `${position ? 'L' : 'M'} ${x(index)} ${y(points[index][series] as number)}`).join(' '))
    .join(' ');
  const measuredAt = (index: number, series: string) => typeof points[index][series] === 'number' && Number.isFinite(points[index][series] as number);
  const measuredRuns = (series: string) => segments(series);
  // The filled area is only drawn when the first series is one unbroken run. With a gap
  // the outline would have to close across days nobody measured, and the shaded band
  // would then claim a volume in exactly the region the line deliberately refuses to draw.
  const usageArea = points.length && visible[primary] && measuredRuns(primary).length <= 1 ? `${path(primary)} L ${x(points.length - 1)} ${bottom} L ${x(0)} ${bottom} Z` : '';
  // A week is short enough to name every day, and the approved reference names them in
  // their three-letter form: "Mon", not "Monday". A long name centred on the plot's edge
  // tick would hang outside the inset panel, so the short form is what keeps the whole
  // weekday row inside the chart surface.
  const useWeekdayLabels = dateAxis === 'calendar-week' || (dateAxis === 'reference' && points.length <= 7);
  const axisLabel = (date: string) => useWeekdayLabels ? weekdayLabel(date, true) : dateLabel(date);
  const labelEvery = points.length <= 7 ? 1 : Math.max(1, Math.ceil(points.length / 7));
  // Rolling windows distribute labels across the full date span, including the final day.
  // This avoids the reference's overlap-avoidance rule dropping a near-end label and
  // making a regular sequence appear to jump nine days at the right edge.
  const rollingIndices = () => {
    if (points.length <= 7) return points.map((_, index) => index);
    const count = Math.min(7, Math.max(3, Math.floor(plotWidth / 72) + 1));
    return Array.from(new Set(Array.from({ length: count }, (_, index) => Math.round(index * (points.length - 1) / (count - 1)))));
  };
  const activePoint = active ? points[active.index] : null;
  // The tooltip names the day and then one line per series, so one reading answers the whole
  // question instead of only the line the pointer happened to land on. The height grows with
  // the series count so a three-line Alerts tooltip is never clipped; two series keep the
  // reference's original 52px box exactly, because 24 + 2 x 14 is 52. It is kept inside the
  // plot: above the point when there is room, otherwise just below it.
  const tooltipWidth = 150; const tooltipHeight = 24 + seriesKeys.length * 14;
  const tooltipX = active ? Math.min(Math.max(x(active.index) - tooltipWidth / 2, left), width - right - tooltipWidth) : 0;
  const anchorY = activePoint && active ? y(activePoint[active.series] as number) : 0;
  const tooltipY = activePoint && active ? (anchorY - tooltipHeight - 10 >= top ? anchorY - tooltipHeight - 10 : Math.min(anchorY + 12, bottom - tooltipHeight)) : 0;
  const activate = (index: number, series: string) => { if (visible[series] && measuredAt(index, series)) setActive({ index, series }); };
  // The invisible target that takes the pointer must not reach past its own day. A fixed
  // 12px radius is generous on a week, where days sit over a hundred pixels apart, but a
  // month packs the days to about 22px, so two neighbours' targets then overlap and the
  // pointer can land on the day beside the one aimed at. The radius is therefore capped
  // at half the day pitch: it stays 12px whenever the days are roomy, and only narrows
  // when they crowd. Nothing about the visible dot or the data changes - this is purely
  // how much of the plot each day is allowed to claim for the pointer.
  const dayPitch = points.length > 1 ? plotWidth / (points.length - 1) : plotWidth;
  const hitRadius = Math.max(5, Math.min(12, dayPitch / 2 - 0.5));

  return <div className="sl-manager-daily-chart" role="group" aria-label={ariaLabel}>
    <div ref={frame} className="sl-manager-daily-frame">
      <svg viewBox={`0 0 ${width} ${height}`} role="img" aria-label={svgLabel}>
        {/* The approved reference sets the whole plotting area - gridlines, weekday row
            and all - on one faint rounded inset panel, so the surface reads as a single
            chart rather than as page rules with loose labels underneath. It is paint
            only: every gridline, label and marker is still drawn above it, so the panel
            can never imply a value that was not measured. */}
        <rect className="sl-manager-daily-plot" x="8" y={panelTop} width={Math.max(1, width - 16)} height={panelHeight} rx="14" />
        {gridValues.map(value => <g key={value}><line className="sl-manager-daily-grid" data-zero={value === 0 ? 'true' : undefined} x1={left} y1={y(value)} x2={width - right} y2={y(value)} />
          {/* UsageWaste names its recorded-zero baseline; Forecasting suppresses that
              label until a measurement exists. The other empty gridlines never claim values. */}
          {(!allZero || (showEmptyZeroTick && value === 0)) && <text className="sl-manager-daily-axis" x={left - 7} y={y(value) + 4} textAnchor="end">{value}</text>}</g>)}
        {!allZero && activePoint && active && <line className="sl-manager-daily-guide" x1={x(active.index)} y1={top} x2={x(active.index)} y2={bottom} />}
        {!allZero && visible[primary] && <path className="sl-manager-daily-area" d={usageArea} />}
        {!allZero && seriesKeys.filter(key => visible[key]).map(key => <path key={key} className="sl-manager-daily-line" data-series={key} d={path(key)} />)}
        {!allZero && points.map((point, index) => <g key={point.date}>
          {seriesKeys.filter(series => visible[series] && measuredAt(index, series)).map(series => <g key={series}>
            {/* The marker a person aims at is larger than the dot it draws: a 4px circle
                is a needle to hit, so the pointer left and re-entered it on tiny
                movements and the tooltip flickered. The transparent 12px circle takes
                every pointer and keyboard event; the visible dot below it is only
                paint and is kept out of hit-testing. A day with no measurement gets no
                marker at all: a dot on the baseline would read as a measured zero. */}
            <circle
              className="sl-manager-daily-point"
              data-series={series}
              cx={x(index)}
              cy={y(point[series] as number)}
              r={hitRadius}
              role="button"
              tabIndex={0}
              aria-label={`${dateLabel(point.date)}: ${labels[series]} ${formatValue(point[series] as number)}${valueSuffix}`}
              onMouseEnter={() => activate(index, series)}
              onMouseLeave={() => setActive(current => current?.index === index && current.series === series ? null : current)}
              onFocus={() => activate(index, series)}
              onBlur={() => setActive(null)}
              onClick={() => activate(index, series)}
              onKeyDown={event => {
                if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); activate(index, series); }
              }}
            />
            <circle className="sl-manager-daily-dot" data-series={series} cx={x(index)} cy={y(point[series] as number)} r="4" aria-hidden="true" />
          </g>)}
        </g>)}
        {/* The date labels are drawn for every period, empty or not: the window the
            Manager selected must be readable even when it contains no records. */}
        {(dateAxis === 'rolling' ? rollingIndices() : axisLabelIndices(points.length, labelEvery)).map(index =>
          <text key={points[index].date} className="sl-manager-daily-axis" x={x(index)} y={weekdayY} textAnchor="middle">{axisLabel(points[index].date)}</text>)}
        {!allZero && activePoint && active && seriesKeys.filter(series => visible[series] && measuredAt(active.index, series)).map(series => <circle
          key={series}
          className="sl-manager-daily-guide-dot"
          data-series={series}
          cx={x(active.index)}
          cy={y(activePoint[series] as number)}
          r="4.5"
        />)}
        {!allZero && activePoint && active && <g className="sl-manager-daily-tooltip" aria-hidden="true" transform={`translate(${tooltipX} ${tooltipY})`}>
          <rect width={tooltipWidth} height={tooltipHeight} rx="6" />
          <text className="sl-manager-daily-tooltip-date" x="10" y="16">{dateLabel(activePoint.date)}</text>
          {seriesKeys.map((key, position) => <text key={key} className="sl-manager-daily-tooltip-value" data-series={key} x="10" y={33 + position * 14}>{labels[key]} {measuredAt(active.index, key) ? formatValue(activePoint[key] as number) : '—'}</text>)}
        </g>}
      </svg>
      {/* The reference centres a rounded panel inside the plotting area when the period
          holds no records, leaving the axes in place around it. The panel carries the
          truthful title and the sentence that explains what will appear here, so an
          empty week never reads as a chart that failed to load. */}
      {allZero && emptyLabel && <div className="sl-manager-daily-empty" role="status">
        <p className="sl-manager-daily-empty-title">{emptyLabel}</p>
        {emptyDescription && <p className="sl-manager-daily-empty-text">{emptyDescription}</p>}
        {emptyActions && <div className="sl-manager-daily-empty-actions">{emptyActions}</div>}
      </div>}
    </div>
    <span className="sl-sr-only" aria-live="polite">{activePoint && active ? `${dateLabel(activePoint.date)}: ${labels[active.series]} ${formatValue(activePoint[active.series] as number)}${valueSuffix}` : ''}</span>
  </div>;
}

const SERIES_LABEL: Record<DailySeries, string> = DAILY_SERIES_LABELS;

// The legend is header furniture: it sits beside the card title, inside the same row
// as the period control, as the approved reference shows. Its entries are real
// buttons, so a series can be hidden with the keyboard as well as the pointer.
// `aria-pressed` reports the state, and the last visible series refuses to switch
// off: a chart with no line and no scale would be a blank panel, not a comparison.
// Generic over its keys so a caller keeps the narrow type it always had: Usage & Waste and
// Forecasting pass DailySeries, Manager Alerts passes its own priority keys. Nothing about
// the markup, the pressed state or the "last series cannot switch off" rule changes.
export function ManagerDailyRecordLegend<K extends string = DailySeries>({ visible, onToggle, labels = SERIES_LABEL as Record<K, string> }: { visible: Record<K, boolean>; onToggle: (series: K) => void; labels?: Record<K, string> }) {
  const seriesKeys = Object.keys(labels) as K[];
  const shown = seriesKeys.filter(series => visible[series]).length;
  return <div className="sl-manager-analytics-legend" role="group" aria-label="Chart series">
    {seriesKeys.map(series => <button
      key={series}
      type="button"
      className="sl-manager-analytics-legend-item"
      data-series={series}
      aria-pressed={visible[series]}
      aria-label={`${labels[series]} series`}
      title={shown === 1 && visible[series] ? 'At least one series must stay visible' : `Show or hide the ${labels[series]} series`}
      onClick={() => { if (shown > 1 || !visible[series]) onToggle(series); }}
    ><i data-series={series} />{labels[series]}</button>)}
  </div>;
}
