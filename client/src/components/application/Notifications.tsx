import { useEffect, useRef } from 'react';
import { Bell } from 'lucide-react';
import { DataState } from './primitives';

export function Notifications({ open, onChange }: { open: boolean; onChange: (open: boolean) => void }) {
  const container = useRef<HTMLDivElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;
    // Keep trigger focus so toggle, Tab departure, and Escape work without a close button.
    const outside = (event: PointerEvent) => {
      if (!container.current?.contains(event.target as Node)) onChange(false);
    };
    const escape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onChange(false);
        trigger.current?.focus();
      }
    };
    document.addEventListener('pointerdown', outside);
    document.addEventListener('keydown', escape);
    return () => {
      document.removeEventListener('pointerdown', outside);
      document.removeEventListener('keydown', escape);
    };
  }, [open, onChange]);

  return (
    <div className="sl-notifications" ref={container} onBlur={event => {
      if (!event.currentTarget.contains(event.relatedTarget)) onChange(false);
    }}>
      <button ref={trigger} className="sl-button sl-icon-button" aria-label="Notifications" aria-haspopup="dialog"
        aria-expanded={open} aria-controls="sl-notifications-panel" onClick={() => onChange(!open)}>
        <Bell size={20} aria-hidden="true" />
      </button>
      {open && <section id="sl-notifications-panel" className="sl-account-panel" role="dialog" tabIndex={0} aria-labelledby="sl-notifications-title">
        <div className="sl-popover-header">
          <h2 id="sl-notifications-title" className="sl-section-title">Notifications</h2>
        </div>
        {/* Missing integration is not evidence of an empty inbox. */}
        <DataState title="Notifications unavailable" description="Notifications are not connected yet. No notification history is available." />
      </section>}
    </div>
  );
}
