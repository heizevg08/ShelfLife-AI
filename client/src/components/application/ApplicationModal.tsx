import type { FormEvent, ReactNode, RefObject } from 'react';
import type { LucideIcon } from 'lucide-react';
import { Dialog } from './Dialog';

export function ApplicationModal({
  open,
  title,
  subtitle,
  Icon,
  onDismiss,
  returnFocus,
  children,
  actions,
  busy = false,
  showClose = true,
  className = '',
}: {
  open: boolean;
  title: string;
  subtitle: string;
  Icon: LucideIcon;
  onDismiss: () => void;
  returnFocus?: RefObject<HTMLElement | null>;
  children: ReactNode;
  actions?: ReactNode;
  busy?: boolean;
  showClose?: boolean;
  className?: string;
}) {
  return <Dialog
    open={open}
    onDismiss={onDismiss}
    returnFocus={returnFocus}
    busy={busy}
    showClose={showClose}
    actions={actions}
    className={`sl-application-modal${className ? ` ${className}` : ''}`}
    title={<span className="sl-application-modal-title"><span className="sl-application-card-icon"><Icon aria-hidden="true" /></span><span><strong>{title}</strong><small>{subtitle}</small></span></span>}
  >
    <section className="sl-application-modal-card">{children}</section>
  </Dialog>;
}

export function ApplicationModalForm({
  formId,
  formRef,
  onSubmit,
  children,
  message,
  secondaryLabel,
  onSecondary,
  primaryLabel,
  PrimaryIcon,
  busy = false,
  className = '',
}: {
  formId?: string;
  formRef?: RefObject<HTMLFormElement | null>;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
  children: ReactNode;
  message?: string;
  secondaryLabel: 'Clear' | 'Cancel';
  onSecondary: () => void;
  primaryLabel: string;
  PrimaryIcon?: LucideIcon;
  busy?: boolean;
  className?: string;
}) {
  return <form id={formId} ref={formRef} className={`sl-application-modal-form${className ? ` ${className}` : ''}`} noValidate onSubmit={onSubmit}>
    {children}
    {message && <p className="sl-inline-notice sl-application-modal-message" role="status">{message}</p>}
    <div className="sl-application-modal-actions">
      <button type="button" className="sl-button" disabled={busy} onClick={onSecondary}>{secondaryLabel}</button>
      <button type="submit" className="sl-button sl-button-primary" disabled={busy}>{PrimaryIcon && <PrimaryIcon size={16} aria-hidden="true" />}{primaryLabel}</button>
    </div>
  </form>;
}
