import type { ReactNode, RefObject } from 'react';
import { FileInput } from 'lucide-react';
import { CHANGE_REQUEST_TARGET_LABELS, changeRequestTypeLabel, changeRequestValue, isCurrentChangeRequest, type ChangeRequest } from '../../services/change-requests';
import { formatStaffChangeRequestValue } from '../../utils/change-request-format';
import { formatDateTime } from '../../utils/date-time';
import { ApplicationDetailsDialog } from './ApplicationDetailsDialog';
import { Dialog } from './Dialog';
import { Status } from './primitives';

export const formatChangeRequestSummary = (request: ChangeRequest) => request.reason;

const statusLabel = (status: ChangeRequest['status']) => status === 'PENDING' ? 'Pending' : status === 'APPROVED' ? 'Approved' : 'Rejected';
const statusTone = (status: ChangeRequest['status']) => status === 'PENDING' ? 'attention' : status === 'APPROVED' ? 'success' : 'critical';

function InventoryStaffChangeRequestDetails({ request, onDismiss, returnFocus }: { request: ChangeRequest; onDismiss:()=>void; returnFocus:RefObject<HTMLElement|null> }) {
  const current = formatStaffChangeRequestValue(request, request.currentValue);
  const requested = formatStaffChangeRequestValue(request, request.requestedValue);
  const target = isCurrentChangeRequest(request) ? CHANGE_REQUEST_TARGET_LABELS[request.targetField] : 'Requested Change';
  const hasReviewInformation = request.status !== 'PENDING' && Boolean(request.reviewedBy || request.reviewedAt || request.reviewNote);
  return <Dialog
    open
    showClose={false}
    title={<span className="sl-account-dialog-heading"><span className="sl-account-dialog-icon"><FileInput size={18} aria-hidden="true" /></span><span><span className="sl-account-dialog-title">Change Request Details</span><small>View your submitted change request and its review status.</small></span></span>}
    onDismiss={onDismiss}
    returnFocus={returnFocus}
    actions={<button type="button" className="sl-button" onClick={onDismiss}>Close</button>}
    className="sl-add-user-dialog sl-account-reference-dialog sl-admin-ingredient-dialog sl-ingredient-view-dialog sl-staff-change-request-details-dialog"
  >
    <div className="sl-staff-change-request-details">
      <section aria-labelledby="sl-staff-request-information-title">
        <h3 id="sl-staff-request-information-title">Request Information</h3>
        <dl className="sl-staff-change-request-information">
          <div><dt>Request ID</dt><dd>{request.requestID}</dd></div>
          <div><dt>Submitted</dt><dd><time dateTime={request.createdAt}>{formatDateTime(request.createdAt)}</time></dd></div>
          <div><dt>Ingredient</dt><dd className="sl-emphasized-value">{request.ingredient?.name ?? '—'}</dd></div>
          <div className="sl-staff-change-request-status"><dt>Status</dt><dd><Status tone={statusTone(request.status)}>{statusLabel(request.status)}</Status>{request.status === 'PENDING' && <small>Awaiting manager review</small>}</dd></div>
        </dl>
      </section>
      <section aria-labelledby="sl-staff-request-change-title">
        <h3 id="sl-staff-request-change-title">Requested Change</h3>
        <h4>{target}</h4>
        <div className={`sl-staff-change-request-comparison${request.targetField === 'description' ? ' sl-staff-change-request-comparison--long' : ''}`}>
          <div><strong>{current}</strong><span>Current</span></div>
          <span className="sl-staff-change-request-arrow" aria-hidden="true">→</span>
          <div><strong>{requested}</strong><span>Requested</span></div>
        </div>
        <div className="sl-staff-change-request-reason"><h4>Reason</h4><p>{request.reason}</p></div>
      </section>
      {hasReviewInformation && <section aria-labelledby="sl-staff-request-review-title">
        <h3 id="sl-staff-request-review-title">Review Information</h3>
        <dl className="sl-staff-change-request-review">
          <div><dt>Decision</dt><dd><Status tone={statusTone(request.status)}>{statusLabel(request.status)}</Status></dd></div>
          {request.reviewedBy && <div><dt>Reviewed By</dt><dd>{request.reviewedBy.name}</dd></div>}
          {request.reviewedAt && <div><dt>Reviewed At</dt><dd><time dateTime={request.reviewedAt}>{formatDateTime(request.reviewedAt)}</time></dd></div>}
          {request.reviewNote && <div className="sl-staff-change-request-review-note"><dt>Review Notes</dt><dd>{request.reviewNote}</dd></div>}
        </dl>
      </section>}
    </div>
  </Dialog>;
}

export function ChangeRequestDetailsDialog({ request, onDismiss, returnFocus, actions, title = 'Change Request Details', manager = false, inventoryStaff = false }: { request: ChangeRequest|null; onDismiss:()=>void; returnFocus:RefObject<HTMLElement|null>; actions?:ReactNode; title?:string; manager?:boolean; inventoryStaff?:boolean }) {
  if (request && inventoryStaff) return <InventoryStaffChangeRequestDetails request={request} onDismiss={onDismiss} returnFocus={returnFocus}/>;
  const status=request?.status==='PENDING'?'Pending Review':request?.status==='APPROVED'?'Approved':'Rejected';
  const defaultRows=request?[{label:'Request ID',value:request.requestID},{label:'Submitted By',value:request.requestedBy.name},{label:'Submitted At',value:formatDateTime(request.createdAt)},{label:'Ingredient',value:request.ingredient?.name??'—'},{label:'Request Type',value:changeRequestTypeLabel(request.requestType)},{label:'Status',value:status},{label:'Field',value:isCurrentChangeRequest(request)?CHANGE_REQUEST_TARGET_LABELS[request.targetField]:'Legacy request field'},{label:'Current Value',value:changeRequestValue(request,request.currentValue)},{label:'Requested Value',value:changeRequestValue(request,request.requestedValue)},{label:'Reason',value:request.reason,wide:true},...(request.reviewedBy?[{label:'Reviewed By',value:request.reviewedBy.name}]:[]),...(request.reviewedAt?[{label:'Reviewed On',value:formatDateTime(request.reviewedAt)}]:[]),...(request.reviewNote?[{label:'Review Notes',value:request.reviewNote,wide:true}]:[]),...(!isCurrentChangeRequest(request)?[{label:'Compatibility',value:'Legacy request record',wide:true}]:[])]:[];
  const managerRows=request?[{label:'Request ID',value:request.requestID},{label:'Ingredient',value:request.ingredient?.name??'—'},{label:'Requested By',value:request.requestedBy.name},{label:'Submitted',value:formatDateTime(request.createdAt)},{label:'Request Type',value:changeRequestTypeLabel(request.requestType)},{label:'Detail to Change',value:isCurrentChangeRequest(request)?CHANGE_REQUEST_TARGET_LABELS[request.targetField]:'Legacy request field'},{label:'Current Value',value:changeRequestValue(request,request.currentValue)},{label:'Requested Value',value:changeRequestValue(request,request.requestedValue)},{label:'Reason',value:request.reason,wide:true},...(request.status!=='PENDING'?[...(request.reviewedBy?[{label:'Reviewed By',value:request.reviewedBy.name}]:[]),...(request.reviewedAt?[{label:'Reviewed',value:formatDateTime(request.reviewedAt)}]:[]),...(request.reviewNote?[{label:'Review Notes',value:request.reviewNote,wide:true}]:[]),{label:'Final Status',value:status}]:[]),...(!isCurrentChangeRequest(request)?[{label:'Compatibility',value:'Legacy request record',wide:true}]:[])]:[];
  const rows=manager?managerRows:defaultRows;
  return <ApplicationDetailsDialog open={Boolean(request)} title={title} subtitle="Review the submitted master-data change and decision." Icon={FileInput} identityTitle={request?.requestID??'—'} identityBadge={request&&isCurrentChangeRequest(request)?CHANGE_REQUEST_TARGET_LABELS[request.targetField]:'Legacy request'} sectionTitle="Request Information" rows={rows} onDismiss={onDismiss} returnFocus={returnFocus} actions={actions}/>;
}
