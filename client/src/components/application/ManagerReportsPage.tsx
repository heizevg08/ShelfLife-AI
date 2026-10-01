import { useEffect, useRef, useState } from 'react';
import { BarChart3, FileBarChart2, PieChart, Trash2, TrendingUp } from 'lucide-react';
import { ApplicationPendingState } from './ApplicationPatterns';
import { Card, PageHeader } from './primitives';
import { Dialog } from './Dialog';
import { getUsageSummary, type UsageSummary } from '../../services/usage-records';
import { getWasteSummary, type WasteSummary } from '../../services/waste-records';

const REPORTS = [
  ['Inventory Summary', 'Stock levels, current inventory, and expiration context'],
  ['Usage & Waste Report', 'Ingredient usage, waste events, and waste cost'],
  ['Expiration Risk Report', 'Upcoming expirations and FEFO priority'],
  ['Forecast vs. Actual Report', 'Forecast comparison with recorded demand'],
  ['Category Analysis', 'Cross-domain activity by ingredient category'],
] as const;

export function ConnectedManagerReportsPage() {
  const trigger = useRef<HTMLButtonElement>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const [usageSummary, setUsageSummary] = useState<UsageSummary | null>(null);
  const [wasteSummary, setWasteSummary] = useState<WasteSummary | null>(null);
  const [summaryError, setSummaryError] = useState(false);
  const [range, setRange] = useState('Last 30 Days'); const [from, setFrom] = useState(''); const [to, setTo] = useState(''); const [format, setFormat] = useState('PDF');
  const analytics = [
    ['manager-reports-movement', 'Inventory Movement Trend', 'Inventory movement trends'],
    ['manager-reports-expiration-risk', 'Expiration Risk Distribution', 'Expiration risk distribution'],
    ['manager-reports-usage-waste', 'Usage & Waste Overview', 'Usage and waste analytics'],
  ] as const;
  useEffect(() => { const controller = new AbortController(); Promise.all([getUsageSummary(controller.signal), getWasteSummary(controller.signal)]).then(([usage, waste]) => { setUsageSummary(usage); setWasteSummary(waste); setSummaryError(false); }).catch(() => { if (!controller.signal.aborted) setSummaryError(true); }); return () => controller.abort(); }, []);
  const usageValue = usageSummary?.totalUsageToday ? `${usageSummary.totalUsageToday.quantity.toLocaleString()} ${usageSummary.totalUsageToday.unit}` : usageSummary?.usageRecordsToday === 0 ? '0' : '—';
  const wasteValue = wasteSummary?.totalWasteToday ? `${wasteSummary.totalWasteToday.quantity.toLocaleString()} ${wasteSummary.totalWasteToday.unit}` : wasteSummary?.wasteRecordsToday === 0 ? '0' : '—';
  return <><PageHeader eyebrow="Intelligence" title="Reports & Analytics" description="Generate and export consolidated inventory, usage, waste, expiration, and forecasting reports." />
    <div className="sl-admin-view sl-manager-reports-v139 sl-manager-reports-live"><section className="sl-sa-kpis sl-kpi-reference-v201"><article className="sl-sa-kpi" data-tone="brand"><span className="sl-sa-kpi-icon"><BarChart3/></span><div><span>Total Ingredients Used</span><strong>{summaryError ? '—' : usageValue}</strong><small>{summaryError ? 'Usage summary unavailable' : !usageSummary ? 'Loading usage summary' : usageSummary.usageRecordsToday && !usageSummary.totalUsageToday ? 'Multiple units cannot be combined' : 'Usage quantity recorded today'}</small></div></article><article className="sl-sa-kpi" data-tone="info"><span className="sl-sa-kpi-icon"><Trash2/></span><div><span>Total Waste</span><strong>{summaryError ? '—' : wasteValue}</strong><small>{summaryError ? 'Waste summary unavailable' : !wasteSummary ? 'Loading waste summary' : wasteSummary.wasteRecordsToday && !wasteSummary.totalWasteToday ? 'Multiple units cannot be combined' : 'Waste quantity recorded today'}</small></div></article><article className="sl-sa-kpi" data-tone="attention"><span className="sl-sa-kpi-icon"><PieChart/></span><div><span>Waste Rate</span><strong>—</strong><small>No authoritative compatible-unit rate available</small></div></article><article className="sl-sa-kpi" data-tone="critical"><span className="sl-sa-kpi-icon"><TrendingUp/></span><div><span>Forecast Accuracy</span><strong>—</strong><small>Forecasting service not implemented</small></div></article></section>
      <section className="sl-manager-reports-three" aria-label="Cross-domain analytics">{analytics.map(([id, title, description]) => <Card id={id} key={id} title={title}><ApplicationPendingState description={`${description} will appear when reporting data is available.`}/></Card>)}</section>
      <section className="sl-manager-reports-bottom"><Card id="manager-reports-available" title={<span className="sl-dashboard-card-heading"><span className="sl-staff-usage-head-icon"><FileBarChart2/></span><span>Available Reports</span></span>}><div className="sl-application-records-table-shell sl-manager-reports-table-scroll"><table className="sl-application-records-table sl-data-table sl-manager-reports-table" aria-label="Available reports"><colgroup><col/><col/><col/><col/></colgroup><thead><tr><th>Report</th><th>Description</th><th>Format</th><th>Action</th></tr></thead><tbody>{REPORTS.map(([name, description]) => <tr key={name}><td><span className="sl-manager-report-name"><i><FileBarChart2 size={15}/></i>{name}</span></td><td>{description}</td><td className="sl-manager-report-muted">PDF / Excel when available</td><td className="sl-application-row-actions"><button ref={selected === name ? trigger : undefined} className="sl-button sl-button-compact" type="button" onClick={event => { trigger.current = event.currentTarget; setSelected(name); }}>Generate</button></td></tr>)}</tbody></table></div></Card></section>
    </div>
    <Dialog open={selected !== null} showClose={false} title={<span className="sl-account-dialog-heading"><span className="sl-account-dialog-icon"><FileBarChart2 size={18}/></span><span><span className="sl-account-dialog-title">Generate {selected ?? 'Report'}</span><small>Choose the reporting period and export format.</small></span></span>} className="sl-add-user-dialog sl-account-reference-dialog sl-application-modal" onDismiss={() => setSelected(null)} returnFocus={trigger} actions={<><button className="sl-button" type="button" onClick={() => setSelected(null)}>Cancel</button><button className="sl-button sl-button-primary" type="button" disabled title="Report generation service is not connected">Generate Report</button></>}><div className="sl-manager-report-form sl-application-modal-content"><label><span>Date Range</span><select value={range} onChange={event => setRange(event.target.value)}><option>Last 7 Days</option><option>Last 30 Days</option><option>Last 90 Days</option><option>Custom range</option></select></label>{range === 'Custom range' && <div className="sl-v219-custom-date-range"><label><span>From</span><input type="date" value={from} onChange={event => setFrom(event.target.value)}/></label><label><span>To</span><input type="date" value={to} onChange={event => setTo(event.target.value)}/></label></div>}<label><span>Format</span><select value={format} onChange={event => setFormat(event.target.value)}><option>PDF</option><option>Excel</option></select></label><ApplicationPendingState description="Report generation will become available when the reporting service supports this report and format."/></div></Dialog>
  </>;
}
