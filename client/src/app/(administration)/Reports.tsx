import { AlertTriangle, CalendarDays, ClipboardList, Leaf, Package, PhilippinePeso, Trash2, TrendingUp } from 'lucide-react';
import { useEffect, useState } from 'react';
import { ApplicationDonutChart, ApplicationLineChart } from '../../components/application/ApplicationPatterns';
import { Card, DataState, ExportControl, PageHeader } from '../../components/application/primitives';
import { useApplicationWorkspace } from '../../components/application/ApplicationWorkspace';
import { listIngredients } from '../../services/ingredients';
import { getInventoryBatchSummary } from '../../services/inventory-batches';
import { DATE_RANGE_OPTIONS, type DateRangeValue } from '../../components/application/DateRangeFilter';
import { Dialog } from '../../components/application/Dialog';
import { ConnectedManagerReportsPage, ManagementReportDownloadCenter, ManagementReportRecentDownloads, adminReportOptions, useRecentReportDownloads } from '../../components/application/ManagerReportsPage';
import { FilterSelect } from '../../components/application/FilterSelect';
import { getWasteSummary, type WasteSummary } from '../../services/waste-records';

function PendingPanel({ label, compact = false }: { label: string; compact?: boolean }) {
  return (
    <div className={`sl-manager-reports-pending${compact ? ' compact' : ''}`}>
      <DataState
        kind="empty"
        title="No live records yet"
        description={`${label} will appear when reporting data is available.`}
      />
      <span className="sl-preview-badge">Preview · data pending</span>
    </div>
  );
}

function AdminReports() {
  const [ingredientTotal, setIngredientTotal] = useState<number | null>(null);
  const [ingredientTotalFailed, setIngredientTotalFailed] = useState(false);
  // Inventory value and batch totals come from the same authorized batch summary the Manager
  // Reports and Manager/Staff dashboards already read. Admin is an authorized reader of
  // `/inventory-batches/summary`, so these report figures are authoritative, not placeholders.
  const [inventorySummary, setInventorySummary] = useState<{ totalBatches: number; inventoryValue: number | null } | null>(null);
  const [inventorySummaryFailed, setInventorySummaryFailed] = useState(false);
  const [wasteSummary, setWasteSummary] = useState<WasteSummary | null>(null);
  const [wasteSummaryFailed, setWasteSummaryFailed] = useState(false);
  const { recentExports, recentExportsError, refreshRecentExports } = useRecentReportDownloads();
  async function handleExported() { await refreshRecentExports(); }
  useEffect(() => {
    const abort = new AbortController();
    setIngredientTotalFailed(false);
    listIngredients(1, 1, '', '', abort.signal)
      .then(result => { if (!abort.signal.aborted) setIngredientTotal(result.total); })
      .catch(() => { if (!abort.signal.aborted) setIngredientTotalFailed(true); });
    return () => abort.abort();
  }, []);
  useEffect(() => {
    const abort = new AbortController();
    setInventorySummaryFailed(false);
    getInventoryBatchSummary(abort.signal)
      .then(summary => { if (!abort.signal.aborted) setInventorySummary({ totalBatches: summary.totalBatches, inventoryValue: summary.inventoryValue }); })
      .catch(() => { if (!abort.signal.aborted) setInventorySummaryFailed(true); });
    return () => abort.abort();
  }, []);
  useEffect(() => {
    const abort = new AbortController();
    setWasteSummaryFailed(false);
    getWasteSummary(abort.signal)
      .then(summary => { if (!abort.signal.aborted) setWasteSummary(summary); })
      .catch(() => { if (!abort.signal.aborted) setWasteSummaryFailed(true); });
    return () => abort.abort();
  }, []);
  useEffect(() => {
    const controller = new AbortController();
    void refreshRecentExports(controller.signal);
    return () => controller.abort();
  }, []);
  const inventoryValueLabel = inventorySummary === null || inventorySummary.inventoryValue === null
    ? '—'
    : `₱${inventorySummary.inventoryValue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  return <div className="sl-admin-reports-page">
    <PageHeader eyebrow="Oversight" title="Reports" description="Generate and view reports on inventory, usage, waste, and ingredient data for your establishment." />
    <div className="sl-admin-view sl-admin-reports-v114">
      <section className="sl-sa-kpis sl-dashboard-source-kpis" aria-label="Cross-domain report summary">
        <article className="sl-sa-kpi" data-tone="brand"><span className="sl-sa-kpi-icon"><PhilippinePeso aria-hidden="true" /></span><div><span>Inventory Value</span><strong>{inventorySummaryFailed ? '—' : inventoryValueLabel}</strong><small>{inventorySummaryFailed ? 'Inventory valuation unavailable' : !inventorySummary ? 'Loading inventory valuation' : inventorySummary.inventoryValue === null ? 'Some batches lack authoritative unit cost' : 'Current authoritative inventory value'}</small></div></article>
        <article className="sl-sa-kpi" data-tone="info"><span className="sl-sa-kpi-icon"><Trash2 aria-hidden="true" /></span><div><span>Estimated Waste Cost</span><strong>{wasteSummaryFailed ? '—' : wasteSummary ? `₱${wasteSummary.totalWasteCostToday.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : '—'}</strong><small>{wasteSummaryFailed ? 'Waste-cost summary unavailable' : wasteSummary ? 'Authoritative waste cost recorded today' : 'Loading waste-cost summary'}</small></div></article>
        <article className="sl-sa-kpi" data-tone="attention"><span className="sl-sa-kpi-icon"><Leaf aria-hidden="true" /></span><div><span>Total Ingredients</span><strong>{ingredientTotalFailed ? '—' : ingredientTotal?.toLocaleString() ?? '—'}</strong><small>{ingredientTotalFailed ? 'Ingredient service unavailable' : ingredientTotal === null ? 'Loading ingredient records' : 'Ingredient catalogue total'}</small></div></article>
        <article className="sl-sa-kpi" data-tone="critical"><span className="sl-sa-kpi-icon"><ClipboardList aria-hidden="true" /></span><div><span>Total Batches</span><strong>{inventorySummaryFailed ? '—' : inventorySummary?.totalBatches.toLocaleString() ?? '—'}</strong><small>{inventorySummaryFailed ? 'Inventory batch service unavailable' : !inventorySummary ? 'Loading inventory batches' : 'Live inventory batch records'}</small></div></article>
      </section>

      <div className="sl-manager-reports-live">
        <ManagementReportDownloadCenter options={adminReportOptions} onExported={handleExported} />
        <ManagementReportRecentDownloads recentExports={recentExports} recentExportsError={recentExportsError} />
      </div>
    </div>
  </div>;
}

function SuperAdminReports() {
  const [reportDateRange, setReportDateRange] = useState('any');
  const [reportDateFrom, setReportDateFrom] = useState('');
  const [reportDateTo, setReportDateTo] = useState('');
  const [reportType, setReportType] = useState('All Report Types');
  const [reportIngredient, setReportIngredient] = useState('All Ingredients');

  const resetReportFilters = () => {
    setReportDateRange('any');
    setReportDateFrom('');
    setReportDateTo('');
    setReportType('All Report Types');
    setReportIngredient('All Ingredients');
  };

  return <>
    <PageHeader eyebrow="System Oversight" title="Reports" description="Waste, inventory, and forecast reporting for system-wide oversight." />
    <div className="sl-admin-view sl-sa-reports-page sl-sa-reports-superadmin-v288 sl-sa-batches-page sl-sa-ingredients-page sl-superadmin-dashboard-v49 sl-staff-usage-v150">
      <section className="sl-sa-kpis sl-inventory-staff-kpis sl-staff-usage-kpis sl-superadmin-dashboard-kpis-v201" aria-label="Reporting summary">
        <article className="sl-sa-kpi sl-inventory-staff-kpi" data-tone="brand"><span className="sl-sa-kpi-icon"><Package aria-hidden="true" /></span><div><span>Overstock Inventory Value</span><strong>—</strong><small>Awaiting overstock valuation API</small></div></article>
        <article className="sl-sa-kpi sl-inventory-staff-kpi" data-tone="info"><span className="sl-sa-kpi-icon"><Trash2 aria-hidden="true" /></span><div><span>Weekly Waste Cost</span><strong>—</strong><small>Awaiting waste-cost API</small></div></article>
        <article className="sl-sa-kpi sl-inventory-staff-kpi" data-tone="attention"><span className="sl-sa-kpi-icon"><TrendingUp aria-hidden="true" /></span><div><span>Forecast Accuracy</span><strong>—</strong><small>Awaiting forecast accuracy API</small></div></article>
        <article className="sl-sa-kpi sl-inventory-staff-kpi" data-tone="critical"><span className="sl-sa-kpi-icon"><AlertTriangle aria-hidden="true" /></span><div><span>30-Day Waste Value</span><strong>—</strong><small>Awaiting reporting summary API</small></div></article>
      </section>

      <div className="sl-sa-ingredients-table-filters sl-sa-reports-inventory-filters">
        <div className="sl-sa-ingredients-filter-card" aria-label="Report filters">
          <label className="sl-v203-filter-field sl-v219-date-range-field"><span>Date Range</span><FilterSelect ariaLabel="Report date range" value={reportDateRange} options={DATE_RANGE_OPTIONS.map(option => ({value: option.value, label: option.label}))} onChange={value => setReportDateRange(value as DateRangeValue)}/></label>
          <label><span>Report Type</span><FilterSelect ariaLabel="Filter reports by report type" value={reportType} options={[{value:'All Report Types',label:'All Report Types'}]} onChange={value => setReportType(value)}/></label>
          <label><span>Ingredient</span><FilterSelect ariaLabel="Filter reports by ingredient" value={reportIngredient} options={[{value:'All Ingredients',label:'All Ingredients'}]} onChange={value => setReportIngredient(value)}/></label>
          {reportDateRange === 'custom' && <div className="sl-v219-custom-date-range" aria-label="Custom report date range"><label className="sl-v203-filter-field"><span>From</span><input type="date" value={reportDateFrom} min="2020-01-01" max={reportDateTo || "2099-12-31"} onChange={event => setReportDateFrom(event.target.value)} /></label><label className="sl-v203-filter-field"><span>To</span><input type="date" value={reportDateTo} min={reportDateFrom || "2020-01-01"} max="2099-12-31" onChange={event => setReportDateTo(event.target.value)} /></label></div>}
          <div className="sl-sa-ingredients-filter-actions"><button className="sl-button" type="button" onClick={resetReportFilters}>Reset</button><ExportControl label="Export" menuId="sl-sa-reports-download-menu" /></div>
        </div>
      </div>

      <div className="sl-sa-reports-grid"><Card id="sl-weekly-waste-preview" title="Weekly Waste Cost"><PendingPanel label="Weekly waste cost"/></Card><Card id="sl-forecast-accuracy-preview" title="Forecast vs Actual Consumption"><PendingPanel label="Forecast vs actual consumption"/></Card></div><Card id="sl-high-waste-breakdown" title="High-Waste Breakdown"><PendingPanel label="High-waste ingredient breakdown"/></Card>
    </div>
  </>;
}

function LegacyReports() {
  return <><PageHeader eyebrow="System Oversight" title="Reports" description="Waste, inventory, and forecast reporting for system-wide oversight."/><div className="sl-admin-view sl-sa-reports-page sl-staff-usage-v150">
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
  if (user.role === 'Manager') return <ConnectedManagerReportsPage />;
  return <div className="sl-app sl-session-state"><h1 className="sl-page-title">Access Denied</h1><p className="sl-description">You do not have permission to access the reports workspace.</p></div>;
}
