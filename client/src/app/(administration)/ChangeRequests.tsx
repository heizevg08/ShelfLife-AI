import { useRef, useState } from 'react';
import { CheckCircle2, Clock3, FileInput, ListChecks, PackagePlus, Search, SlidersHorizontal, XCircle } from 'lucide-react';
import { DataState, PageHeader, Status } from '../../components/application/primitives';
import { Dialog } from '../../components/application/Dialog';
import { useApplicationWorkspace } from '../../components/application/ApplicationWorkspace';
import { ModulePage } from '../../components/application/ModulePage';

const Empty = ({label,compact=false}:{label:string;compact?:boolean}) => <div className={`sl-staff-requests-pending${compact?' compact':''}`}><DataState kind="empty" title="No live records yet" description={label} action={<Status>Preview · data pending</Status>} /></div>;

function InventoryStaffChangeRequests(){
  const [search,setSearch]=useState(''); const [type,setType]=useState('All Types'); const [status,setStatus]=useState('All Statuses'); const [range,setRange]=useState('Last 30 Days'); const [rows,setRows]=useState('10');
  const [quickType,setQuickType]=useState<string | null>(null); const quickTypeButton=useRef<HTMLButtonElement>(null);
  return <>
    <PageHeader title="My Requests" description="Track the status of your inventory change requests." />
    <div className="sl-admin-view sl-staff-requests-v162">
      <section className="sl-sa-kpis sl-inventory-staff-kpis sl-staff-requests-kpis" aria-label="Request summary">
        <article className="sl-sa-kpi sl-inventory-staff-kpi" data-tone="brand"><span className="sl-sa-kpi-icon"><FileInput/></span><div><span>Total Requests</span><strong>—</strong><small>Preview · data pending</small></div></article>
        <article className="sl-sa-kpi sl-inventory-staff-kpi" data-tone="info"><span className="sl-sa-kpi-icon"><CheckCircle2/></span><div><span>Approved</span><strong>—</strong><small>Preview · data pending</small></div></article>
        <article className="sl-sa-kpi sl-inventory-staff-kpi" data-tone="attention"><span className="sl-sa-kpi-icon"><Clock3/></span><div><span>Pending Review</span><strong>—</strong><small>Preview · data pending</small></div></article>
        <article className="sl-sa-kpi sl-inventory-staff-kpi" data-tone="critical"><span className="sl-sa-kpi-icon"><XCircle/></span><div><span>Rejected</span><strong>—</strong><small>Preview · data pending</small></div></article>
      </section>
      <div className="sl-staff-requests-layout">
        <main className="sl-staff-requests-main">
          <section className="sl-staff-requests-card sl-staff-requests-records">
            <div className="sl-staff-requests-toolbar"><label className="sl-staff-requests-search"><Search size={16}/><input type="search" value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search by ingredient, request ID, or reason..."/></label><select value={type} onChange={e=>setType(e.target.value)}><option>All Types</option><option>Batch Correction</option><option>Quantity Adjustment</option><option>Unit Correction</option><option>Add Missing Batch</option><option>Other</option></select><select value={status} onChange={e=>setStatus(e.target.value)}><option>All Statuses</option><option>Pending</option><option>Approved</option><option>Rejected</option></select><select value={range} onChange={e=>setRange(e.target.value)}><option>Last 30 Days</option><option>Last 7 Days</option><option>Last 90 Days</option></select></div>
            <div className="sl-staff-requests-table-shell"><table className="sl-data-table sl-staff-requests-table"><thead><tr>{['Request ID','Date Submitted','Ingredient','Request Type','Details / Reason','Status','Reviewed By','Actions'].map(h=><th key={h}>{h}</th>)}</tr></thead></table><Empty label="Change requests"/></div>
            <footer className="sl-staff-requests-footer"><label><span>Rows per page</span><select value={rows} onChange={e=>setRows(e.target.value)}>{['10','15','50','100','150'].map(n=><option key={n}>{n}</option>)}</select></label><span>Pagination will activate when live request records are available.</span></footer>
          </section>
        </main>
        <aside className="sl-staff-requests-rail">
          <section className="sl-staff-requests-card sl-staff-requests-sidecard"><header><span><ListChecks size={18}/></span><h2>Request Types</h2></header><div className="sl-staff-request-types">{[[SlidersHorizontal,'Batch Correction','Adjust batch details (expiry, batch no., etc.)'],[PackagePlus,'Quantity Adjustment','Correct quantity due to system or encoding error'],[SlidersHorizontal,'Unit Correction','Fix wrong unit of measurement'],[PackagePlus,'Add Missing Batch','Request to add a batch from received stock'],[ListChecks,'Other','Other inventory-related corrections']].map(([Icon,title,copy]:any)=><button ref={title==='Batch Correction'?quickTypeButton:undefined} type="button" key={title} className="sl-staff-request-type-button" onClick={()=>setQuickType(title)}><span className="icon"><Icon size={16}/></span><p><strong>{title}</strong><small>{copy}</small></p></button>)}</div></section>
          <section className="sl-staff-requests-card sl-staff-requests-sidecard"><header><span><ListChecks size={18}/></span><h2>My Request Status</h2></header><Empty label="Request status summary" compact/></section>
          <section className="sl-staff-requests-card sl-staff-requests-sidecard"><header><span><Clock3 size={18}/></span><h2>Recent Activity</h2></header><Empty label="Recent request activity" compact/></section>
        </aside>
      </div>
    </div>
    <Dialog open={quickType!==null} title={quickType ? `${quickType} Request` : 'Request'} onDismiss={()=>setQuickType(null)} returnFocus={quickTypeButton} className="sl-staff-requests-dialog sl-staff-request-type-dialog">
      <form className="sl-staff-requests-form" onSubmit={e=>e.preventDefault()}>
        <label><span>Request Type</span><input value={quickType ?? ''} readOnly /></label>
        <label><span>Ingredient / Batch <b>*</b></span><input placeholder="Search or select target..." /></label>
        {quickType==='Batch Correction' && <label className="wide"><span>Batch Correction Details <b>*</b></span><textarea placeholder="Enter the batch detail to correct and the proposed value..." /></label>}
        {quickType==='Quantity Adjustment' && <label className="wide"><span>Quantity Adjustment <b>*</b></span><textarea placeholder="Enter the correct quantity, unit, and reason for adjustment..." /></label>}
        {quickType==='Unit Correction' && <label className="wide"><span>Unit Correction <b>*</b></span><textarea placeholder="Enter the current unit, correct unit, and reason..." /></label>}
        {quickType==='Add Missing Batch' && <label className="wide"><span>Missing Batch Details <b>*</b></span><textarea placeholder="Enter received-stock and missing batch details..." /></label>}
        {quickType==='Other' && <label className="wide"><span>Request Details <b>*</b></span><textarea placeholder="Describe the inventory-related correction needed..." /></label>}
        <div className="wide actions"><button type="button" className="sl-button" onClick={()=>setQuickType(null)}>Cancel</button><button type="button" className="sl-button sl-button-primary" title="Change request API is not connected yet"><FileInput size={16}/>Submit Request</button></div>
      </form>
    </Dialog>
  </>;
}

function BaseChangeRequests() {
  return <><PageHeader title="Change Requests" description="Review and decide on inventory-related requests submitted by your team." /><div className="sl-admin-view sl-mgr-cr-page"><section className="sl-mgr-cr-kpis" aria-label="Change request summary"><article className="sl-mgr-cr-kpi tone-blue"><span className="sl-mgr-cr-icon"><FileInput/></span><div><small>Total Requests</small><strong>—</strong><span>Preview · data pending</span></div></article><article className="sl-mgr-cr-kpi tone-amber"><span className="sl-mgr-cr-icon"><Clock3/></span><div><small>Pending Review</small><strong>—</strong><span>Requires your action</span></div></article><article className="sl-mgr-cr-kpi tone-green"><span className="sl-mgr-cr-icon"><CheckCircle2/></span><div><small>Approved (This Month)</small><strong>—</strong><span>Preview · data pending</span></div></article><article className="sl-mgr-cr-kpi tone-red"><span className="sl-mgr-cr-icon"><XCircle/></span><div><small>Rejected (This Month)</small><strong>—</strong><span>Preview · data pending</span></div></article></section><Empty label="Change requests"/></div></>;
}
export default function ChangeRequests(){
  const {user}=useApplicationWorkspace();
  // Super Admin /ChangeRequests is owned by ModulePage.tsx. Keep this route as routing only for that role;
  // Inventory Staff and the existing fallback role UI remain owned by their established implementations here.
  return user.role==='Inventory Staff'
    ? <InventoryStaffChangeRequests/>
    : user.role==='Super Admin'
      ? <ModulePage moduleId="ChangeRequests"/>
      : <BaseChangeRequests/>;
}
