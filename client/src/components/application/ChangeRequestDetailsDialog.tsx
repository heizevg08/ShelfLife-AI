import type { ReactNode, RefObject } from 'react';
import { FileInput } from 'lucide-react';
import { CHANGE_REQUEST_TARGET_LABELS, changeRequestStatusLabel, changeRequestTypeLabel, changeRequestValue, isCurrentChangeRequest, type ChangeRequest } from '../../services/change-requests';
import { formatStaffChangeRequestValue } from '../../utils/change-request-format';
import { formatDateTime } from '../../utils/date-time';
import { formatHumanReadableText } from '../../utils/display-text';
import { ApplicationDetailsDialog } from './ApplicationDetailsDialog';
import { Dialog } from './Dialog';
import { Status } from './primitives';

export const formatChangeRequestSummary = (request: ChangeRequest) => request.reason;

const statusTone = (status: ChangeRequest['status']) => status === 'PENDING' ? 'attention' : status === 'APPROVED' ? 'success' : 'critical';

function InventoryStaffChangeRequestDetails({ request, onDismiss, returnFocus, myRequests }: { request: ChangeRequest; onDismiss:()=>void; returnFocus:RefObject<HTMLElement|null>; myRequests:boolean }) {
  const current = formatStaffChangeRequestValue(request, request.currentValue);
  const requested = formatStaffChangeRequestValue(request, request.requestedValue);
  const target = isCurrentChangeRequest(request) ? CHANGE_REQUEST_TARGET_LABELS[request.targetField] : 'Requested Change';
  return <Dialog
    open
    showClose={false}
    title={<span className="sl-account-dialog-heading"><span className="sl-account-dialog-icon"><FileInput size={18} aria-hidden="true" /></span><span><span className="sl-account-dialog-title">Change Request Details</span><small>View your submitted request.</small></span></span>}
    onDismiss={onDismiss}
    returnFocus={returnFocus}
    actions={<button type="button" className="sl-button" onClick={onDismiss}>Close</button>}
    className={`sl-account-reference-dialog sl-staff-change-request-details-dialog${myRequests ? ' sl-staff-my-requests-change-request-details-dialog' : ''}`}
  >
    <div className="sl-staff-change-request-details">
      <section className="sl-staff-change-request-identity" aria-label="Request identity">
        <div><h3>{request.ingredient ? formatHumanReadableText(request.ingredient.name) : '—'}</h3><Status tone={statusTone(request.status)}>{changeRequestStatusLabel(request.status)}</Status></div>
        <p><span>{request.requestID}</span><span aria-hidden="true"> · </span><time dateTime={request.createdAt}>{formatDateTime(request.createdAt)}</time></p>
      </section>
      <section className="sl-staff-change-request-content" aria-labelledby="sl-staff-request-change-title">
        <h3 id="sl-staff-request-change-title">{target}</h3>
        <div className={`sl-staff-change-request-comparison${request.targetField === 'description' ? ' sl-staff-change-request-comparison--long' : ''}`}>
          <div><strong>{current}</strong><span>Current</span></div>
          <span className="sl-staff-change-request-arrow" aria-hidden="true">→</span>
          <div className="sl-staff-change-request-requested"><strong>{requested}</strong><span>Requested</span></div>
        </div>
        <div className="sl-staff-change-request-reason"><h4>Reason</h4><p>{request.reason}</p></div>
        {request.status !== 'PENDING' && request.reviewedAt && <p className="sl-staff-change-request-outcome"><strong>{changeRequestStatusLabel(request.status)}</strong> <time dateTime={request.reviewedAt}>{formatDateTime(request.reviewedAt)}</time></p>}
        {request.status !== 'PENDING' && request.reviewNote?.trim() && <div className="sl-staff-change-request-manager-note"><h4>Manager Note</h4><p>{request.reviewNote}</p></div>}
      </section>
    </div>
  </Dialog>;
}

export function ChangeRequestDetailsDialog({ request, onDismiss, returnFocus, actions, title = 'Change Request Details', manager = false, inventoryStaff = false, inventoryStaffMyRequests = false }: { request: ChangeRequest|null; onDismiss:()=>void; returnFocus:RefObject<HTMLElement|null>; actions?:ReactNode; title?:string; manager?:boolean; inventoryStaff?:boolean; inventoryStaffMyRequests?:boolean }) {
  if (request && inventoryStaff) return <InventoryStaffChangeRequestDetails request={request} onDismiss={onDismiss} returnFocus={returnFocus} myRequests={inventoryStaffMyRequests}/>;
  const status=request?changeRequestStatusLabel(request.status):'Rejected';
  const ingredientName=request?.ingredient?formatHumanReadableText(request.ingredient.name):'—';
  const defaultRows=request?[{label:'Request ID',value:request.requestID},{label:'Submitted By',value:request.requestedBy.name},{label:'Submitted At',value:formatDateTime(request.createdAt)},{label:'Ingredient',value:ingredientName},{label:'Request Type',value:changeRequestTypeLabel(request.requestType)},{label:'Status',value:status},{label:'Field',value:isCurrentChangeRequest(request)?CHANGE_REQUEST_TARGET_LABELS[request.targetField]:'Legacy request field'},{label:'Current Value',value:changeRequestValue(request,request.currentValue)},{label:'Requested Value',value:changeRequestValue(request,request.requestedValue)},{label:'Reason',value:request.reason,wide:true},...(request.reviewedBy?[{label:'Reviewed By',value:request.reviewedBy.name}]:[]),...(request.reviewedAt?[{label:'Reviewed On',value:formatDateTime(request.reviewedAt)}]:[]),...(request.reviewNote?[{label:'Review Notes',value:request.reviewNote,wide:true}]:[]),...(!isCurrentChangeRequest(request)?[{label:'Compatibility',value:'Legacy request record',wide:true}]:[])]:[];
  const managerRows=request?[{label:'Request ID',value:request.requestID},{label:'Ingredient',value:ingredientName},{label:'Requested By',value:request.requestedBy.name},{label:'Submitted',value:formatDateTime(request.createdAt)},{label:'Request Type',value:changeRequestTypeLabel(request.requestType)},{label:'Detail to Change',value:isCurrentChangeRequest(request)?CHANGE_REQUEST_TARGET_LABELS[request.targetField]:'Legacy request field'},{label:'Current Value',value:changeRequestValue(request,request.currentValue)},{label:'Requested Value',value:changeRequestValue(request,request.requestedValue)},{label:'Reason',value:request.reason,wide:true},...(request.status!=='PENDING'?[...(request.reviewedBy?[{label:'Reviewed By',value:request.reviewedBy.name}]:[]),...(request.reviewedAt?[{label:'Reviewed',value:formatDateTime(request.reviewedAt)}]:[]),...(request.reviewNote?[{label:'Review Notes',value:request.reviewNote,wide:true}]:[]),{label:'Final Status',value:status}]:[]),...(!isCurrentChangeRequest(request)?[{label:'Compatibility',value:'Legacy request record',wide:true}]:[])]:[];
  const rows=manager?managerRows:defaultRows;
  return <ApplicationDetailsDialog open={Boolean(request)} title={title} subtitle="Review the submitted master-data change and decision." Icon={FileInput} identityTitle={request?.requestID??'—'} identityBadge={request&&isCurrentChangeRequest(request)?CHANGE_REQUEST_TARGET_LABELS[request.targetField]:'Legacy request'} sectionTitle="Request Information" rows={rows} onDismiss={onDismiss} returnFocus={returnFocus} actions={actions}/>;
}
