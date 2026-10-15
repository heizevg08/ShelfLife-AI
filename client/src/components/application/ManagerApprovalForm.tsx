import { CHANGE_REQUEST_TARGET_LABELS, isCurrentChangeRequest, type ChangeRequest } from '../../services/change-requests';
import { formatChangeRequestComparisonParts } from '../../utils/change-request-format';

// The inline approval confirmation renders inside the Review dialog's scrolling
// body, so the request comparison above it stays visible while the footer swaps
// to Back to Review and Confirm Approval. It is a plain function for the same
// reason as the rejection form: its contract can be exercised without mounting
// the page or the API client.
export function renderManagerApprovalForm({ record, error, onSubmit }: {
  record: ChangeRequest;
  error: string;
  onSubmit?: () => void;
}) {
  // The only failure this section can show is the failed approval itself, since
  // opening the confirmation clears any earlier message.
  const invalid = Boolean(error);
  const field = isCurrentChangeRequest(record) ? CHANGE_REQUEST_TARGET_LABELS[record.targetField] : 'Requested Change';
  const { current, requested } = formatChangeRequestComparisonParts(record);
  return <form id="manager-approve-change-request" className="sl-manager-inline-approval" aria-labelledby="manager-approval-question" aria-describedby={invalid ? 'manager-approval-error' : undefined} onSubmit={event => { event.preventDefault(); onSubmit?.(); }}>
    <h4 id="manager-approval-question">Approve this request?</h4>
    <p className="sl-field-help">The requested change will be applied to the ingredient. Once approved, the ingredient will use the new value.</p>
    {/* One line names the actual field and its old and new values, so the factual
        consequence of approving is readable without repeating the comparison block. */}
    <p className="sl-manager-inline-approval-change"><strong>{field}</strong><span aria-hidden="true">:</span> {current} <span aria-hidden="true">→</span> {requested}</p>
    {invalid && <p id="manager-approval-error" className="sl-field-error" role="alert">{error}</p>}
  </form>;
}
