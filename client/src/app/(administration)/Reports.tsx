import { AlertTriangle, BarChart3, CalendarDays, ChevronDown, ClipboardList, Download, FileBarChart2, Leaf, Package, PieChart, RotateCcw, SlidersHorizontal, Trash2, TrendingUp } from 'lucide-react';
import { useState } from 'react';
import { reportExportFormats } from '../../components/application/module-content';
import { Card, DataState, ExportControl, PageHeader, Status } from '../../components/application/primitives';
import { useApplicationWorkspace } from '../../components/application/ApplicationWorkspace';

function PendingPanel({ label, compact = false }: { label: string; compact?: boolean }) {
  return (
    <div className={`sl-manager-reports-pending${compact ? ' compact' : ''}`}>
      <DataState
        kind="empty"
        title="No live records yet"
        description={label}
        action={<Status>Preview · data pending</Status>}
      />
    </div>
  );
}

function AdminReports() {
  const [downloadOpen, setDownloadOpen] = useState(false);
  const reports = [
    ['Inventory Summary', 'Current stock levels and inventory value per ingredient.', 'Inventory'],
    ['Expiration Report', 'Ingredients nearing or past expiration.', 'Expiration'],
    ['Waste Report', 'Recorded waste quantities and costs.', 'Waste'],
    ['Ingredient Usage Report', 'Total ingredient usage over the selected period.', 'Usage'],
    ['Inventory Movement', 'Stock-in and stock-out history.', 'Inventory'],
    ['Low Stock Report', 'Ingredients below minimum stock level.', 'Inventory'],
    ['Master Data List', 'List of all ingredients and their details.', 'Master Data'],
  ];
  return <>
    <PageHeader title="Reports" description="Generate and view reports on inventory, usage, waste, and ingredient data for your establishment." />
    <div className="sl-admin-view sl-admin-reports-v114">
      <section className="sl-admin-reports-filters" aria-label="Report filters">
        <label><span>Date Range</span><div className="sl-admin-reports-date"><CalendarDays size={16}/><span>Data pending</span><ChevronDown size={15}/></div></label>
        <label><span>Report Type</span><select disabled><option>All Reports</option></select></label>
        <label><span>Category</span><select disabled><option>All Categories</option></select></label>
        <label><span>Group By</span><select disabled><option>None</option></select></label>
        <button className="sl-button sl-admin-reports-reset" type="button" disabled><RotateCcw size={14}/> Reset</button>
        <button className="sl-button sl-button-primary" type="button" disabled><SlidersHorizontal size={14}/> Apply Filters</button>
      </section>

      <section className="sl-admin-reports-kpis" aria-label="Report summary">
        <article className="sl-admin-reports-kpi" data-tone="green"><span className="sl-admin-reports-kpi-icon"><Package/></span><div><span>Total Inventory Value</span><strong>—</strong><small>Preview · data pending</small></div></article>
        <article className="sl-admin-reports-kpi" data-tone="amber"><span className="sl-admin-reports-kpi-icon"><Trash2/></span><div><span>Total Waste Cost</span><strong>—</strong><small>Preview · data pending</small></div></article>
        <article className="sl-admin-reports-kpi" data-tone="blue"><span className="sl-admin-reports-kpi-icon"><Leaf/></span><div><span>Total Ingredients</span><strong>—</strong><small>Preview · data pending</small></div></article>
        <article className="sl-admin-reports-kpi" data-tone="violet"><span className="sl-admin-reports-kpi-icon"><ClipboardList/></span><div><span>Total Batches</span><strong>—</strong><small>Preview · data pending</small></div></article>
      </section>

      <section className="sl-admin-reports-charts">
        <Card id="sl-admin-inventory-value-trend" title="Inventory Value Trend"><PendingPanel label="Inventory value trend" compact /></Card>
        <Card id="sl-admin-waste-cost-trend" title="Waste Cost Trend"><PendingPanel label="Waste cost trend" compact /></Card>
        <Card id="sl-admin-stock-status-distribution" title="Stock Status Distribution"><PendingPanel label="Stock status distribution" compact /></Card>
      </section>

      <div className="sl-admin-reports-available"><Card id="sl-admin-available-reports" title="Available Reports">
        <div className="sl-admin-reports-table-scroll">
          <div className="sl-admin-reports-table" role="table" aria-label="Available reports">
            <div className="sl-admin-reports-row sl-admin-reports-head" role="row"><span>Report Name</span><span>Description</span><span>Category</span><span>Last Generated</span><span>Actions</span></div>
            {reports.map(([name,desc,category]) => <div className="sl-admin-reports-row" role="row" key={name}>
              <span className="sl-admin-report-name"><i><FileBarChart2 size={15}/></i>{name}</span><span>{desc}</span><span><b data-category={category}>{category}</b></span><span className="sl-admin-report-pending">Data pending</span><span><button type="button" disabled>Generate</button></span>
            </div>)}
          </div>
        </div>
        <div className="sl-admin-reports-export">
          <div className="sl-download-control"><button type="button" className="sl-button sl-download-trigger" aria-expanded={downloadOpen} onClick={()=>setDownloadOpen(v=>!v)}><Download size={16}/> Export Reports <ChevronDown size={15}/></button>{downloadOpen && <div className="sl-download-menu" role="menu">{reportExportFormats.map(f=><button key={f.id} disabled className="sl-download-option">{f.label}</button>)}</div>}</div>
        </div>
      </Card></div>
    </div>
  </>;
}

function ManagerReports() {
  const [downloadOpen, setDownloadOpen] = useState(false);
  const reportTemplates = [
    ['Inventory Summary', 'Stock levels, usage, and current inventory value', 'Custom', 'PDF / Excel'],
    ['Usage & Waste Report', 'Ingredient usage, waste amounts, and waste rate', 'Custom', 'PDF / Excel'],
    ['Expiration Risk Report', 'Items nearing expiration and FEFO analysis', 'Custom', 'PDF / Excel'],
    ['Forecast vs. Actual Report', 'Forecast accuracy and demand comparison', 'Custom', 'PDF / Excel'],
    ['Category Analysis', 'Usage, waste, and value by ingredient category', 'Custom', 'PDF / Excel'],
  ] as const;

  return <>
    <PageHeader title="Reports & Analytics" description="Turn your inventory data into actionable insights." />
    <div className="sl-admin-view sl-manager-reports-v139">
      <section className="sl-manager-reports-kpis" aria-label="Report summary">
        <article className="sl-manager-reports-kpi" data-tone="green"><span className="sl-manager-reports-kpi-icon"><BarChart3 /></span><div><span>Total Ingredients Used</span><strong>—</strong><small>Preview · data pending</small></div></article>
        <article className="sl-manager-reports-kpi" data-tone="critical"><span className="sl-manager-reports-kpi-icon"><Trash2 /></span><div><span>Total Waste</span><strong>—</strong><small>Preview · data pending</small></div></article>
        <article className="sl-manager-reports-kpi" data-tone="attention"><span className="sl-manager-reports-kpi-icon"><PieChart /></span><div><span>Waste Rate</span><strong>—</strong><small>Preview · data pending</small></div></article>
        <article className="sl-manager-reports-kpi" data-tone="brand"><span className="sl-manager-reports-kpi-icon"><TrendingUp /></span><div><span>Forecast Accuracy</span><strong>—</strong><small>Preview · data pending</small></div></article>
      </section>

      <section className="sl-manager-reports-grid sl-manager-reports-grid-top" aria-label="Analytics overview">
        <Card id="manager-reports-movement" title="Inventory Movement Trend" action={<div className="sl-manager-reports-card-select"><select disabled><option>Daily</option></select></div>}><PendingPanel label="Inventory movement trend" compact /></Card>
        <Card id="manager-reports-waste-reason" title="Waste by Reason"><PendingPanel label="Waste reason breakdown" compact /></Card>
        <Card id="manager-reports-top-usage" title="Top 5 Ingredients by Usage" action={<div className="sl-manager-reports-card-select"><select disabled><option>This Month</option></select></div>}><PendingPanel label="Top ingredient usage" compact /></Card>
      </section>

      <section className="sl-manager-reports-grid sl-manager-reports-grid-bottom" aria-label="Forecast and category analytics">
        <Card id="manager-reports-forecast-actual" title="Forecast vs. Actual Usage" action={<div className="sl-manager-reports-card-select"><select disabled><option>Last 30 Days</option></select></div>}><PendingPanel label="Forecast versus actual usage" compact /></Card>
        <Card id="manager-reports-expiration-risk" title="Expiration Risk Distribution"><PendingPanel label="Expiration risk distribution" compact /></Card>
        <Card id="manager-reports-category-value" title="Inventory Value by Category"><PendingPanel label="Inventory value by category" compact /></Card>
      </section>

      <section className="sl-manager-reports-filter-bar" aria-label="Report filters">
        <label>
          <span>Date Range</span>
          <div className="sl-manager-reports-date"><CalendarDays size={16}/><span>Data pending</span><ChevronDown size={15}/></div>
        </label>
        <label>
          <span>Location</span>
          <select disabled><option>All Locations</option></select>
        </label>
        <label>
          <span>Report Category</span>
          <select disabled><option>All Categories</option></select>
        </label>
        <button className="sl-button sl-button-primary" type="button" disabled>
          <BarChart3 size={15} /> Generate Report
        </button>
      </section>

      <section className="sl-manager-reports-bottom" aria-label="Available reports">
        <Card id="manager-reports-available" title="Available Reports">
          <div className="sl-manager-reports-table-scroll">
            <div className="sl-manager-reports-table" role="table" aria-label="Available reports">
              <div className="sl-manager-reports-row sl-manager-reports-head" role="row">
                <span>Report Name</span>
                <span>Description</span>
                <span>Data Range</span>
                <span>Format</span>
                <span>Action</span>
              </div>
              {reportTemplates.map(([name, description, range, format]) => (
                <div className="sl-manager-reports-row" role="row" key={name}>
                  <span className="sl-manager-report-name"><i><FileBarChart2 size={15} /></i>{name}</span>
                  <span>{description}</span>
                  <span className="sl-manager-report-muted">{range}</span>
                  <span className="sl-manager-report-muted">{format}</span>
                  <span><button type="button" disabled>Generate</button></span>
                </div>
              ))}
            </div>
          </div>
          <div className="sl-manager-reports-export">
            <div className="sl-download-control">
              <button type="button" className="sl-button sl-download-trigger" aria-expanded={downloadOpen} onClick={() => setDownloadOpen(v => !v)}>
                <Download size={16} /> Export <ChevronDown size={15} />
              </button>
              {downloadOpen && <div className="sl-download-menu" role="menu">{reportExportFormats.map(f => <button key={f.id} disabled className="sl-download-option">{f.label}</button>)}</div>}
            </div>
          </div>
        </Card>

      </section>
    </div>
  </>;
}

function LegacyReports() {
  return <><PageHeader eyebrow="Analytics" title="Reports" description="Waste, inventory, and forecast reporting for system-wide oversight."/><div className="sl-admin-view sl-sa-reports-page sl-staff-usage-v150">
    <section className="sl-sa-kpis sl-inventory-staff-kpis sl-staff-usage-kpis" aria-label="Reporting summary">
      <article className="sl-sa-kpi sl-inventory-staff-kpi" data-tone="brand"><span className="sl-sa-kpi-icon"><Package aria-hidden="true" /></span><div><span>Inventory Value</span><strong>—</strong><small>Awaiting inventory valuation API</small></div></article>
      <article className="sl-sa-kpi sl-inventory-staff-kpi" data-tone="attention"><span className="sl-sa-kpi-icon"><Trash2 aria-hidden="true" /></span><div><span>Weekly Waste Cost</span><strong>—</strong><small>Awaiting waste-cost API</small></div></article>
      <article className="sl-sa-kpi sl-inventory-staff-kpi" data-tone="success"><span className="sl-sa-kpi-icon"><TrendingUp aria-hidden="true" /></span><div><span>Forecast Accuracy</span><strong>—</strong><small>Awaiting forecast accuracy API</small></div></article>
      <article className="sl-sa-kpi sl-inventory-staff-kpi" data-tone="critical"><span className="sl-sa-kpi-icon"><AlertTriangle aria-hidden="true" /></span><div><span>30-Day Waste Value</span><strong>—</strong><small>Awaiting reporting summary API</small></div></article>
    </section>
    <section className="sl-sa-reports-filter-card"><label><span>Date Range</span><div className="sl-sa-reports-date"><CalendarDays size={16}/><input value="Data pending" readOnly disabled/></div></label><label><span>Report Type</span><select disabled><option>All Report Types</option></select></label><label><span>Ingredient</span><select disabled><option>All Ingredients</option></select></label><div className="sl-sa-reports-filter-actions"><button className="sl-button sl-button-primary" disabled>Apply Filters</button><div className="sl-sa-reports-download"><ExportControl label="Download" menuId="sl-sa-reports-download-menu" /></div></div></section>
    <div className="sl-sa-reports-grid"><Card id="sl-weekly-waste-preview" title="Weekly Waste Cost"><PendingPanel label="Weekly waste cost"/></Card><Card id="sl-forecast-accuracy-preview" title="Forecast vs Actual Consumption"><PendingPanel label="Forecast vs actual consumption"/></Card></div><Card id="sl-high-waste-breakdown" title="High-Waste Breakdown"><PendingPanel label="High-waste ingredient breakdown"/></Card>
  </div></>;
}

export default function Reports(){
  const { user } = useApplicationWorkspace();
  if (user.role === 'Admin') return <AdminReports />;
  if (user.role === 'Manager') return <ManagerReports />;
  return <LegacyReports />;
}
