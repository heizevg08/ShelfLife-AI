import { useEffect, useState } from 'react';
import { AlertTriangle, PhilippinePeso, Trash2, TrendingUp } from 'lucide-react';
import { getInventoryBatchSummary, type InventoryBatchSummary } from '../../services/inventory-batches';
import { getWasteSummary, type WasteSummary } from '../../services/waste-records';
import { DataState, ExportControl, PageHeader } from './primitives';
import { FilterSelect, type FilterSelectOption } from './FilterSelect';
import { businessDayRange, businessWeekRange } from '../../utils/business-day';
import { downloadCombinedReport, downloadReportXlsx, getMyRecentExports, type OperationalReportId, type RecentExport } from '../../services/report-exports';
import { formatDate, formatDateTime, isValidDateOnlyInput } from '../../utils/date-time';
import { formatCompactPeso, formatExactPeso } from '../../utils/compact-number';
import { ApiError } from '../../services/apiClient';
import { getGeneralForecastAccuracy, type ForecastAccuracyResponse } from '../../services/ingredients';

const periods = ['This Week', 'Last 7 Days', 'Last 30 Days', 'Last 90 Days', 'Custom'] as const;
type ReportSelection = OperationalReportId | 'all';
export const adminReportOptions: FilterSelectOption[] = [
  { value: 'all', label: 'All reports' },
  { value: 'inventory-summary', label: 'Inventory Summary' },
  { value: 'usage-consumption', label: 'Usage & Consumption' },
  { value: 'expiration-waste', label: 'Expiration & Waste' },
];
const reportOptions: FilterSelectOption[] = [
  ...adminReportOptions,
  { value: 'demand-forecast', label: 'Demand Forecast' },
  { value: 'forecast-vs-actual', label: 'Forecast vs. Actual' },
  { value: 'forecast-accuracy', label: 'Forecast Accuracy' },
  { value: 'expiration-risk', label: 'Expiration Risk' },
  { value: 'ai-insights-recommendations', label: 'AI Insights & Recommendations' },
];
type Period = typeof periods[number];
function reportWindow(period: Period, from: string, to: string) {
  if (period === 'Custom') {
    if (!isValidDateOnlyInput(from) || !isValidDateOnlyInput(to)) return null;
    const days = Math.round((Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / 86_400_000) + 1;
    return days >= 1 && days <= 90 ? { from, to } : null;
  }
  return period === 'This Week' ? businessWeekRange() : businessDayRange(period === 'Last 7 Days' ? 7 : period === 'Last 30 Days' ? 30 : 90);
}
export function ManagementReportDownloadCenter({ options = reportOptions, onExported }: { options?: FilterSelectOption[]; onExported?: () => void | Promise<void> } = {}) {
  const [period, setPeriod] = useState<Period>('This Week');
  const [selectedReport, setSelectedReport] = useState<ReportSelection>('all');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [exportError, setExportError] = useState('');
  const [exporting, setExporting] = useState(false);
  const range = reportWindow(period, from, to);
  async function exportSelected() {
    if (!range) return;
    setExporting(true); setExportError('');
    try {
      if (selectedReport === 'all') await downloadCombinedReport(range);
      else await downloadReportXlsx(selectedReport, selectedReport === 'inventory-summary' ? null : range);
      await onExported?.();
    }
    catch (error) {
      const status = error instanceof ApiError ? error.status : undefined;
      setExportError(status === 401 || status === 403
        ? 'You cannot download reports with the current account.'
        : status === 413
          ? 'This report has more than 5,000 rows in a section. Choose a shorter period.'
          : status === 400
            ? 'The selected report or date range is invalid. Check the filters and try again.'
            : status === 404
              ? 'The report download endpoint is unavailable. Restart the server and try again.'
              : status === 500
                ? 'The server could not prepare this workbook. Try again; if it continues, check the server logs.'
                : 'Could not reach the report service. Check the server connection and try again.');
    }
    finally { setExporting(false); }
  }
  function resetDownloadCenter() {
    setPeriod('This Week'); setSelectedReport('all'); setFrom(''); setTo(''); setExportError('');
  }
  return <section className="sl-manager-operational-reports sl-manager-download-center" aria-labelledby="operational-reports-title">
    <header><h2 id="operational-reports-title">Management Report Download Center</h2></header>
    <div className="sl-manager-download-controls" data-custom={period === 'Custom'}>
      <label><span>Date Range</span><FilterSelect ariaLabel="Choose date range" value={period} options={periods.map(value => ({ value, label: value }))} onChange={value => { setPeriod(value as Period); setFrom(''); setTo(''); setExportError(''); }} /></label>
      <label><span>Report</span><FilterSelect ariaLabel="Choose report" value={selectedReport} options={options} onChange={value => setSelectedReport(value as ReportSelection)} /></label>
      {period === 'Custom' && <><label><span>From</span><input type="date" value={from} min="2020-01-01" max={to || "2099-12-31"} onChange={event => setFrom(event.target.value)} /></label><label><span>To</span><input type="date" value={to} min={from || "2020-01-01"} max="2099-12-31" onChange={event => setTo(event.target.value)} /></label></>}
      <div className="sl-manager-download-actions">
        <button className="sl-button" type="button" disabled={exporting} onClick={resetDownloadCenter}>Reset</button>
        <ExportControl available disabled={!range} loading={exporting} onExport={exportSelected} />
      </div>
    </div>
    {!range && <p role="status">Choose a period of 1 to 90 days.</p>}
    {exportError && <p role="alert">{exportError}</p>}
  </section>;
}

export function useRecentReportDownloads() {
  const [recentExports, setRecentExports] = useState<RecentExport[] | null>(null);
  const [recentExportsError, setRecentExportsError] = useState(false);
  async function refreshRecentExports(signal?: AbortSignal) {
    try {
      const result = await getMyRecentExports(signal);
      setRecentExports(result.items.filter(item => item.format === 'xlsx').slice(0, 5));
      setRecentExportsError(false);
    } catch (error) {
      if ((error as Error).name !== 'AbortError') setRecentExportsError(true);
    }
  }
  return { recentExports, recentExportsError, refreshRecentExports };
}

export function ManagementReportRecentDownloads({ recentExports, recentExportsError }: { recentExports: RecentExport[] | null; recentExportsError: boolean }) {
  return <section className="sl-application-records sl-manager-recent-downloads" aria-labelledby="recent-downloads-title">
    <header className="sl-application-records-header"><h2 id="recent-downloads-title">Recent downloads</h2></header>
    <div className="sl-manager-recent-downloads-table-shell sl-application-records-table-shell">
      <table className="sl-manager-recent-downloads-table sl-application-records-table sl-records-table sl-data-table"><thead><tr><th scope="col">REPORT</th><th scope="col">PERIOD</th><th scope="col">CREATED ON</th></tr></thead><tbody>
        {recentExportsError ? <tr><td colSpan={3} className="sl-empty-cell"><DataState kind="error" title="Recent downloads unavailable" description="Your report history could not be loaded." /></td></tr>
          : recentExports === null ? <tr><td colSpan={3} className="sl-empty-cell"><DataState kind="loading" title="Loading recent downloads" description="Retrieving your report history." /></td></tr>
          : recentExports.length === 0 ? <tr><td colSpan={3} className="sl-empty-cell"><DataState kind="empty" title="No recent downloads" description="" /></td></tr>
          : recentExports.map((item, index) => {
            const label = item.reportId === 'management-workbook' ? 'All reports' : reportOptions.find(option => option.value === item.reportId)?.label ?? 'Unavailable report';
            const timestamp = new Date(item.exportedAt);
            const preparationDate = Number.isNaN(timestamp.valueOf()) ? 'Unavailable' : formatDate(timestamp);
            const periodLabel = item.reportId === 'inventory-summary' && (!item.periodFrom || !item.periodTo)
              ? preparationDate === 'Unavailable' ? preparationDate : `As of ${preparationDate}`
              : item.periodFrom && item.periodTo ? `${formatDate(item.periodFrom)} – ${formatDate(item.periodTo)}` : 'Unavailable';
            const dateLabel = Number.isNaN(timestamp.valueOf()) ? 'Unavailable' : formatDateTime(timestamp);
            return <tr key={`${item.exportedAt}-${item.reportId}-${index}`}><td>{label} (XLSX)</td><td>{periodLabel}</td><td>{dateLabel}</td></tr>;
          })}
      </tbody></table>
    </div>
  </section>;
}

export function ConnectedManagerReportsPage() {
  const [inventory, setInventory] = useState<InventoryBatchSummary | null>(null);
  const [waste, setWaste] = useState<WasteSummary | null>(null);
  const [inventoryError, setInventoryError] = useState(false);
  const [wasteError, setWasteError] = useState(false);
  const [accuracy, setAccuracy] = useState<ForecastAccuracyResponse | null>(null);
  const [accuracyError, setAccuracyError] = useState(false);
  const { recentExports, recentExportsError, refreshRecentExports } = useRecentReportDownloads();
  async function handleExported() { await refreshRecentExports(); }
  useEffect(() => {
    const controller = new AbortController();
    getInventoryBatchSummary(controller.signal).then(setInventory).catch(error => { if ((error as Error).name !== 'AbortError') setInventoryError(true); });
    getWasteSummary(controller.signal).then(setWaste).catch(error => { if ((error as Error).name !== 'AbortError') setWasteError(true); });
    getGeneralForecastAccuracy(controller.signal).then(setAccuracy).catch(error => { if ((error as Error).name !== 'AbortError') setAccuracyError(true); });
    void refreshRecentExports(controller.signal);
    return () => controller.abort();
  }, []);
  // A missing authoritative unit cost makes the whole valuation unavailable rather than
  // silently reporting a partial total that a Manager could mistake for the real figure.
  const inventoryAmount = inventory?.inventoryValue;
  const wasteAmount = waste?.totalWasteCostToday;
  return <><PageHeader eyebrow="Intelligence" title="Reports & Analytics" />
    <div className="sl-admin-view sl-manager-reports-v139 sl-manager-reports-live">
      <section className="sl-sa-kpis sl-dashboard-source-kpis" aria-label="Cross-domain analytics summary">
        <article className="sl-sa-kpi" data-tone="brand"><span className="sl-sa-kpi-icon"><PhilippinePeso/></span><div><span>Inventory Value</span><strong title={inventoryAmount !== null && inventoryAmount !== undefined && Number.isFinite(inventoryAmount) ? formatExactPeso(inventoryAmount) : undefined}>{inventoryError || inventoryAmount === null || inventoryAmount === undefined || !Number.isFinite(inventoryAmount) ? '—' : formatCompactPeso(inventoryAmount)}</strong><small>{inventoryError?'Value unavailable':!inventory?'Loading value':inventory.inventoryValue===null?'Unit cost unavailable':'Stock valued at unit cost'}</small></div></article>
        <article className="sl-sa-kpi" data-tone="info"><span className="sl-sa-kpi-icon"><AlertTriangle/></span><div><span>Near-Expiry Batches</span><strong>{inventoryError?'—':inventory?.nearExpiry??'—'}</strong><small>{inventoryError?'Expiry data unavailable':inventory?'Expiring within 7 days':'Loading expiry data'}</small></div></article>
        <article className="sl-sa-kpi" data-tone="attention"><span className="sl-sa-kpi-icon"><Trash2/></span><div><span>Estimated Waste Cost</span><strong title={wasteAmount !== undefined && Number.isFinite(wasteAmount) ? formatExactPeso(wasteAmount) : undefined}>{wasteError || wasteAmount === undefined || !Number.isFinite(wasteAmount) ? '—' : formatCompactPeso(wasteAmount)}</strong><small>{wasteError?'Waste cost unavailable':waste?'Waste cost today':'Loading waste cost'}</small></div></article>
        <article className="sl-sa-kpi" data-tone="critical"><span className="sl-sa-kpi-icon"><TrendingUp/></span><div><span>Forecast Accuracy</span>{accuracy?.status === 'AVAILABLE' && accuracy.metrics.accuracyScore !== null ? <><strong>{accuracy.metrics.accuracyScore}%</strong><small>{accuracy.metrics.evaluatedDays} days evaluated</small></> : accuracy?.status === 'UNAVAILABLE' ? <><strong>—</strong><small>{accuracy.evaluatedDays}/{accuracy.minimumRequiredDays} days evaluated</small></> : <><strong>{accuracyError ? '—' : '…'}</strong><small>{accuracyError ? 'Forecast unavailable' : 'Loading forecast'}</small></>}</div></article>
      </section>
      <ManagementReportDownloadCenter onExported={handleExported} />
      <ManagementReportRecentDownloads recentExports={recentExports} recentExportsError={recentExportsError} />
    </div>
  </>;
}
