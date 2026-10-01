import type { ReactNode, RefObject } from 'react';
import type { LucideIcon } from 'lucide-react';
import { Dialog } from './Dialog';

export type ApplicationDetailRow = { label: string; value: ReactNode; wide?: boolean };

export function ApplicationDetailsDialog({ open, title, subtitle, Icon, identityTitle, identityBadge, sectionTitle, rows, onDismiss, returnFocus, className = '', actions }: {
  open: boolean;
  title: string;
  subtitle: string;
  Icon: LucideIcon;
  identityTitle: ReactNode;
  identityBadge: ReactNode;
  sectionTitle: string;
  rows: ApplicationDetailRow[];
  onDismiss: () => void;
  returnFocus?: RefObject<HTMLElement | null>;
  className?: string;
  actions?: ReactNode;
}) {
  return <Dialog
    open={open}
    showClose={false}
    title={<span className="sl-account-dialog-heading"><span className="sl-account-dialog-icon"><Icon size={18} aria-hidden="true" /></span><span><span className="sl-account-dialog-title">{title}</span><small>{subtitle}</small></span></span>}
    onDismiss={onDismiss}
    returnFocus={returnFocus}
    actions={actions ?? <button type="button" className="sl-button" onClick={onDismiss}>Close</button>}
    className={`sl-add-user-dialog sl-account-reference-dialog sl-admin-ingredient-dialog sl-ingredient-view-dialog${className ? ` ${className}` : ''}`}
  >
    <div className="sl-ingredient-details"><section className="sl-ingredient-details-identity"><div><h3>{identityTitle}</h3><span className="sl-application-role-pill sl-account-details-role">{identityBadge}</span></div></section><section className="sl-ingredient-details-information"><h3>{sectionTitle}</h3><dl className="sl-ingredient-details-grid">
      {rows.map(row => <div key={row.label} className={row.wide ? 'sl-ingredient-details-description' : undefined}><dt>{row.label}</dt><dd>{row.value}</dd></div>)}
    </dl></section></div>
  </Dialog>;
}
