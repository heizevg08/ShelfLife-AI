import type { ReactNode, RefObject } from 'react';
import type { LucideIcon } from 'lucide-react';
import { Dialog } from './Dialog';

export type ApplicationDetailRow = { label: string; value: ReactNode; wide?: boolean };

export function ApplicationDetailsDialog({ open, title, subtitle, Icon, identityTitle, identityBadge, identityStatus, identitySupport, sectionTitle, callout, lead, rows, afterRows, busy = false, onDismiss, returnFocus, className = '', closeLabel = 'Close dialog', showClose = false, closeVariant, actions }: {
  open: boolean;
  title: string;
  subtitle: string;
  Icon: LucideIcon;
  identityTitle: ReactNode;
  identityBadge: ReactNode;
  // Optional status slot. Only the change-request variant passes it, so every
  // other consumer keeps its current header markup unchanged.
  identityStatus?: ReactNode;
  // Optional supporting line under the identity pill. Only the change-request
  // variant passes it, so every other consumer keeps its exact markup.
  identitySupport?: ReactNode;
  sectionTitle: string;
  // Optional, in reading order: the value comparison first, then the reason.
  callout?: ReactNode;
  lead?: ReactNode;
  rows: ApplicationDetailRow[];
  afterRows?: ReactNode;
  busy?: boolean;
  onDismiss: () => void;
  returnFocus?: RefObject<HTMLElement | null>;
  className?: string;
  closeLabel?: string;
  // Default false preserves every other consumer's header exactly: the change
  // request dialog opts in to the visible top-right dismissal control.
  showClose?: boolean;
  // Optional, opt-in neutral close control; every other consumer is untouched.
  closeVariant?: 'neutral';
  actions?: ReactNode;
}) {
  return <Dialog
    open={open}
    title={<span className="sl-account-dialog-heading"><span className="sl-account-dialog-icon"><Icon size={18} aria-hidden="true" /></span><span><span className="sl-account-dialog-title">{title}</span><small>{subtitle}</small></span></span>}
    onDismiss={onDismiss}
    busy={busy}
    returnFocus={returnFocus}
    closeLabel={closeLabel}
    showClose={showClose}
    closeVariant={closeVariant}
    // The top-right X is the only dismissal control when a dialog supplies its
    // own actions; otherwise a single footer Close still dismisses it.
    actions={actions ?? <button type="button" className="sl-button" onClick={onDismiss}>Close</button>}
    className={`sl-add-user-dialog sl-account-reference-dialog sl-admin-ingredient-dialog sl-ingredient-view-dialog${className ? ` ${className}` : ''}`}
  >
    <div className="sl-ingredient-details">
      <section className="sl-ingredient-details-identity">
        <div className={identityStatus ? 'sl-ingredient-details-identity-row' : undefined}>
          <h3>{identityTitle}</h3>
          {identityStatus}
        </div>
        <span className="sl-application-role-pill sl-account-details-role">{identityBadge}</span>
        {identitySupport && <p className="sl-ingredient-details-identity-support">{identitySupport}</p>}
      </section>
      <section className="sl-ingredient-details-information">
        <h3>{sectionTitle}</h3>
        {callout}
        {lead}
        <dl className="sl-ingredient-details-grid">
      {rows.map(row => <div key={row.label} className={row.wide ? 'sl-ingredient-details-description' : undefined}><dt>{row.label}</dt><dd>{row.value}</dd></div>)}
        </dl>
        {afterRows}
      </section>
    </div>
  </Dialog>;
}
