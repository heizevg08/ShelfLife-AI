import { useEffect, useRef, useState } from 'react';
import { BarChart3, Eye, FileInput, Leaf, Plus, RefreshCw, Search, Trash2, TrendingUp } from 'lucide-react';
import { INGREDIENT_CATEGORIES, listStockInIngredients, type StockInIngredient } from '../../services/ingredients';
import { getUsageAnalytics, getUsageSummary, listUsageRecords, type UsageAnalytics, type UsageRecord, type UsageSummary } from '../../services/usage-records';
import { getWasteAnalytics, getWasteSummary, listWasteRecords, type WasteAnalytics, type WasteReason, type WasteRecord, type WasteSummary } from '../../services/waste-records';
import { formatDate } from '../../utils/date-time';
import { businessDateInputValue, businessDayRange, businessMonthRange, businessWeekRange } from '../../utils/business-day';
import { formatHumanReadableText } from '../../utils/display-text';
import { formatCompactNumber, formatCompactPeso, formatExactPeso } from '../../utils/compact-number';
import { ApplicationDetailsDialog } from './ApplicationDetailsDialog';
import { ApplicationBarBreakdown } from './ApplicationPatterns';
import { dailyRecordPoints, ManagerDailyRecordChart, ManagerDailyRecordLegend, type DailySeries } from './ManagerDailyRecordChart';
import { biggestWasteCause, dailyPeakInsight, insightEmphasisSegments, wasteGuidance, wasteRecordCount, zeroWasteReasonNames } from './manager-usage-insights';
import { collectRecordPages } from './manager-record-pages';
import { activityDateMatches, customRangeFieldInvalid, customRangeState, earliestActivityDate } from './manager-record-date-range';
import { FilterSelect } from './FilterSelect';
import { InventoryStaffAddButton } from './InventoryStaffModal';
import { InventoryStaffBulkModal } from './InventoryStaffBulkModal';
import { DataState, PageHeader, Pagination } from './primitives';
import { formatTopbarDateTime } from '../../utils/date-time';

const PAGE_SIZES = [10, 15, 50, 100, 150] as const;
const WASTE_REASONS: WasteReason[] = ['Expired', 'Spoiled', 'Damaged', 'Over-prepared', 'Other'];
// Each analytics card owns its own reporting period, and the records table owns a
// third. They are deliberately not linked: a Manager reads a week of trend on one
// card while looking at the current month of reasons on the other, and the detailed
// ledger keeps its own range. No control clears, detaches or overwrites another.
const ANALYTICS_PERIODS = [{ label: 'Today', value: 'Today' }, { label: 'Weekly', value: 'Weekly' }, { label: 'Monthly', value: 'Monthly' }] as const;
// Five minutes is a reporting interval, not a business rule: fresh enough that a Manager
// watching the screen sees new activity without reloading the page, and slow enough that
// the analytics endpoint is not polled needlessly. It refreshes figures only; it never
// retrains a model, regenerates a forecast, or touches a stored record.
const ANALYTICS_REFRESH_MS = 5 * 60 * 1000;
// One place maps a period onto its Philippine calendar boundaries, so both cards
// and the insights describe exactly the same window.
function analyticsQueryPeriod(value: string) {
  return value === 'Today' ? businessDayRange(1) : value === 'Weekly' ? businessWeekRange() : businessMonthRange();
}
// A dropdown, not a segmented group of buttons: the card header has to hold the title,
// the freshness line, both legend entries and the period control on one row, and three
// always-visible buttons crowd that row at tablet width.
function ManagerAnalyticsPeriod({ value, onSelect, ariaLabel }: { value: string; onSelect: (range: string) => void; ariaLabel: string }) {
  return <FilterSelect className="sl-manager-analytics-period" ariaLabel={ariaLabel} value={value} options={ANALYTICS_PERIODS.map(period => ({ value: period.value, label: period.label }))} onChange={onSelect} />;
}
function ManagerInsightText({ text, anchors }: { text: string; anchors: readonly string[] }) {
  return <>{insightEmphasisSegments(text, anchors).map((part, index) => part.emphasized
    ? <strong className="sl-emphasized-value" key={index}>{part.text}</strong>
    : part.text)}</>;
}
type CombinedRecord = { id: string; createdAt: string; operationalDate: string; ingredient: { id: string; name: string }; batch: { batchID: string }; type: 'Usage' | 'Waste'; quantity: number; unit: string; notes: string; recordedBy: { name: string; firstName?: string; lastName?: string } };

export function ConnectedManagerUsageWastePage() {
  const usageTrigger = useRef<HTMLButtonElement>(null); const wasteTrigger = useRef<HTMLButtonElement>(null);
  const detailTrigger = useRef<HTMLButtonElement>(null);
  const [records, setRecords] = useState<CombinedRecord[] | null>(null); const [usageSummary, setUsageSummary] = useState<UsageSummary | null>(null); const [wasteSummary, setWasteSummary] = useState<WasteSummary | null>(null); const [failed, setFailed] = useState(false);
  const [analyticsRevision, setAnalyticsRevision] = useState(0);
  const [usageAnalytics, setUsageAnalytics] = useState<UsageAnalytics | null>(null); const [wasteAnalytics, setWasteAnalytics] = useState<WasteAnalytics | null>(null); const [analyticsFailed, setAnalyticsFailed] = useState(false);
  const [reasonAnalytics, setReasonAnalytics] = useState<WasteAnalytics | null>(null); const [reasonFailed, setReasonFailed] = useState(false);
  const [ingredients, setIngredients] = useState<StockInIngredient[]>([]);
  // Each analytics card selects its own Philippine period, and the records table keeps
  // a third, independent date filter. No control clears, detaches or overwrites another.
  const [usagePeriod, setUsagePeriod] = useState('Weekly');
  const [wastePeriod, setWastePeriod] = useState('Weekly');
  // The freshness label reports the last successful analytics fetch, never the
  // newest record's createdAt: a quiet morning produces no new records but the
  // figures on screen are still freshly retrieved. It stays null while loading and
  // is cleared on failure, so the label can never claim a refresh that did not happen.
  const [analyticsUpdatedAt, setAnalyticsUpdatedAt] = useState<Date | null>(null);
  // Set only when a silent background refresh fails. The cards keep the last good figures
  // and the freshness line says so, so nothing on screen claims a refresh that did not happen.
  // Tracked per card, so a card whose figures are stale never rides on the other card's success.
  const [chartStale, setChartStale] = useState(false);
  const [reasonStale, setReasonStale] = useState(false);
  // A guard per card: the sequence number of the newest request that was started. A
  // background refresh must not blank the chart, and a slow reply must not overwrite a
  // newer one that already landed.
  const chartSeqRef = useRef(0);
  const reasonSeqRef = useRef(0);
  // When the analytics figures were last successfully retrieved, used to decide whether
  // a returning tab is already due for a refresh. Never shown, so it cannot mislead.
  const lastAnalyticsFetchRef = useRef(0);
  // Both series start visible, so the default chart is the complete comparison.
  const [visibleSeries, setVisibleSeries] = useState<Record<DailySeries, boolean>>({ usage: true, waste: true });
  const [range, setRange] = useState('All dates');
  const [search, setSearch] = useState(''); const [from, setFrom] = useState(''); const [to, setTo] = useState(''); const [category, setCategory] = useState(''); const [ingredientFilter, setIngredientFilter] = useState(''); const [page, setPage] = useState(1); const [rows, setRows] = useState(10);
  const [detail, setDetail] = useState<CombinedRecord | null>(null);
  const [usageOpen, setUsageOpen] = useState(false); const [wasteOpen, setWasteOpen] = useState(false);
  const load = (signal?: AbortSignal) => Promise.all([collectRecordPages(page => listUsageRecords({ page, pageSize: 150 }, signal), item => item.id), collectRecordPages(page => listWasteRecords({ page, pageSize: 150 }, signal), item => item.id), getUsageSummary(signal), getWasteSummary(signal), listStockInIngredients(signal)])
    .then(([usage, waste, nextUsageSummary, nextWasteSummary, options]) => {
      const combined: CombinedRecord[] = [
        ...usage.map((item: UsageRecord) => ({ id: `usage-${item.id}`, createdAt: item.createdAt, operationalDate: item.dateUsed, ingredient: item.ingredient, batch: item.batch, type: 'Usage' as const, quantity: item.quantityUsed, unit: item.unit, notes: 'Usage recorded', recordedBy: item.recordedBy })),
        ...waste.map((item: WasteRecord) => ({ id: `waste-${item.id}`, createdAt: item.createdAt, operationalDate: item.dateWasted, ingredient: item.ingredient, batch: item.batch, type: 'Waste' as const, quantity: item.quantityWasted, unit: item.unit, notes: item.reason, recordedBy: item.recordedBy })),
      ].sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt));
      // The earliest selectable Activity Date is read from every page of this
      // role-authorized ledger, so it cannot come from a partial page or an
      // arbitrary cap. The view keeps the last complete ledger on a failed
      // refresh instead of discarding it or inventing a boundary.
      setRecords(combined); setUsageSummary(nextUsageSummary); setWasteSummary(nextWasteSummary); setIngredients(options.ingredients); setFailed(false);
    }).catch(error => { if ((error as Error).name !== 'AbortError') setFailed(true); });
    useEffect(() => { const controller = new AbortController(); void load(controller.signal); return () => controller.abort(); }, []);
  // Both charts and their insights use one server-aggregated analytics period;
  // the table date range and free-text lookup stay independent.
  // One loader per card. `silent` marks a background refresh: it keeps the figures already
  // on screen, the legend state and the chosen period untouched, and reports a failure as
  // staleness instead of blanking a chart the Manager may be reading at that moment.
  const loadChartAnalytics = (signal: AbortSignal, silent: boolean) => {
    const query = { ...analyticsQueryPeriod(usagePeriod), ingredientId: ingredientFilter || undefined, category: category || undefined };
    const seq = ++chartSeqRef.current;
    if (!silent) { setUsageAnalytics(null); setWasteAnalytics(null); setAnalyticsFailed(false); }
    return Promise.all([getUsageAnalytics(query, signal), getWasteAnalytics(query, signal)])
      .then(([nextUsage, nextWaste]) => {
        // A reply from an older request is discarded instead of overwriting newer figures.
        if (seq !== chartSeqRef.current) return;
        setUsageAnalytics(nextUsage); setWasteAnalytics(nextWaste); setAnalyticsFailed(false);
        setChartStale(false); setAnalyticsUpdatedAt(new Date()); lastAnalyticsFetchRef.current = Date.now();
      })
      .catch(error => {
        if ((error as Error).name === 'AbortError' || seq !== chartSeqRef.current) return;
        if (silent) setChartStale(true);
        else { setAnalyticsFailed(true); setAnalyticsUpdatedAt(null); }
      });
  };
  const loadReasonAnalytics = (signal: AbortSignal, silent: boolean) => {
    const query = { ...analyticsQueryPeriod(wastePeriod), ingredientId: ingredientFilter || undefined, category: category || undefined };
    const seq = ++reasonSeqRef.current;
    if (!silent) setReasonAnalytics(null);
    return getWasteAnalytics(query, signal)
      .then(next => {
        if (seq !== reasonSeqRef.current) return;
        setReasonAnalytics(next); setReasonFailed(false); setReasonStale(false);
      })
      // A silent failure keeps the bars already on screen and marks the card stale. Only a
      // first, non-silent load may report an error: blanking a card mid-read would hide the
      // very figures the Manager is looking at while the other card still shows its own.
      .catch(error => {
        if ((error as Error).name === 'AbortError' || seq !== reasonSeqRef.current) return;
        if (silent) setReasonStale(true);
        else setReasonFailed(true);
      });
  };
  // The loaders are recreated on every render because they read the current periods. The
  // timer keeps them in a ref so one interval, created once, always calls the newest ones
  // instead of capturing a stale period and quietly refreshing the wrong window.
  const inFlightRef = useRef({ chart: false, reason: false });
  const loadersRef = useRef({ chart: loadChartAnalytics, reason: loadReasonAnalytics });
  loadersRef.current = { chart: loadChartAnalytics, reason: loadReasonAnalytics };
  // Each card loads on its own period, so changing one card's period never re-requests the
  // other card's data. Category and ingredient are shared inputs, so both reload with them;
  // analyticsRevision is the post-save bump that keeps a new record visible immediately.
  useEffect(() => {
    const controller = new AbortController();
    lastAnalyticsFetchRef.current = Date.now();
    void loadChartAnalytics(controller.signal, false);
    return () => controller.abort();
  }, [usagePeriod, category, ingredientFilter, analyticsRevision]);
  useEffect(() => {
    const controller = new AbortController();
    void loadReasonAnalytics(controller.signal, false);
    return () => controller.abort();
  }, [wastePeriod, category, ingredientFilter, analyticsRevision]);
  // One timer owns both cards, so a rerender cannot leave a second interval behind.
  useEffect(() => {
    const controller = new AbortController();
    const refresh = () => {
      // A hidden tab polls nothing. On return this runs again and fetches only when the five
      // minutes really elapsed, so a backgrounded tab neither hammers the endpoint nor shows
      // figures older than the policy allows.
      if (document.hidden) return;
      if (Date.now() - lastAnalyticsFetchRef.current < ANALYTICS_REFRESH_MS) return;
      const { chart, reason } = loadersRef.current;
      // A card already waiting on a reply is skipped rather than queued, so a slow network
      // cannot stack overlapping requests.
      if (!inFlightRef.current.chart) {
        inFlightRef.current.chart = true;
        void chart(controller.signal, true).finally(() => { inFlightRef.current.chart = false; });
      }
      if (!inFlightRef.current.reason) {
        inFlightRef.current.reason = true;
        void reason(controller.signal, true).finally(() => { inFlightRef.current.reason = false; });
      }
    };
    const timer = window.setInterval(refresh, ANALYTICS_REFRESH_MS);
    document.addEventListener('visibilitychange', refresh);
    return () => { window.clearInterval(timer); document.removeEventListener('visibilitychange', refresh); controller.abort(); };
  }, []);
  // The Manager dialogs are the locked Inventory Staff dialogs: the same component, the same
  // class chain, the same bulk-item workflow including Add another item. Manager bulk recording
  // is authorized on the server, so nothing here is a Manager-only variant - a second form would
  // drift out of step with the baseline it is meant to match.
  const openForm = (kind: 'usage' | 'waste') => { kind === 'usage' ? setUsageOpen(true) : setWasteOpen(true); };
  // After a successful save the page reloads its ledger and re-reads both analytics cards, so a
  // freshly recorded batch is visible without a manual refresh.
  const saved = async () => { await load(); setAnalyticsRevision(value => value + 1); };
  // Both boundaries are derived, never invented: `today` is the Philippine
  // calendar date, and `earliest` is the oldest Activity Date actually present
  // in the complete authorized ledger. While the ledger is unavailable both
  // stay undefined, so the inputs keep a truthful, unrestricted state instead
  // of advertising a boundary the data does not support.
  const today = businessDateInputValue();
  const earliest = records ? earliestActivityDate(records) : null;
  const customState = range === 'Custom range' ? customRangeState(from, to, earliest, today) : 'valid';
  const rangeIncomplete = customState === 'incomplete';
  const rangeInvalid = customState !== 'valid' && !rangeIncomplete;
  const rangeReady = customState === 'valid';
  // The inputs are bounded as soon as a complete ledger exists. A background
  // refresh that fails leaves that ledger on screen, and its earliest Activity
  // Date is still a true boundary, so the limits are never withdrawn: dropping
  // them would let the Manager pick a date the data cannot account for.
  const bounded = records !== null;
  const rangeMessage = customState === 'invalid-date' ? 'Enter a valid calendar date.'
    : customState === 'before-earliest' ? `From date cannot be before the earliest activity date, ${formatDate(earliest!)}.`
    : customState === 'future' ? 'Dates cannot be later than today in the Philippines.'
    : customState === 'reversed' ? 'From date must be on or before To date.' : '';
  const ingredientCategory = new Map(ingredients.map(item => [item.id, item.category]));
  const filtered = rangeReady ? (records ?? []).filter(record => (!search || `${record.ingredient.name} ${record.batch.batchID}`.toLowerCase().includes(search.toLowerCase())) && (!category || ingredientCategory.get(record.ingredient.id) === category) && (!ingredientFilter || record.ingredient.id === ingredientFilter) && activityDateMatches(record.operationalDate, range, from, to)) : [];
  const pageRecords = filtered.slice((page - 1) * rows, page * rows);
  const totalUsage = usageSummary?.totalUsageToday && Number.isFinite(usageSummary.totalUsageToday.quantity) ? `${formatCompactNumber(usageSummary.totalUsageToday.quantity)} ${usageSummary.totalUsageToday.unit}` : usageSummary?.usageRecordsToday === 0 ? '0' : '—';
  const totalWaste = wasteSummary?.totalWasteToday && Number.isFinite(wasteSummary.totalWasteToday.quantity) ? `${formatCompactNumber(wasteSummary.totalWasteToday.quantity)} ${wasteSummary.totalWasteToday.unit}` : wasteSummary?.wasteRecordsToday === 0 ? '0' : '—';
  const todayUsage = usageSummary?.usageRecordsToday ?? 0;
  const todayWaste = wasteSummary?.wasteRecordsToday ?? 0;
  const todayCombined = todayUsage + todayWaste;
  const totalRecords = records?.length ?? 0;
  const totalWasteCount = records?.filter(r => r.type === 'Waste').length ?? 0;
  const wasteRateValue = failed
    ? '—'
    : !usageSummary || !wasteSummary
      ? '…'
      : todayCombined > 0
        ? `${((todayWaste / todayCombined) * 100).toFixed(1)}%`
        : totalRecords > 0
          ? `${((totalWasteCount / totalRecords) * 100).toFixed(1)}%`
          : '0.0%';
  const wasteRateLabel = failed
    ? 'Waste rate unavailable'
    : !usageSummary || !wasteSummary
      ? 'Loading waste rate'
      : todayCombined > 0
        ? 'Waste share of recorded activity today'
        : totalRecords > 0
          ? 'Overall waste share of records'
          : 'No waste recorded today';
  const toggleSeries = (series: DailySeries) => setVisibleSeries(current => {
    // At least one series must stay on screen, so the last visible one is left alone.
    if (current[series] && Object.values(current).filter(Boolean).length === 1) return current;
    return { ...current, [series]: !current[series] };
  });
  // A daily series is internally consistent when its days add up to the reported total.
  // Each card is checked on its own period now that they may differ.
  const usageAgree = !!usageAnalytics && usageAnalytics.dailyCounts.reduce((sum, day) => sum + day.count, 0) === usageAnalytics.total;
  const wasteAgree = !!wasteAnalytics && wasteAnalytics.dailyCounts.reduce((sum, day) => sum + day.count, 0) === wasteAnalytics.total;
  const chartReady = usageAgree && wasteAgree && usageAnalytics!.period.from === wasteAnalytics!.period.from && usageAnalytics!.period.to === wasteAnalytics!.period.to;
  const reasonAgree = !!reasonAnalytics && reasonAnalytics.dailyCounts.reduce((sum, day) => sum + day.count, 0) === reasonAnalytics.total;
  const dailyPoints = chartReady ? dailyRecordPoints(usageAnalytics!.period.from, usageAnalytics!.period.to, usageAnalytics!.dailyCounts, wasteAnalytics!.dailyCounts) : [];
  const reset = () => { setSearch(''); setRange('All dates'); setFrom(''); setTo(''); setCategory(''); setIngredientFilter(''); setPage(1); };
  // One labelled group whose inputs carry their own native min/max limits, so the
  // calendar and manual entry share the same boundaries. A value outside them is
  // reported on the field it belongs to rather than clamped; the Manager's chosen
  // date is never silently replaced. Both inputs are rendered inline because a
  // component defined in this body takes a fresh identity every render, and React
  // would then remount the inputs on each keystroke, dropping focus and closing an
  // open picker before the selection is committed.
  const rangeMessageId = 'manager-record-range-message';
  const rangeFieldInvalid = (field: 'from' | 'to') => customRangeFieldInvalid(customState, field, from, to, today);
  const rangeFields = <div className="sl-v219-custom-date-range">
    <label><span>From</span><input type="date" value={from} min={bounded ? earliest ?? undefined : undefined} max={to && to <= today ? to : today} aria-invalid={rangeFieldInvalid('from')} aria-describedby={rangeInvalid ? rangeMessageId : undefined} onInput={event => { setFrom(event.currentTarget.value); setPage(1); }} onChange={event => { setFrom(event.target.value); setPage(1); }}/></label>
    <label><span>To</span><input type="date" value={to} min={from || undefined} max={today} aria-invalid={rangeFieldInvalid('to')} aria-describedby={rangeInvalid ? rangeMessageId : undefined} onInput={event => { setTo(event.currentTarget.value); setPage(1); }} onChange={event => { setTo(event.target.value); setPage(1); }}/></label>
    {rangeInvalid && <p id={rangeMessageId} className="sl-manager-record-range-message" role="alert">{rangeMessage}</p>}
  </div>;
  return <><PageHeader eyebrow="Operations" title="Usage & Waste" description="Monitor ingredient usage and waste to identify trends, reduce losses, and improve efficiency." />
    <div className="sl-admin-view sl-manager-usage-waste-v121 sl-manager-usage-live"><section className="sl-sa-kpis sl-dashboard-source-kpis"><article className="sl-sa-kpi" data-tone="brand"><span className="sl-sa-kpi-icon"><Leaf /></span><div><span>Total Usage</span><strong title={usageSummary?.totalUsageToday && Number.isFinite(usageSummary.totalUsageToday.quantity) ? `${usageSummary.totalUsageToday.quantity.toLocaleString('en-PH')} ${usageSummary.totalUsageToday.unit}` : undefined}>{failed ? '—' : totalUsage}</strong><small>{failed ? 'Usage data unavailable' : usageSummary ? 'Usage quantity recorded today' : 'Loading usage summary'}</small></div></article><article className="sl-sa-kpi" data-tone="info"><span className="sl-sa-kpi-icon"><Trash2 /></span><div><span>Total Waste</span><strong title={wasteSummary?.totalWasteToday && Number.isFinite(wasteSummary.totalWasteToday.quantity) ? `${wasteSummary.totalWasteToday.quantity.toLocaleString('en-PH')} ${wasteSummary.totalWasteToday.unit}` : undefined}>{failed ? '—' : totalWaste}</strong><small>{failed ? 'Waste data unavailable' : wasteSummary ? 'Waste quantity recorded today' : 'Loading waste summary'}</small></div></article><article className="sl-sa-kpi" data-tone="attention"><span className="sl-sa-kpi-icon"><BarChart3 /></span><div><span>Waste Rate</span><strong>{wasteRateValue}</strong><small>{wasteRateLabel}</small></div></article><article className="sl-sa-kpi" data-tone="critical"><span className="sl-sa-kpi-icon"><TrendingUp /></span><div><span>Estimated Cost of Waste</span><strong title={wasteSummary && Number.isFinite(wasteSummary.totalWasteCostToday) ? formatExactPeso(wasteSummary.totalWasteCostToday) : undefined}>{wasteSummary && Number.isFinite(wasteSummary.totalWasteCostToday) ? formatCompactPeso(wasteSummary.totalWasteCostToday) : '—'}</strong><small>{failed ? 'Waste-cost data unavailable' : wasteSummary ? 'Waste cost recorded today' : 'Loading waste-cost summary'}</small></div></article></section>
      <div className="sl-manager-usage-analytics">
        <section className="sl-card">
          <header className="sl-card-header"><div className="sl-manager-analytics-heading"><h2 className="sl-card-title">Usage vs Waste Trend</h2><p className="sl-manager-analytics-updated">{chartStale ? <><RefreshCw size={12} aria-hidden="true" />Refresh failed — showing earlier figures, last updated {analyticsUpdatedAt ? formatTopbarDateTime(analyticsUpdatedAt) : 'unavailable'}</> : analyticsUpdatedAt ? <><RefreshCw size={12} aria-hidden="true" />Last updated {formatTopbarDateTime(analyticsUpdatedAt)}</> : 'Last updated unavailable'}</p></div><div className="sl-manager-analytics-header-tools"><ManagerDailyRecordLegend visible={visibleSeries} onToggle={toggleSeries} /><ManagerAnalyticsPeriod value={usagePeriod} onSelect={setUsagePeriod} ariaLabel="Usage vs Waste date range" /></div></header>
          <div className="sl-card-body">
            {analyticsFailed ? <DataState kind="error" title="Analytics unavailable" description="Usage and waste analytics could not be loaded." /> : !usageAnalytics || !wasteAnalytics ? <DataState kind="loading" title="Loading analytics" description="Retrieving daily record counts for the selected period." /> : !chartReady ? <DataState kind="error" title="Analytics unavailable" description="Daily counts do not match the reported totals." /> : <>
              {/* The chart keeps its plot, axes and date labels even when every day in the
                  selected period is zero: the empty line is drawn inside the plot, so the
                  Manager still reads which window was queried. */}
              <ManagerDailyRecordChart ariaLabel="Daily usage and waste record counts for the selected period" points={dailyPoints} visible={visibleSeries} emptyLabel={`Nothing recorded for ${usagePeriod === 'Today' ? 'today' : usagePeriod === 'Weekly' ? 'this week' : 'this month'} yet`} emptyDescription="Once you add records, your daily trend will show up here." emptyActions={<>
                <InventoryStaffAddButton buttonRef={usageTrigger} label="Log usage" onClick={() => openForm('usage')} />
                <button ref={wasteTrigger} type="button" className="sl-button sl-manager-log-waste" onClick={() => openForm('waste')}><Plus size={16} aria-hidden="true" />Log waste</button>
              </>} />
              {/* The trend card keeps its paired Usage/Waste peak callouts under the plot,
                  as the approved reference shows: two compact blocks on one reading line,
                  green for Usage and coral for Waste. Each sentence is generated from the
                  same daily record counts the lines are drawn from, so a callout can never
                  disagree with the chart above it. They sit in one grid wrapper rather than
                  two independent blocks, which is what keeps the pair even on desktop and
                  stacked below the 420px breakpoint. */}
              <div className="sl-manager-insight-pair" aria-label="Usage and waste peak observations">
                <p className="sl-manager-insight" data-tone="usage"><ManagerInsightText text={dailyPeakInsight(dailyPoints, 'usage', usagePeriod)} anchors={['Usage']} /></p>
                <p className="sl-manager-insight" data-tone="waste"><ManagerInsightText text={dailyPeakInsight(dailyPoints, 'waste', usagePeriod)} anchors={['Waste']} /></p>
              </div>
            </>}
          </div>
        </section>
        <section className="sl-card">
          <header className="sl-card-header"><div className="sl-manager-analytics-heading"><h2 className="sl-card-title">Waste by Reason</h2>{reasonStale && <p className="sl-manager-analytics-updated"><RefreshCw size={12} aria-hidden="true" />Refresh failed — showing earlier figures</p>}</div><div className="sl-manager-analytics-header-tools"><ManagerAnalyticsPeriod value={wastePeriod} onSelect={setWastePeriod} ariaLabel="Waste by Reason date range" /></div></header>
          <div className="sl-card-body">
            {reasonFailed ? <DataState kind="error" title="Analytics unavailable" description="Usage and waste analytics could not be loaded." /> : !reasonAnalytics ? <DataState kind="loading" title="Loading analytics" description="Retrieving record counts for the selected period." /> : !reasonAgree ? <DataState kind="error" title="Analytics unavailable" description="Daily counts do not match the reported total." /> : <>
              {/* Two tiles answer the two questions a Manager asks first: how much waste
                  there is, and what is causing most of it. Both read the same record
                  counts the bars below use, so nothing on the card can disagree. */}
              <div className="sl-manager-reason-tiles">
                <article className="sl-manager-reason-tile" data-tile="records"><span>Waste Records</span><strong>{wasteRecordCount(reasonAnalytics.byReason, WASTE_REASONS)}</strong></article>
                <article className="sl-manager-reason-tile" data-tile="cause"><span>Biggest Cause</span><strong>{biggestWasteCause(reasonAnalytics.byReason, WASTE_REASONS).value}</strong></article>
              </div>
              {/* Only reasons with records get a bar, so every bar has length to read.
                  Percentages are share of this period's waste records. */}
              {reasonAnalytics.total > 0 && <ApplicationBarBreakdown ariaLabel="Waste record counts by reason for the selected period" showPercentages items={WASTE_REASONS.filter(reason => (reasonAnalytics.byReason[reason] ?? 0) > 0).map(reason => { const value = reasonAnalytics.byReason[reason] ?? 0; return { label: reason, value, tone: reason.toLowerCase().replaceAll(' ', '-'), percentage: `${Math.round(value / reasonAnalytics.total * 100)}%` }; })} />}
              {/* An empty period keeps the whole composition - the tiles above, this compact
                  breakdown, and every reason as a chip below. Swapping the card for one
                  generic empty state would blank the reasons that are clean, which is
                  exactly what a Manager opens this card to check. */}
              {reasonAnalytics.total === 0 && <div className="sl-manager-reason-empty">
                <p><strong>No waste records in this period.</strong></p>
                <p>Bars appear here once waste is recorded for the selected period.</p>
              </div>}
              {/* The causes with no records stay visible as chips instead of full-width
                  empty bars: knowing what is not happening is useful, but a row of zero
                  bars reads as missing data rather than as a clean result. In an empty
                  period this lists all supported reasons, so a clean week reads as a
                  clean week rather than as an unloaded card. */}
              {zeroWasteReasonNames(reasonAnalytics.byReason, WASTE_REASONS).length > 0 && <div className="sl-manager-reason-zeroes">
                <span>No waste from:</span>
                <ul>{zeroWasteReasonNames(reasonAnalytics.byReason, WASTE_REASONS).map(reason => <li key={reason}>{reason}</li>)}</ul>
              </div>}
            </>}
          </div>
        </section>
      </div>
      <section className="sl-manager-usage-records sl-application-records sl-sa-ingredients-table-card sl-sa-account-pattern-records"><header className="sl-application-records-header sl-staff-usage-card-head"><span className="sl-staff-usage-head-icon"><FileInput /></span><h2>Usage &amp; Waste Records</h2></header><div className="sl-application-records-filters sl-sa-ingredients-table-filters"><div className="sl-application-records-toolbar sl-sa-ingredients-filter-card" data-filter-layout="records-five"><label className="sl-application-records-search sl-sa-ingredients-search"><span>Search records</span><span><Search size={16}/><input value={search} onChange={event => { setSearch(event.target.value); setPage(1); }} placeholder="Search by ingredient or Batch ID..."/></span></label><label><span>Date Range</span><FilterSelect ariaLabel="Filter usage and waste by date range" value={range} options={[{value:'All dates',label:'All dates'},{value:'Today',label:'Today'},{value:'7 days',label:'7 days'},{value:'30 days',label:'30 days'},{value:'Custom range',label:'Custom range'}]} onChange={value => { setRange(value); setFrom(''); setTo(''); setPage(1); }}/></label>{range === 'Custom range' && rangeFields}<label><span>Ingredient Category</span><FilterSelect ariaLabel="Filter usage and waste by ingredient category" value={category} options={[{value:'',label:'All Categories'},...INGREDIENT_CATEGORIES.map(value => ({value, label:value}))]} onChange={value => { setCategory(value); setIngredientFilter(''); setPage(1); }}/></label><label><span>Ingredient</span><FilterSelect ariaLabel="Filter usage and waste by ingredient" value={ingredientFilter} options={[{value:'',label:'All Ingredients'},...ingredients.filter(item => !category || item.category === category).map(item => ({value:item.id, label: formatHumanReadableText(item.name)}))]} onChange={value => { setIngredientFilter(value); setPage(1); }}/></label><div className="sl-application-records-filter-actions sl-sa-ingredients-filter-actions"><button className="sl-button" type="button" onClick={reset}>Reset</button></div></div></div><div className="sl-application-records-table-shell sl-sa-ingredients-table-scroll"><table className="sl-application-records-table sl-records-table sl-sa-ingredients-table sl-data-table"><thead><tr>{['Activity Date','Ingredient','Type','Quantity','Batch ID','Details / Reason','Recorded By'].map(value => <th key={value}>{value}</th>)}</tr></thead><tbody>{pageRecords.length ? pageRecords.map(record => <tr key={record.id}><td>{formatDate(record.operationalDate)}</td><td className="sl-emphasized-value">{formatHumanReadableText(record.ingredient.name)}</td><td>{record.type}</td><td>{record.quantity} {record.unit}</td><td>{record.batch.batchID}</td><td>{record.notes}</td><td>{`${record.recordedBy.firstName ?? ''} ${record.recordedBy.lastName ?? ''}`.trim() || 'Unknown account'}</td></tr>) : <tr><td colSpan={7} className="sl-empty-cell"><DataState kind={failed ? 'error' : records === null ? 'loading' : 'empty'} title={failed ? 'Data unavailable' : records === null ? 'Loading records' : rangeInvalid ? 'Invalid date range' : rangeIncomplete ? 'Complete date range' : search || range !== 'All dates' || category || ingredientFilter ? 'No matching records' : 'No live records yet'} description={failed ? 'Usage and waste records could not be loaded.' : records === null ? 'Retrieving operational transactions.' : rangeInvalid ? rangeMessage : rangeIncomplete ? 'Pick a From and To date to apply the custom range.' : 'Usage and waste records will appear here after transactions are recorded.'}/></td></tr>}</tbody></table></div><footer className="sl-application-records-footer sl-records-footer sl-sa-ingredients-footer"><label>Rows per page <select value={rows} onChange={event => { setRows(Number(event.target.value)); setPage(1); }}>{PAGE_SIZES.map(value => <option key={value}>{value}</option>)}</select></label><Pagination compact page={page} pageSize={rows} total={filtered.length} itemLabel="usage and waste records" onPageChange={setPage}/></footer></section>
    </div>
    {/* Both dialogs ARE the locked Inventory Staff dialogs - same component, same class chain,
        same bulk-item workflow including Add another item - because Manager bulk usage and waste
        recording is an explicitly approved business rule (see the route authorization). The
        Inventory Staff baseline is untouched: this is reuse, not a Manager variant. */}
    <InventoryStaffBulkModal mode="usage" open={usageOpen} ingredients={ingredients} onDismiss={() => setUsageOpen(false)} returnFocus={usageTrigger} onSaved={saved} />
    <InventoryStaffBulkModal mode="waste" open={wasteOpen} ingredients={ingredients} onDismiss={() => setWasteOpen(false)} returnFocus={wasteTrigger} onSaved={saved} />
  </>;
}
