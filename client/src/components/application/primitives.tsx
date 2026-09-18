import { CircleDashed, Inbox, LoaderCircle, LockKeyhole, TriangleAlert } from 'lucide-react';
import type { ReactNode } from 'react';

export function PageHeader({ eyebrow, title, description }: { eyebrow?: string; title: string; description?: string }) {
  return <header className="sl-page-header">{eyebrow && <p className="sl-eyebrow">{eyebrow}</p>}
    <h1 className="sl-page-title">{title}</h1>{description && <p className="sl-description">{description}</p>}</header>;
}

// Role dashboards share geometry, not permissions or data.
export function DashboardGrid({ children }: { children: ReactNode }) {
  return <div className="sl-dashboard-grid">{children}</div>;
}

export function Status({
  children,
  tone = 'neutral',
}: {
  children: ReactNode;
  tone?: 'neutral' | 'success' | 'attention' | 'critical' | 'brand';
}) {
  // Text carries status meaning; dot and color reinforce accessibility.
  return (
    <span className="sl-status" data-tone={tone}>
      <span className="sl-status-dot" aria-hidden="true" />
      {children}
    </span>
  );
}

export function SummaryItems({ items }: { items: { label: string; value?: string }[] }) {
  return <dl className="sl-summary-items">{items.map(item => <div key={item.label}>
    <dt className="sl-supporting">{item.label}</dt>
    <dd className="sl-card-title">{item.value ?? 'Unavailable'}</dd>
  </div>)}</dl>;
}

export function SummaryCards({ items }: { items: { label: string; value?: ReactNode; detail?: string; tone?: 'neutral' | 'success' | 'attention' | 'critical' | 'brand'; trend?: 'line' | 'bars' | 'segments' | 'accuracy' }[] }) {
  // Unknown metrics are labeled explicitly, never represented as measured zeroes.
  return <dl className="sl-overview-cards">{items.map(({ label, value, detail, tone = 'neutral', trend = 'line' }) => <div key={label} className="sl-overview-card" data-tone={tone}>
    <dt className="sl-supporting">{label}</dt>
    <dd className="sl-summary-value">{value ?? 'Unavailable'}</dd>
    <div className={`sl-kpi-trend sl-kpi-trend-${trend}`} aria-hidden="true">{trend === 'bars' ? <>{[1,2,3,4,5,6,7].map(i => <i key={i} />)}</> : trend === 'segments' ? <>{[1,2,3,4].map(i => <i key={i} />)}</> : <svg viewBox="0 0 120 28" preserveAspectRatio="none"><path d={trend === 'accuracy' ? 'M2 22 C22 19, 32 9, 49 13 S76 5, 118 7' : 'M2 22 C22 24, 31 11, 51 14 S78 12, 118 4'} /></svg>}</div>
    {detail && <span className="sl-overview-detail">{detail}</span>}
  </div>)}</dl>;
}

export function PlaceholderSummaryCards({ items }: { items: { label: string; tone?: 'neutral' | 'success' | 'attention' | 'critical' | 'brand' }[] }) {
  // TODO: Replace these checkpoint previews with API-driven values when each
  // corresponding backend service is implemented.
  return <SummaryCards items={items.map(({ label, tone = 'neutral' }) => ({
    label,
    value: <><span className="sl-placeholder-value" aria-hidden="true">—</span><span className="sl-sr-only">Data unavailable</span></>,
    detail: 'Preview · awaiting live data',
    tone,
  }))} />;
}

export function PlaceholderTable({ label, columns, description, rows = 4 }: { label: string; columns: string[]; description: string; rows?: number }) {
  // TODO: Connect this section to its backend service and replace these
  // presentation-only rows with real API-driven records.
  return <div className="sl-table-scroll" role="region" aria-label={`${label} preview`} tabIndex={0}>
    <table className="sl-data-table sl-placeholder-table">
      <thead><tr>{columns.map(column => <th scope="col" key={column}>{column}</th>)}</tr></thead>
      <tbody>
        <tr className="sl-placeholder-state-row"><td colSpan={columns.length} className="sl-empty-cell">
          <DataState kind="empty" title="No live records yet" description={description} action={<Status>Preview · data pending</Status>} />
        </td></tr>

      </tbody>
    </table>
  </div>;
}

export function UnavailableTable({ label, columns, description, stateTitle = 'Records unavailable', stateDescription = 'This information is not connected yet. No records or totals can be confirmed.' }: { label: string; columns: string[]; description: string; stateTitle?: string; stateDescription?: string }) {
  // Supported columns remain visible; a missing service never implies zero records.
  return <div className="sl-table-scroll" role="region" aria-label={label} tabIndex={0}>
    <table className="sl-data-table"><caption className="sl-supporting">{description}</caption>
      <thead><tr>{columns.map(column => <th scope="col" key={column}>{column}</th>)}</tr></thead>
      <tbody><tr><td colSpan={columns.length}><DataState title={stateTitle} description={stateDescription} /></td></tr></tbody>
    </table>
  </div>;
}

export function Card({ title, children, id, action }: { title: string; children: ReactNode; id: string; action?: ReactNode }) {
  return (
    <section className="sl-card" aria-labelledby={id}>
      <div className="sl-card-header">
        <h2 className="sl-section-title" id={id}>{title}</h2>
        {action}
      </div>
      <div className="sl-card-body">{children}</div>
    </section>
  );
}

export function DataState({
  kind = 'unavailable',
  title,
  description,
  action,
}: {
  kind?: 'unavailable' | 'empty' | 'error' | 'permission' | 'loading';
  title: string;
  description: string;
  action?: ReactNode;
}) {
  const Icon =
    kind === 'error'
      ? TriangleAlert
      : kind === 'permission'
      ? LockKeyhole
      : kind === 'empty'
      ? Inbox
      : kind === 'loading'
      ? LoaderCircle
      : CircleDashed;

  // Announce errors urgently; other state changes use a polite live region.
  return (
    <div
      className="sl-state"
      data-kind={kind}
      role={kind === 'error' ? 'alert' : 'status'}
      aria-busy={kind === 'loading'}
    >
      <Icon className={kind === 'loading' ? 'sl-state-icon sl-spin' : 'sl-state-icon'} size={20} aria-hidden="true" />
      <div>
        <p className="sl-card-title">{title}</p>
        <p className="sl-supporting">{description}</p>
        {action && <div className="sl-state-actions">{action}</div>}
      </div>
    </div>
  );
}

export function Pagination({ page, pageSize, total, itemLabel, onPageChange, compact = false }: {
  page: number;
  pageSize: number;
  total: number;
  itemLabel: string;
  onPageChange: (page: number) => void;
  compact?: boolean;
}) {
  const totalPages = Math.ceil(total / pageSize);
  const safePage = totalPages > 0 ? Math.min(Math.max(page, 1), totalPages) : 1;
  const pages = totalPages <= 5
    ? Array.from({ length: totalPages }, (_, index) => index + 1)
    : [...new Set([1, safePage - 1, safePage, safePage + 1, totalPages].filter(value => value >= 1 && value <= totalPages))].sort((a, b) => a - b);
  const firstShown = total > 0 ? ((safePage - 1) * pageSize) + 1 : 0;
  const lastShown = total > 0 ? Math.min(safePage * pageSize, total) : 0;

  return <nav className={`sl-table-toolbar sl-pagination${compact ? ' sl-pagination-compact' : ''}`} aria-label={`${itemLabel} pagination`}>
    {compact
      ? <span className="sl-supporting sl-pagination-summary">Showing {firstShown} to {lastShown} of {total.toLocaleString()} {itemLabel}</span>
      : <span className="sl-supporting">{total} {total === 1 ? itemLabel.replace(/s$/, '') : itemLabel}{totalPages ? ` · Page ${safePage} of ${totalPages}` : ''}</span>}
    <div className="sl-row-actions">
      <button type="button" className="sl-button sl-pagination-arrow" aria-label="Previous page" disabled={totalPages === 0 || safePage <= 1} onClick={() => onPageChange(safePage - 1)}>{compact ? '‹' : 'Previous'}</button>
      {totalPages === 0
        ? <button type="button" className="sl-button sl-page-number sl-page-number-active" aria-current="page" disabled>1</button>
        : pages.map((value, index) => <span key={value} className="sl-pagination-page-slot">
          {index > 0 && value - pages[index - 1] > 1 && <span className="sl-pagination-ellipsis" aria-hidden="true">…</span>}
          <button type="button" className={`sl-button sl-page-number${value === safePage ? ' sl-page-number-active' : ''}`} aria-current={value === safePage ? 'page' : undefined} onClick={() => onPageChange(value)}>{value}</button>
        </span>)}
      <button type="button" className="sl-button sl-pagination-arrow" aria-label="Next page" disabled={totalPages === 0 || safePage >= totalPages} onClick={() => onPageChange(safePage + 1)}>{compact ? '›' : 'Next'}</button>
    </div>
  </nav>;
}
