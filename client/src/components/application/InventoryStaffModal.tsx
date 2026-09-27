import type { FormEvent, ReactNode, RefObject } from 'react';
import type { LucideIcon } from 'lucide-react';
import { Plus } from 'lucide-react';
import { ApplicationModal, ApplicationModalForm } from './ApplicationModal';

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
  actions,
  busy = false,
  className = '',
}: {
  open: boolean;
  title: string;
  subtitle: string;
  Icon: LucideIcon;
  onDismiss: () => void;
  returnFocus: RefObject<HTMLElement | null>;
  children: ReactNode;
  actions?: ReactNode;
  busy?: boolean;
  className?: string;
}) {
  return <ApplicationModal
    open={open}
    onDismiss={onDismiss}
    returnFocus={returnFocus}
    busy={busy}
    className={`sl-staff-usage-dialog sl-staff-usage-dialog-exact sl-inventory-staff-modal${className ? ` ${className}` : ''}`}
    actions={actions}
    title={title}
    subtitle={subtitle}
    Icon={Icon}
  >
    {children}
  </ApplicationModal>;
}

export function InventoryStaffModalForm({
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
}: {
  formId?: string;
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
  return <ApplicationModalForm
    formId={formId}
    formRef={formRef}
    onSubmit={onSubmit}
    message={message}
    secondaryLabel={secondaryLabel}
    onSecondary={onSecondary}
    primaryLabel={primaryLabel}
    PrimaryIcon={PrimaryIcon}
    busy={busy}
    className="sl-staff-usage-form sl-inventory-staff-modal-form"
  >{children}</ApplicationModalForm>;
}
