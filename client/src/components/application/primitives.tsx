import type { ReactNode } from 'react';
import { CircleDashed, Inbox, LoaderCircle, LockKeyhole, TriangleAlert } from 'lucide-react';

export function PageHeader({ eyebrow, title, description }: { eyebrow: string; title: string; description: string }) {
  return <header className="sl-page-header"><p className="sl-eyebrow">{eyebrow}</p>
    <h1 className="sl-page-title">{title}</h1><p className="sl-description">{description}</p></header>;
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

export function UnavailableTable({ label, columns, description }: { label: string; columns: string[]; description: string }) {
  // Supported columns remain visible; a missing service never implies zero records.
  return <div className="sl-table-scroll" role="region" aria-label={label} tabIndex={0}>
    <table className="sl-data-table"><caption className="sl-supporting">{description}</caption>
      <thead><tr>{columns.map(column => <th scope="col" key={column}>{column}</th>)}</tr></thead>
      <tbody><tr><td colSpan={columns.length}><DataState title="Records unavailable" description="This information is not connected yet. No records or totals can be confirmed." /></td></tr></tbody>
    </table>
  </div>;
}

export function Card({ title, children, id }: { title: string; children: ReactNode; id: string }) {
  return (
    <section className="sl-card" aria-labelledby={id}>
      <div className="sl-card-header">
        <h2 className="sl-section-title" id={id}>{title}</h2>
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
