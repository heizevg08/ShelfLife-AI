import type { FormEvent, ReactNode, RefObject } from 'react';
import type { LucideIcon } from 'lucide-react';
import { Plus } from 'lucide-react';
import { Dialog } from './Dialog';

export function InventoryStaffAddButton({
  buttonRef,
  label,
  onClick,
  disabled = false,
}: {
  buttonRef: RefObject<HTMLButtonElement | null>;
  label: string;
  onClick: () => void;
  disabled?: boolean;
}) {
  return <button ref={buttonRef} type="button" className="sl-button sl-button-primary sl-staff-usage-add" disabled={disabled} onClick={onClick}>
    <Plus size={16} aria-hidden="true" />{label}
  </button>;
}

export function InventoryStaffModal({
  open,
  title,
  subtitle,
  Icon,
  onDismiss,
  returnFocus,
  children,
  busy = false,
}: {
  open: boolean;
  title: string;
  subtitle: string;
  Icon: LucideIcon;
  onDismiss: () => void;
  returnFocus: RefObject<HTMLElement | null>;
  children: ReactNode;
  busy?: boolean;
}) {
  return <Dialog
    open={open}
    onDismiss={onDismiss}
    returnFocus={returnFocus}
    busy={busy}
    className="sl-staff-usage-dialog sl-staff-usage-dialog-exact sl-inventory-staff-modal"
    title={<span className="sl-staff-usage-dialog-title"><span className="sl-staff-usage-head-icon"><Icon aria-hidden="true" /></span><span><strong>{title}</strong><small>{subtitle}</small></span></span>}
  >
    <section className="sl-staff-usage-card sl-staff-usage-form-card sl-staff-usage-modal-card">{children}</section>
  </Dialog>;
}

export function InventoryStaffModalForm({
  formRef,
  onSubmit,
  children,
  message,
  secondaryLabel,
  onSecondary,
  primaryLabel,
  PrimaryIcon,
  busy = false,
}: {
  formRef?: RefObject<HTMLFormElement | null>;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
  children: ReactNode;
  message?: string;
  secondaryLabel: 'Clear' | 'Cancel';
  onSecondary: () => void;
  primaryLabel: string;
  PrimaryIcon: LucideIcon;
  busy?: boolean;
}) {
  return <form ref={formRef} className="sl-staff-usage-form sl-inventory-staff-modal-form" noValidate onSubmit={onSubmit}>
    {children}
    {message && <p className="sl-inline-notice sl-staff-modal-message" role="status">{message}</p>}
    <div className="sl-staff-usage-form-actions">
      <button type="button" className="sl-button" disabled={busy} onClick={onSecondary}>{secondaryLabel}</button>
      <button type="submit" className="sl-button sl-button-primary" disabled={busy}><PrimaryIcon size={16} aria-hidden="true" />{primaryLabel}</button>
    </div>
  </form>;
}
