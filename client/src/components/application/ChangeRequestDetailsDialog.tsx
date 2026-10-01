import type { ReactNode, RefObject } from 'react';
import { FileInput } from 'lucide-react';
import { CHANGE_REQUEST_TARGET_LABELS, changeRequestTypeLabel, changeRequestValue, isCurrentChangeRequest, type ChangeRequest } from '../../services/change-requests';
import { formatDateTime } from '../../utils/date-time';
import { ApplicationDetailsDialog } from './ApplicationDetailsDialog';

export const formatChangeRequestSummary = (request: ChangeRequest) => request.reason;
export function ChangeRequestDetailsDialog({ request, onDismiss, returnFocus, actions, title = 'Change Request Details' }: { request: ChangeRequest|null; onDismiss:()=>void; returnFocus:RefObject<HTMLElement|null>; actions?:ReactNode; title?:string }) {
 const status=request?.status==='PENDING'?'Pending Review':request?.status==='APPROVED'?'Approved':'Rejected';
 const rows=request?[{label:'Request ID',value:request.requestID},{label:'Ingredient',value:request.ingredient?.name??'—'},{label:'Requested By',value:request.requestedBy.name},{label:'Submitted',value:formatDateTime(request.createdAt)},{label:'Request Type',value:changeRequestTypeLabel(request.requestType)},{label:'Detail to Change',value:isCurrentChangeRequest(request)?CHANGE_REQUEST_TARGET_LABELS[request.targetField]:'Legacy request field'},{label:'Current Value',value:changeRequestValue(request,request.currentValue)},{label:'Requested Value',value:changeRequestValue(request,request.requestedValue)},{label:'Reason',value:request.reason,wide:true},...(request.status!=='PENDING'?[...(request.reviewedBy?[{label:'Reviewed By',value:request.reviewedBy.name}]:[]),...(request.reviewedAt?[{label:'Reviewed',value:formatDateTime(request.reviewedAt)}]:[]),...(request.reviewNote?[{label:'Review Notes',value:request.reviewNote,wide:true}]:[]),{label:'Final Status',value:status}]:[]),...(!isCurrentChangeRequest(request)?[{label:'Compatibility',value:'Legacy request record',wide:true}]:[])]:[];
 return <ApplicationDetailsDialog open={Boolean(request)} title={title} subtitle="Review the submitted master-data change and decision." Icon={FileInput} identityTitle={request?.requestID??'—'} identityBadge={request&&isCurrentChangeRequest(request)?CHANGE_REQUEST_TARGET_LABELS[request.targetField]:'Legacy request'} sectionTitle="Request Information" rows={rows} onDismiss={onDismiss} returnFocus={returnFocus} actions={actions}/>
}
