import type { Dispatch, RefObject, SetStateAction } from 'react';

// The inline rejection form is rendered by a plain function so its validation
// contract can be exercised directly, without mounting the page or its API client.
export function renderManagerRejectionForm({ note, setNote, error, setError, field, onSubmit }: {
  note: string;
  setNote: Dispatch<SetStateAction<string>>;
  error: string;
  setError: Dispatch<SetStateAction<string>>;
  field: RefObject<HTMLTextAreaElement | null>;
  onSubmit?: () => void;
}) {
  const message = 'Enter the reason for rejecting this request.';
  // Validation belongs to the submit attempt, not to the act of revealing the
  // field: opening Reject shows a clean, untouched form.
  const invalid = Boolean(error);
  return <form id="manager-reject-change-request" className="sl-manager-inline-rejection" onSubmit={event => { event.preventDefault(); onSubmit?.(); }}>
    <label htmlFor="manager-rejection-reason">Rejection reason</label>
    <p id="manager-rejection-help" className="sl-field-help">Please explain why you're rejecting this request. Your reason will be saved with the request.</p>
    <textarea ref={field} id="manager-rejection-reason" rows={4} required value={note}
      aria-invalid={invalid}
      aria-describedby={invalid ? 'manager-rejection-help manager-rejection-error' : 'manager-rejection-help'}
      onInput={event => {
        const next = (event.target as HTMLTextAreaElement).value;
        setNote(next);
        // A later submit re-derives the message, so a valid value clears it now
        // and a whitespace-only value shows it again on the next attempt.
        if (next.trim()) setError('');
      }}/>
    {invalid && <p id="manager-rejection-error" className="sl-field-error" role="alert">{message}</p>}
  </form>;
}
