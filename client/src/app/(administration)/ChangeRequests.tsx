import { useRef, useState, type FormEvent } from 'react';
import { CheckCircle2, Clock3, Eye, FileInput, ListChecks, PackagePlus, Search, SlidersHorizontal, XCircle, type LucideIcon } from 'lucide-react';
import { DataState, PageHeader, Pagination, Status } from '../../components/application/primitives';
import { InventoryStaffModal, InventoryStaffModalForm } from '../../components/application/InventoryStaffModal';
import { useApplicationWorkspace } from '../../components/application/ApplicationWorkspace';
import { ModulePage } from '../../components/application/ModulePage';

const Empty = ({label,compact=false}:{label:string;compact?:boolean}) => <div className={`sl-staff-requests-pending${compact?' compact':''}`}><DataState kind="empty" title={`${label} unavailable`} description="The change-request service is not connected yet." /></div>;

type InventoryRequestType = 'Batch Correction' | 'Quantity Adjustment' | 'Unit Correction' | 'Add Missing Batch' | 'Other';
type InventoryRequestWorkflow = {
  title: InventoryRequestType;
  copy: string;
  Icon: LucideIcon;
  targetLabel: string;
  targetPlaceholder: string;
};

type InventoryRequestDraft = {
  target: string;
  details: string;
  requestedQuantity: string;
  requestedUnit: string;
  supplier: string;
  batchId: string;
  dateReceived: string;
  expiryDate: string;
  quantityReceived: string;
  reason: string;
};

const EMPTY_REQUEST_DRAFT: InventoryRequestDraft = {
  target: '',
  details: '',
  requestedQuantity: '',
  requestedUnit: '',
  supplier: '',
  batchId: '',
  dateReceived: '',
  expiryDate: '',
  quantityReceived: '',
  reason: '',
};

const INVENTORY_REQUEST_WORKFLOWS: InventoryRequestWorkflow[] = [
  { title:'Batch Correction', copy:'Adjust batch details (expiry, batch no., etc.)', Icon:SlidersHorizontal, targetLabel:'Ingredient / Batch', targetPlaceholder:'Search or select the batch to correct...' },
  { title:'Quantity Adjustment', copy:'Correct quantity due to system or encoding error', Icon:PackagePlus, targetLabel:'Ingredient / Batch', targetPlaceholder:'Search or select the quantity record...' },
  { title:'Unit Correction', copy:'Fix wrong unit of measurement', Icon:SlidersHorizontal, targetLabel:'Ingredient / Batch', targetPlaceholder:'Search or select the ingredient or batch...' },
  { title:'Add Missing Batch', copy:'Request to add a batch from received stock', Icon:PackagePlus, targetLabel:'Ingredient', targetPlaceholder:'Search or select the received ingredient...' },
  { title:'Other', copy:'Other inventory-related corrections', Icon:ListChecks, targetLabel:'Inventory Target (Optional)', targetPlaceholder:'Identify an affected ingredient, batch, or record if applicable...' },
];

function InventoryStaffChangeRequests(){
  const [search,setSearch]=useState(''); const [type,setType]=useState('All Types'); const [status,setStatus]=useState('All Statuses'); const [range,setRange]=useState('Last 7 Days'); const [dateFrom,setDateFrom]=useState(''); const [dateTo,setDateTo]=useState(''); const [rows,setRows]=useState(10); const [page,setPage]=useState(1);
  const [quickType,setQuickType]=useState<InventoryRequestType | null>(null); const [requestDraft,setRequestDraft]=useState<InventoryRequestDraft>(EMPTY_REQUEST_DRAFT); const [requestMessage,setRequestMessage]=useState(''); const quickTypeButton=useRef<HTMLButtonElement>(null);
  const requestWorkflow = INVENTORY_REQUEST_WORKFLOWS.find(workflow => workflow.title === quickType);
  const RequestIcon = requestWorkflow?.Icon ?? FileInput;
  const setRequestField = (field: keyof InventoryRequestDraft, value: string) => setRequestDraft(current => ({...current,[field]:value}));
  const closeRequest=()=>{setQuickType(null);setRequestDraft(EMPTY_REQUEST_DRAFT);setRequestMessage('')};
  const submitRequest=(event:FormEvent)=>{
    event.preventDefault();
    const complete = quickType === 'Batch Correction'
      ? requestDraft.target && requestDraft.details && requestDraft.reason
      : quickType === 'Quantity Adjustment'
        ? requestDraft.target && requestDraft.requestedQuantity && requestDraft.reason
        : quickType === 'Unit Correction'
          ? requestDraft.target && requestDraft.requestedUnit && requestDraft.reason
          : quickType === 'Add Missing Batch'
            ? requestDraft.target && requestDraft.batchId && requestDraft.supplier && requestDraft.dateReceived && requestDraft.expiryDate && requestDraft.quantityReceived && requestDraft.reason
            : quickType === 'Other'
              ? requestDraft.details && requestDraft.reason
              : false;
    setRequestMessage(complete ? 'Change-request submission is not connected to the backend yet.' : 'Complete all required fields before submitting.');
  };
  return <>
    <PageHeader title="My Requests" description="Track the status of your inventory change requests." />
    <div className="sl-admin-view sl-staff-requests-v162">
      <div className="sl-superadmin-dashboard-v49 sl-staff-usage-v150"><section className="sl-sa-kpis sl-inventory-staff-kpis sl-staff-requests-kpis sl-superadmin-dashboard-kpis-v201 sl-staff-usage-kpis" aria-label="Request summary">
        <article className="sl-sa-kpi sl-inventory-staff-kpi" data-tone="brand"><span className="sl-sa-kpi-icon"><FileInput/></span><div><span>Total Requests</span><strong>—</strong><small>Request summary unavailable</small></div></article>
        <article className="sl-sa-kpi sl-inventory-staff-kpi" data-tone="info"><span className="sl-sa-kpi-icon"><CheckCircle2/></span><div><span>Approved</span><strong>—</strong><small>Request summary unavailable</small></div></article>
        <article className="sl-sa-kpi sl-inventory-staff-kpi" data-tone="attention"><span className="sl-sa-kpi-icon"><Clock3/></span><div><span>Pending Review</span><strong>—</strong><small>Request summary unavailable</small></div></article>
        <article className="sl-sa-kpi sl-inventory-staff-kpi" data-tone="critical"><span className="sl-sa-kpi-icon"><XCircle/></span><div><span>Rejected</span><strong>—</strong><small>Request summary unavailable</small></div></article>
      </section></div>
      <div className="sl-staff-requests-layout">
        <main className="sl-staff-requests-main">
          <section className="sl-sa-ingredients-table-card sl-staff-usage-card sl-staff-usage-records sl-sa-account-pattern-records sl-staff-requests-card sl-staff-requests-records">
            <header className="sl-staff-usage-card-head sl-staff-usage-records-head"><span className="sl-staff-usage-head-icon"><FileInput aria-hidden="true" /></span><h2>Change Request Records</h2></header>
            <div className="sl-sa-ingredients-table-filters"><div className="sl-sa-ingredients-filter-card sl-staff-requests-toolbar"><label className="sl-sa-ingredients-search"><span>Search requests</span><div><Search size={16}/><input type="search" value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search by ingredient, request ID, or reason..."/></div></label><label><span>Type</span><select value={type} onChange={e=>setType(e.target.value)}><option>All Types</option><option>Batch Correction</option><option>Quantity Adjustment</option><option>Unit Correction</option><option>Add Missing Batch</option><option>Other</option></select></label><label><span>Status</span><select value={status} onChange={e=>setStatus(e.target.value)}><option>All Statuses</option><option>Pending</option><option>Approved</option><option>Rejected</option></select></label><label><span>Date range</span><select value={range} onChange={e=>setRange(e.target.value)}><option>Last 7 Days</option><option>Last 30 Days</option><option>Last 90 Days</option><option>Custom</option></select></label>{range==='Custom'&&<div className="sl-v219-custom-date-range" aria-label="Custom change-request date range"><label><span>From</span><input type="date" value={dateFrom} max={dateTo||undefined} onChange={e=>setDateFrom(e.target.value)}/></label><label><span>To</span><input type="date" value={dateTo} min={dateFrom||undefined} onChange={e=>setDateTo(e.target.value)}/></label></div>}<div className="sl-sa-ingredients-filter-actions"><button type="button" className="sl-button" onClick={()=>{setSearch('');setType('All Types');setStatus('All Statuses');setRange('Last 7 Days');setDateFrom('');setDateTo('');setPage(1)}}>Reset</button></div></div></div>
            <div className="sl-sa-ingredients-table-scroll sl-staff-usage-table-shell"><table className="sl-records-table sl-sa-ingredients-table sl-data-table sl-staff-usage-table sl-staff-requests-table"><thead><tr>{['Request ID','Date Submitted','Ingredient','Request Type','Details / Reason','Status','Reviewed By','Actions'].map(h=><th key={h}>{h}</th>)}</tr></thead><tbody><tr className="sl-sa-records-dash-row sl-staff-records-dash-row">{Array.from({length:7}).map((_,index)=><td key={index}>—</td>)}<td className="sl-sa-ingredients-actions-cell"><div className="sl-staff-waste-row-actions" aria-label="Change request actions unavailable"><button type="button" className="sl-icon-button" disabled aria-label="View change request unavailable" title="View unavailable"><Eye size={16}/></button></div></td></tr></tbody></table></div>
            <footer className="sl-records-footer sl-staff-usage-footer sl-sa-ingredients-footer"><label><span>Rows per page</span><select value={rows} onChange={event=>{setRows(Number(event.target.value));setPage(1);}}>{[10,15,50,100,150].map(n=><option key={n}>{n}</option>)}</select></label><Pagination compact page={page} pageSize={rows} total={0} itemLabel="request records" onPageChange={setPage} /></footer>
          </section>
        </main>
        <aside className="sl-staff-requests-rail">
          <section className="sl-staff-requests-card sl-staff-requests-sidecard sl-staff-request-status-card sl-superadmin-dashboard-v49"><header><span><ListChecks size={18}/></span><h2>My Request Status</h2></header><div className="sl-sa-chart-surface sl-sa-expiration-donut-surface" aria-label="Request status values unavailable"><div className="sl-sa-expiration-donut"><strong>—</strong><span>Requests</span></div><div className="sl-sa-chart-legend"><div><i data-series="1"/><span>Approved</span><strong>—</strong></div><div><i data-series="2"/><span>Pending</span><strong>—</strong></div><div><i data-series="3"/><span>Rejected</span><strong>—</strong></div></div><span className="sl-sa-chart-empty-note">Request data unavailable</span></div></section>
          <section className="sl-staff-requests-card sl-staff-requests-sidecard"><header><span><ListChecks size={18}/></span><h2>Request Types</h2></header><div className="sl-staff-request-types">{INVENTORY_REQUEST_WORKFLOWS.map(({Icon,title,copy})=><button type="button" key={title} className="sl-staff-request-type-button" onClick={event=>{quickTypeButton.current=event.currentTarget;setQuickType(title);setRequestDraft(EMPTY_REQUEST_DRAFT);setRequestMessage('')}}><span className="icon"><Icon size={16}/></span><p><strong>{title}</strong><small>{copy}</small></p></button>)}</div></section>
        </aside>
      </div>
    </div>
    <InventoryStaffModal open={quickType!==null} title={quickType ? `${quickType} Request` : 'Request'} subtitle="Submit an inventory correction for manager review." Icon={RequestIcon} onDismiss={closeRequest} returnFocus={quickTypeButton}>
      <InventoryStaffModalForm onSubmit={submitRequest} message={requestMessage} secondaryLabel="Cancel" onSecondary={closeRequest} primaryLabel="Submit Request" PrimaryIcon={FileInput}>
        <label><span>Request Type</span><input className="sl-staff-derived-unit" value={quickType ?? ''} readOnly /></label>
        <label><span>{requestWorkflow?.targetLabel ?? 'Inventory Target'} {quickType !== 'Other' && <b>*</b>}</span><input value={requestDraft.target} onChange={e=>setRequestField('target',e.target.value)} placeholder={requestWorkflow?.targetPlaceholder ?? 'Identify the affected inventory record...'} /></label>
        {quickType === 'Batch Correction' && <label className="sl-staff-request-wide"><span>Batch Correction Details <b>*</b></span><textarea value={requestDraft.details} onChange={e=>setRequestField('details',e.target.value)} placeholder="Describe the current batch detail and the proposed correction..." /></label>}
        {quickType === 'Quantity Adjustment' && <><label><span>Current Quantity</span><input className="sl-staff-derived-unit" value="—" readOnly aria-label="Current quantity unavailable" /></label><label><span>Requested Quantity <b>*</b></span><input inputMode="decimal" value={requestDraft.requestedQuantity} onChange={e=>setRequestField('requestedQuantity',e.target.value.replace(/[^0-9.]/g,''))} placeholder="Enter requested quantity" /></label></>}
        {quickType === 'Unit Correction' && <><label><span>Current Unit</span><input className="sl-staff-derived-unit" value="—" readOnly aria-label="Current unit unavailable" /></label><label><span>Requested Unit <b>*</b></span><input value={requestDraft.requestedUnit} onChange={e=>setRequestField('requestedUnit',e.target.value)} placeholder="Enter the requested unit" /></label></>}
        {quickType === 'Add Missing Batch' && <><label><span>Batch ID <b>*</b></span><input value={requestDraft.batchId} onChange={e=>setRequestField('batchId',e.target.value)} placeholder="Enter batch ID" /></label><label><span>Supplier <b>*</b></span><input value={requestDraft.supplier} onChange={e=>setRequestField('supplier',e.target.value)} placeholder="Enter supplier" /></label><label><span>Date Received <b>*</b></span><input type="date" value={requestDraft.dateReceived} onChange={e=>setRequestField('dateReceived',e.target.value)} /></label><label><span>Expiry Date <b>*</b></span><input type="date" value={requestDraft.expiryDate} onChange={e=>setRequestField('expiryDate',e.target.value)} /></label><label><span>Quantity Received <b>*</b></span><input inputMode="decimal" value={requestDraft.quantityReceived} onChange={e=>setRequestField('quantityReceived',e.target.value.replace(/[^0-9.]/g,''))} placeholder="Enter quantity" /></label><label><span>Unit</span><input className="sl-staff-derived-unit" value="—" readOnly aria-label="Derived unit unavailable" /></label></>}
        {quickType === 'Other' && <label className="sl-staff-request-wide"><span>Request Details <b>*</b></span><textarea value={requestDraft.details} onChange={e=>setRequestField('details',e.target.value)} placeholder="Describe the inventory-related correction needed..." /></label>}
        <label className="sl-staff-request-wide"><span>Reason <b>*</b></span><textarea value={requestDraft.reason} onChange={e=>setRequestField('reason',e.target.value)} placeholder="Explain why this correction is required..." /></label>
      </InventoryStaffModalForm>
    </InventoryStaffModal>
  </>;
}

function BaseChangeRequests() {
  return <><PageHeader title="Change Requests" description="Review and decide on inventory-related requests submitted by your team." /><div className="sl-admin-view sl-mgr-cr-page"><section className="sl-mgr-cr-kpis" aria-label="Change request summary"><article className="sl-mgr-cr-kpi tone-blue"><span className="sl-mgr-cr-icon"><FileInput/></span><div><small>Total Requests</small><strong>—</strong><span>Data unavailable</span></div></article><article className="sl-mgr-cr-kpi tone-amber"><span className="sl-mgr-cr-icon"><Clock3/></span><div><small>Pending Review</small><strong>—</strong><span>Requires your action</span></div></article><article className="sl-mgr-cr-kpi tone-green"><span className="sl-mgr-cr-icon"><CheckCircle2/></span><div><small>Approved (This Month)</small><strong>—</strong><span>Data unavailable</span></div></article><article className="sl-mgr-cr-kpi tone-red"><span className="sl-mgr-cr-icon"><XCircle/></span><div><small>Rejected (This Month)</small><strong>—</strong><span>Data unavailable</span></div></article></section><Empty label="Change requests"/></div></>;
}
export default function ChangeRequests(){
  const {user}=useApplicationWorkspace();
  // Super Admin /ChangeRequests is owned by ModulePage.tsx. Keep this route as routing only for that role;
  // Inventory Staff and the existing fallback role UI remain owned by their established implementations here.
  return user.role==='Inventory Staff'
    ? <InventoryStaffChangeRequests/>
    : user.role==='Super Admin' || user.role==='Manager'
      ? <ModulePage moduleId="ChangeRequests"/>
      : <BaseChangeRequests/>;
}
