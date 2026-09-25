import type { ReactNode } from 'react';
import { DataState, Status } from './primitives';

export const APPLICATION_RECORD_PAGE_SIZES = [10, 15, 50, 100, 150] as const;

export function ApplicationLineChart({
  ariaLabel,
  unavailableMessage,
  xAxisTitle,
  yAxisTitle,
}: {
  ariaLabel: string;
  unavailableMessage?: string;
  xAxisTitle: string;
  yAxisTitle: string;
}) {
  return <div className="sl-sa-chart-surface sl-sa-line-chart-surface" role="img" aria-label={ariaLabel}>
    <span className="sl-sa-chart-y-title">{yAxisTitle}</span>
    <div className="sl-sa-chart-y-axis" aria-hidden="true"><span>—</span><span>—</span><span>—</span><span>—</span></div>
    <div className="sl-sa-line-chart-plot" aria-hidden="true"><svg viewBox="0 0 100 60" preserveAspectRatio="none"><path d="M0 48 L100 48" /></svg></div>
    <div className="sl-sa-chart-x-axis" aria-hidden="true"><span>—</span><span>—</span><span>—</span><span>—</span><span>—</span><span>—</span></div>
    <span className="sl-sa-chart-x-title">{xAxisTitle}</span>
    <span className="sl-sa-chart-empty-note">{unavailableMessage}</span>
  </div>;
}

export function ApplicationDonutChart({
  ariaLabel,
  centerLabel,
  centerValue,
  items,
  unavailableMessage,
}: {
  ariaLabel: string;
  centerLabel: string;
  centerValue?: number | string;
  items: readonly (string | { label: string; value?: number })[];
  unavailableMessage?: string;
}) {
  const series = items.map(item => typeof item === 'string' ? { label: item, value: undefined } : item);
  const hasValues = series.some(item => item.value !== undefined);
  const total = series.reduce((sum, item) => sum + (item.value ?? 0), 0);
  const colors = ['#0b8755', '#79c9a3', '#ffd166', '#67a98f', '#07543f'];
  const segments = total > 0
    ? series.reduce<{ stops: string[]; offset: number }>((result, item, index) => {
        const nextOffset = result.offset + ((item.value ?? 0) / total) * 100;
        result.stops.push(`${colors[index % colors.length]} ${result.offset}% ${nextOffset}%`);
        result.offset = nextOffset;
        return result;
      }, { stops: [], offset: 0 }).stops.join(', ')
    : '';

  return <div className="sl-application-donut-chart" role="img" aria-label={ariaLabel}>
    <div className="sl-application-donut-visual">
      <div className="sl-application-donut" aria-hidden="true" style={segments ? { background: `radial-gradient(circle at center,#fff 0 48%,transparent 49%),conic-gradient(${segments})` } : undefined}><strong>{centerValue ?? (hasValues ? total.toLocaleString() : '—')}</strong><span>{centerLabel}</span></div>
      <div className="sl-application-donut-legend" aria-label={`${centerLabel} legend`}>
        {series.map((item, index) => <div className="sl-application-donut-legend-row" key={item.label}><i data-series={index + 1} style={{ backgroundColor: colors[index % colors.length] }} /><span>{item.label}</span><strong>{item.value === undefined ? '—' : item.value.toLocaleString()}</strong></div>)}
      </div>
    </div>
    {unavailableMessage && <span className="sl-application-donut-note">{unavailableMessage}</span>}
  </div>;
}

export function ApplicationPendingState({
  description,
  className = '',
  action = <Status>Preview · data pending</Status>,
}: {
  description: string;
  className?: string;
  action?: ReactNode;
}) {
  return <div className={`sl-application-pending-state${className ? ` ${className}` : ''}`}>
    <DataState kind="empty" title="No live records yet" description={description} action={action} />
  </div>;
}
