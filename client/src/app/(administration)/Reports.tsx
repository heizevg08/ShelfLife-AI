import { AlertTriangle, CalendarDays, ClipboardList, Download, FileBarChart2, Leaf, Package, RotateCcw, Trash2, TrendingUp } from 'lucide-react';
import { useEffect, useState } from 'react';
import { ApplicationDonutChart, ApplicationLineChart } from '../../components/application/ApplicationPatterns';
import { Card, DataState, ExportControl, PageHeader, Pagination } from '../../components/application/primitives';
import { useApplicationWorkspace } from '../../components/application/ApplicationWorkspace';
import { workspaceNavigation } from '../../components/application/workspace';
import { listIngredients } from '../../services/ingredients';
import { DATE_RANGE_OPTIONS, DateRangeFilter, type DateRangeValue } from '../../components/application/DateRangeFilter';
import { Dialog } from '../../components/application/Dialog';
import { ConnectedManagerReportsPage } from '../../components/application/ManagerReportsPage';
import { FilterSelect } from '../../components/application/FilterSelect';

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
  const [dateRange, setDateRange] = useState<DateRangeValue>('any');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [reportType, setReportType] = useState('All Reports');
  const [ingredientTotal, setIngredientTotal] = useState<number | null>(null);
  const [ingredientTotalFailed, setIngredientTotalFailed] = useState(false);
  const [reportPage, setReportPage] = useState(1);
  const [reportPageSize, setReportPageSize] = useState(10);
  const reset = () => { setDateRange('any'); setDateFrom(''); setDateTo(''); setReportType('All Reports'); };
  useEffect(() => {
    const abort = new AbortController();
    setIngredientTotalFailed(false);
    listIngredients(1, 1, '', '', abort.signal)
      .then(result => { if (!abort.signal.aborted) setIngredientTotal(result.total); })
      .catch(() => { if (!abort.signal.aborted) setIngredientTotalFailed(true); });
    return () => abort.abort();
  }, []);
  const reports = workspaceNavigation('Admin')
    .filter(item => item.path !== '/Reports')
    .map(item => ({ name: `${item.label} Report`, type: item.label, path: item.path }));
  const reportTypes = [...new Set(reports.map(report => report.type))];
  const visibleReports = reports.filter(report => reportType === 'All Reports' || report.type === reportType);
  return <div className="sl-admin-reports-page">
    <PageHeader eyebrow="Oversight" title="Reports" description="Generate and view reports on inventory, usage, waste, and ingredient data for your establishment." />
    <div className="sl-admin-view sl-admin-reports-v114">
      <section className="sl-sa-kpis sl-inventory-staff-kpis sl-staff-usage-kpis sl-superadmin-dashboard-kpis-v201 sl-dashboard-kpis" aria-label="Report summary">
        <article className="sl-sa-kpi sl-inventory-staff-kpi" data-tone="brand"><span className="sl-sa-kpi-icon"><Package/></span><div><span>Total Inventory Value</span><strong>—</strong><small>Data unavailable</small></div></article>
        <article className="sl-sa-kpi sl-inventory-staff-kpi" data-tone="info"><span className="sl-sa-kpi-icon"><Trash2/></span><div><span>Total Waste Cost</span><strong>—</strong><small>Data unavailable</small></div></article>
        <article className="sl-sa-kpi sl-inventory-staff-kpi" data-tone="attention"><span className="sl-sa-kpi-icon"><Leaf/></span><div><span>Total Ingredients</span><strong>{ingredientTotal?.toLocaleString() ?? '—'}</strong><small>{ingredientTotalFailed ? 'Ingredient service unavailable' : ingredientTotal === null ? 'Loading ingredient records' : 'Ingredient catalogue total'}</small></div></article>
        <article className="sl-sa-kpi sl-inventory-staff-kpi" data-tone="critical"><span className="sl-sa-kpi-icon"><ClipboardList/></span><div><span>Total Batches</span><strong>—</strong><small>Data unavailable</small></div></article>
      </section>

      <section className="sl-application-records sl-application-records-overflow sl-admin-report-records" aria-labelledby="sl-admin-available-reports">
        <header className="sl-application-records-header"><span className="sl-application-records-icon"><FileBarChart2 aria-hidden="true" /></span><h2 id="sl-admin-available-reports">Available Reports</h2></header>
        <div className="sl-application-records-filters"><div className="sl-application-records-toolbar sl-admin-reports-filters" data-layout="reports" aria-label="Report filters">
          <DateRangeFilter value={dateRange} from={dateFrom} to={dateTo} onChange={value => { setDateRange(value); setReportPage(1); }} onFromChange={setDateFrom} onToChange={setDateTo} />
          <label><span>Report Type</span><FilterSelect ariaLabel="Filter reports by type" value={reportType} options={[{value:'All Reports',label:'All Reports'},...reportTypes.map(value => ({value, label: value}))]} onChange={value => { setReportType(value); setReportPage(1); }}/></label>
          <div className="sl-application-records-filter-actions"><button className="sl-button sl-admin-reports-reset" type="button" onClick={() => { reset(); setReportPage(1); }}><RotateCcw size={14}/> Reset</button><ExportControl label="Export" menuId="sl-admin-reports-export-menu" /></div>
        </div></div>
        <div className="sl-application-records-table-shell">
          <table className="sl-application-records-table" data-layout="reports" aria-label="Available reports">
            <thead><tr><th scope="col">#</th><th scope="col">Report</th><th scope="col">Type</th><th scope="col">Last Generated</th></tr></thead>
            <tbody>{visibleReports.map((report, index) => <tr key={report.path}><td>{index + 1}</td><td><span className="sl-emphasized-value sl-admin-report-name">{report.name}</span></td><td><span className="sl-emphasized-value" data-category={report.type}>{report.type}</span></td><td>—</td></tr>)}</tbody>
          </table>
        </div>
        <footer className="sl-application-records-footer"><label><span>Rows per page</span><select value={reportPageSize} onChange={event => { setReportPageSize(Number(event.target.value)); setReportPage(1); }}><option>10</option><option>25</option><option>50</option></select></label><Pagination compact page={reportPage} pageSize={reportPageSize} total={visibleReports.length} itemLabel="reports" onPageChange={setReportPage} /></footer>
      </section>
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
          {reportDateRange === 'custom' && <div className="sl-v219-custom-date-range" aria-label="Custom report date range"><label className="sl-v203-filter-field"><span>From</span><input type="date" value={reportDateFrom} max={reportDateTo || undefined} onChange={event => setReportDateFrom(event.target.value)} /></label><label className="sl-v203-filter-field"><span>To</span><input type="date" value={reportDateTo} min={reportDateFrom || undefined} onChange={event => setReportDateTo(event.target.value)} /></label></div>}
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
  if (user.role === 'Super Admin') return <SuperAdminReports />;
  return <LegacyReports />;
}
