import { useEffect, useId, useRef, type ReactNode, type RefObject } from 'react';
import { X } from 'lucide-react';

export function Dialog({ open, title, onDismiss, children, actions, returnFocus, busy = false, showClose = true, className = '' }: {
  open: boolean; title: ReactNode; onDismiss: () => void; children: ReactNode;
  actions?: ReactNode; returnFocus?: RefObject<HTMLElement | null>;
  busy?: boolean;
  showClose?: boolean;
  className?: string;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  useEffect(() => {
    if (!open) return;
    const dialog = ref.current!;
    const opener = returnFocus?.current || document.activeElement as HTMLElement;
    dialog.showModal();
    // Prefer the safe action in confirmations; never initially focus a destructive action.
    (dialog.querySelector<HTMLElement>('[data-initial-focus]') || dialog.querySelector<HTMLElement>('button'))?.focus();
    return () => { dialog.close(); if (opener?.isConnected) opener.focus(); };
  }, [open, returnFocus]);
  return <dialog ref={ref} className={`sl-area-dialog ${className}`.trim()} aria-labelledby={titleId} aria-busy={busy}
    onCancel={event => { event.preventDefault(); if (!busy) onDismiss(); }}
    onKeyDown={event => {
      if (event.key !== 'Tab') return;
      const controls = [...event.currentTarget.querySelectorAll<HTMLElement>('button:not(:disabled), a[href], input:not(:disabled), select:not(:disabled), textarea:not(:disabled), [tabindex="0"]')];
      const first = controls[0], last = controls[controls.length - 1];
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
    }}>
    <div className="sl-popover-header"><h2 id={titleId} className="sl-section-title">{title}</h2>
      {showClose && <button type="button" disabled={busy} className="sl-button sl-icon-button sl-close-button" aria-label="Close dialog" onClick={onDismiss}><X size={18} aria-hidden="true" /></button>}
    </div>
    <div className="sl-dialog-content">{children}</div>
    {actions && <div className="sl-dialog-actions">{actions}</div>}
  </dialog>;
}
