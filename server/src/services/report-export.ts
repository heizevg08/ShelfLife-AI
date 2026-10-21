import type { inventoryBatchModel } from '../models/inventory-batch';
import type { ingredientModel } from '../models/ingredient';
import type { usageRecordModel } from '../models/usage-record';
import type { wasteRecordModel } from '../models/waste-record';
import type { auditRecordModel } from '../models/audit-record';
import type { forecastSnapshotModel } from '../models/forecast-snapshot';
import type { ForecastSnapshotStore } from './forecast-snapshot-store';
import type { ForecastEvaluationService } from './forecast-evaluation-service';
import type { ReportQuery, ReportId } from '../validators/report';
import { AdministrationError } from '../middleware/administration.middleware';
import { businessDaysUntilExpiry } from '../utils/business-day';

type Id = { toString(): string };
type Batch = { _id: Id; ingredientId: Id; batchID: string; quantity: number; unit: string; expirationDate: Date; unitCost?: number };
type Ingredient = { _id: Id; name: string; category: string; standardUnitCost?: number; unitOfMeasure?: string; minimumStock?: number };
type Waste = { batchId: Id; ingredientId: Id; unit: string; quantityWasted: number; wasteCost: number; dateWasted: Date };
type Usage = { ingredientId: Id; unit: string; quantityUsed: number; dateUsed: Date };
type Cell = string | number | null;
type ReportActorRole = 'Manager' | 'Admin';
export type ReportTable = { columns: string[]; rows: Cell[][]; dataRows: number; empty: boolean };

const headers: Record<ReportId, string[]> = {
  'inventory-summary': ['Record Type', 'Generated At (PHT)', 'Ingredient ID', 'Ingredient', 'Category', 'Batch ID', 'Quantity On Hand', 'Unit', 'Expiration Date', 'Unit Cost (PHP)', 'Unit Cost Source', 'Inventory Value (PHP)', 'Valuation Status'],
  'expiration-waste': ['Record Type', 'Generated At (PHT)', 'Period From', 'Period To', 'Ingredient ID', 'Ingredient', 'Batch ID', 'Expiration Date', 'Current Quantity', 'Unit', 'Waste Record Count', 'Quantity Wasted In Period', 'Waste Cost In Period (PHP)', 'Data Status'],
  'usage-consumption': ['Usage Date (PHT)', 'Ingredient ID', 'Ingredient', 'Unit', 'Quantity Used', 'Usage Record Count', 'Data Status'],
  'demand-forecast': ['Record Type', 'Generated At (PHT)', 'Ingredient ID', 'Ingredient', 'Category', 'Unit', 'Current Stock', 'Avg Daily Usage', 'Forecasted Demand', 'Stock Coverage (Days)', 'Risk Level', 'Recommended Action'],
  'forecast-vs-actual': ['Date (PHT)', 'Ingredient ID', 'Ingredient', 'Category', 'Unit', 'Forecasted Demand', 'Actual Usage', 'Variance', 'Variance (%)', 'Status'],
  'forecast-accuracy': ['Generated At (PHT)', 'Ingredient ID', 'Ingredient', 'Category', 'Unit', 'Accuracy Score (%)', 'Evaluation Status', 'Evaluated Days', 'MAE', 'RMSE', 'WAPE (%)', 'Notes'],
  'expiration-risk': ['Generated At (PHT)', 'Ingredient ID', 'Ingredient', 'Category', 'Batch ID', 'Expiration Date', 'Days to Expiry', 'On Hand Quantity', 'Unit', 'Avg Daily Usage', 'Projected Excess', 'At-Risk Cost (PHP)', 'Risk Level', 'FEFO Action'],
  'ai-insights-recommendations': ['Generated At (PHT)', 'Ingredient ID', 'Ingredient', 'Category', 'Current Stock', 'Unit', 'Days of Supply', 'Risk Level', 'Action Priority', 'Recommended Action', 'Evidence & Operational Insight'],
};

const day = (value: Date) => new Intl.DateTimeFormat('sv-SE', { timeZone: 'Asia/Manila', year: 'numeric', month: '2-digit', day: '2-digit' }).format(value);
const generated = (value: Date) => new Intl.DateTimeFormat('sv-SE', { timeZone: 'Asia/Manila', dateStyle: 'short', timeStyle: 'medium' }).format(value);
const id = (value: Id) => value.toString();

function roundNumber(value: number, decimals: number): number {
  const factor = Math.pow(10, decimals);
  return Math.round(value * factor) / factor;
}

export function csvCell(value: Cell): string {
  const raw = String(value ?? '');
  // Spreadsheet applications may execute a leading formula after CSV import.
  const safe = /^[\s\u0000-\u001f]*[=+\-@]/u.test(raw) ? `'${raw}` : raw;
  return `"${safe.replace(/"/g, '""')}"`;
}
export function reportCsv(table: ReportTable) {
  return `\uFEFF${[table.columns, ...table.rows].map(row => row.map(csvCell).join(',')).join('\r\n')}\r\n`;
}
function bounded(table: ReportTable) {
  if (table.dataRows > 5000) throw new AdministrationError(413, 'EXPORT_TOO_LARGE', 'Narrow the report to at most 5,000 data rows');
  return table;
}

export function createReportExports(models: {
  batches: ReturnType<typeof inventoryBatchModel>;
  ingredients: ReturnType<typeof ingredientModel>;
  usage: ReturnType<typeof usageRecordModel>;
  waste: ReturnType<typeof wasteRecordModel>;
  audits: ReturnType<typeof auditRecordModel>;
  evaluation?: ForecastEvaluationService;
  snapshots?: ReturnType<typeof forecastSnapshotModel>;
  snapshotStore?: ForecastSnapshotStore;
}) {
  async function table(query: ReportQuery, now = new Date()): Promise<ReportTable> {
    const columns = headers[query.reportId];
    const ingredientRows = await models.ingredients.find({}).select('_id name category standardUnitCost unitOfMeasure minimumStock').lean().exec() as Ingredient[];
    const ingredients = new Map(ingredientRows.map(row => [id(row._id), row]));

    if (query.reportId === 'usage-consumption') {
      const records = await models.usage.find({ dateUsed: { $gte: query.start, $lt: query.end } }).select('ingredientId unit quantityUsed dateUsed').lean().exec() as Usage[];
      const grouped = new Map<string, { date: string; ingredientId: string; unit: string; quantity: number; count: number }>();
      for (const row of records) {
        const date = day(row.dateUsed), ingredientId = id(row.ingredientId), key = JSON.stringify([date, ingredientId, row.unit]);
        const item = grouped.get(key) ?? { date, ingredientId, unit: row.unit, quantity: 0, count: 0 };
        item.quantity += row.quantityUsed; item.count += 1; grouped.set(key, item);
      }
      const rows = [...grouped.values()].sort((a, b) => a.date.localeCompare(b.date) || a.ingredientId.localeCompare(b.ingredientId) || a.unit.localeCompare(b.unit)).map(item => {
        const ingredient = ingredients.get(item.ingredientId);
        return [item.date, item.ingredientId, ingredient?.name ?? null, item.unit, item.quantity, item.count, ingredient ? 'Complete' : 'Missing ingredient reference'];
      });
      return bounded({ columns, rows, dataRows: rows.length, empty: rows.length === 0 });
    }

    if (query.reportId === 'demand-forecast') {
      if (models.evaluation) {
        const overview = await models.evaluation.tableOverview({
          pageSize: 5000,
          from: query.from,
          to: query.to,
        });
        const rows: Cell[][] = overview.items.map(item => {
          const coverage = item.avgDailyUsage > 0 ? roundNumber(item.currentStock / item.avgDailyUsage, 1) : null;
          return [
            'INGREDIENT_FORECAST',
            generated(now),
            item.id,
            item.name,
            item.category,
            item.unit,
            item.currentStock,
            item.avgDailyUsage,
            item.forecastedDemand,
            coverage,
            item.riskLevel,
            item.recommendedAction,
          ];
        });
        return bounded({ columns, rows, dataRows: rows.length, empty: rows.length === 0 });
      }

      // Self-contained fallback when evaluation service is not provided
      const batches = await models.batches.find({ quantity: { $gt: 0 } }).select('_id ingredientId quantity expirationDate').lean().exec() as Batch[];
      const usageWindow = query.start && query.end ? { $gte: query.start, $lt: query.end } : { $gte: new Date(now.getTime() - 30 * 86_400_000) };
      const usageList = await models.usage.find({ dateUsed: usageWindow }).select('ingredientId quantityUsed').lean().exec() as Array<{ ingredientId: Id; quantityUsed: number }>;
      const usageTotals = new Map<string, number>();
      for (const u of usageList) {
        const k = id(u.ingredientId);
        usageTotals.set(k, (usageTotals.get(k) ?? 0) + u.quantityUsed);
      }
      const stockTotals = new Map<string, number>();
      for (const b of batches) {
        if (b.expirationDate.getTime() >= now.getTime()) {
          const k = id(b.ingredientId);
          stockTotals.set(k, (stockTotals.get(k) ?? 0) + b.quantity);
        }
      }
      const daysCount = query.start && query.end ? Math.max(1, Math.round((query.end.getTime() - query.start.getTime()) / 86_400_000)) : 30;
      const rows: Cell[][] = ingredientRows.sort((a, b) => a.name.localeCompare(b.name)).map(ing => {
        const ingId = id(ing._id);
        const stock = roundNumber(stockTotals.get(ingId) ?? 0, 1);
        const avgDaily = roundNumber((usageTotals.get(ingId) ?? 0) / daysCount, 2);
        const demand = roundNumber(avgDaily * 30, 1);
        const coverage = avgDaily > 0 ? roundNumber(stock / avgDaily, 1) : null;
        const minStock = ing.minimumStock ?? 10;
        let risk: 'Low' | 'Medium' | 'High' | 'Critical' = 'Low';
        let action = 'Maintain Stock';
        if (stock <= 0) { risk = 'Critical'; action = 'Immediate Stock-In'; }
        else if (stock < minStock || stock < avgDaily * 3) { risk = 'High'; action = 'Reorder Stock'; }
        else if (stock < avgDaily * 7) { risk = 'Medium'; action = 'Monitor Stock'; }
        else if (demand > 0 && stock > demand * 2) { risk = 'Low'; action = 'Reduce Orders (Surplus)'; }
        return ['INGREDIENT_FORECAST', generated(now), ingId, ing.name, ing.category, ing.unitOfMeasure ?? 'kg', stock, avgDaily, demand, coverage, risk, action];
      });
      return bounded({ columns, rows, dataRows: rows.length, empty: rows.length === 0 });
    }

    if (query.reportId === 'forecast-vs-actual') {
      const usageRecords = query.start && query.end
        ? await models.usage.find({ dateUsed: { $gte: query.start, $lt: query.end } }).select('ingredientId unit quantityUsed dateUsed').lean().exec() as Usage[]
        : [];
      let snapshots: Array<{ ingredientId: string; targetDate: string; predictedQuantity: number }> = [];
      if (models.snapshotStore && query.from && query.to) {
        const records = await models.snapshotStore.findSnapshots({
          status: 'ACTIVE',
          targetDateFrom: query.from,
          targetDateTo: query.to,
        });
        snapshots = records.map(r => ({
          ingredientId: id(r.ingredientId as Id),
          targetDate: r.targetDate,
          predictedQuantity: r.predictedQuantity,
        }));
      } else if (models.snapshots && query.from && query.to) {
        const rawSnapshots = await models.snapshots.find({
          status: 'ACTIVE',
          targetDate: { $gte: query.from, $lte: query.to },
        }).select('ingredientId targetDate predictedQuantity').lean().exec() as Array<{ ingredientId: Id; targetDate: string; predictedQuantity: number }>;
        snapshots = rawSnapshots.map(r => ({
          ingredientId: id(r.ingredientId),
          targetDate: r.targetDate,
          predictedQuantity: r.predictedQuantity,
        }));
      }
      const forecastMap = new Map<string, number>();
      for (const s of snapshots) forecastMap.set(`${s.targetDate}:${s.ingredientId}`, s.predictedQuantity);

      const actualMap = new Map<string, { unit: string; total: number }>();
      for (const u of usageRecords) {
        const k = `${day(u.dateUsed)}:${id(u.ingredientId)}`;
        const cur = actualMap.get(k) ?? { unit: u.unit, total: 0 };
        cur.total += u.quantityUsed;
        actualMap.set(k, cur);
      }

      const allKeys = [...new Set([...forecastMap.keys(), ...actualMap.keys()])];
      const rows: Cell[][] = allKeys.sort().map(key => {
        const [dStr, ingId] = key.split(':');
        const ing = ingredients.get(ingId);
        const forecast = forecastMap.has(key) ? forecastMap.get(key)! : null;
        const actual = actualMap.has(key) ? roundNumber(actualMap.get(key)!.total, 2) : 0;
        const unit = ing?.unitOfMeasure ?? actualMap.get(key)?.unit ?? 'kg';
        const variance = forecast !== null ? roundNumber(actual - forecast, 2) : null;
        const variancePct = forecast !== null && forecast > 0 ? roundNumber(((actual - forecast) / forecast) * 100, 1) : null;
        const status = forecast === null
          ? 'No Forecast Snapshot'
          : actual === 0
            ? 'No Usage Recorded'
            : Math.abs(actual - forecast) <= (forecast * 0.1)
              ? 'Accurate (±10%)'
              : actual > forecast
                ? 'Over-consumed'
                : 'Under-consumed';
        return [dStr, ingId, ing?.name ?? null, ing?.category ?? null, unit, forecast, actual, variance, variancePct, status];
      });
      return bounded({ columns, rows, dataRows: rows.length, empty: rows.length === 0 });
    }

    if (query.reportId === 'forecast-accuracy') {
      const rows: Cell[][] = [];
      for (const ing of ingredientRows) {
        const ingId = id(ing._id);
        if (models.evaluation) {
          const evalResult = await models.evaluation.evaluateAccuracy(ingId, now);
          if (evalResult.status === 'AVAILABLE') {
            const score = evalResult.metrics.accuracyScore;
            const wape = evalResult.metrics.wape !== null ? roundNumber(evalResult.metrics.wape * 100, 1) : null;
            rows.push([generated(now), ingId, ing.name, ing.category, ing.unitOfMeasure ?? 'kg', score, 'Evaluated', evalResult.metrics.evaluatedDays, evalResult.metrics.mae, evalResult.metrics.rmse, wape, 'Accuracy target met']);
          } else if (evalResult.status === 'UNAVAILABLE') {
            const statusLabel = evalResult.reason === 'INSUFFICIENT_EVALUATION_DATA' ? 'Insufficient Data' : evalResult.reason === 'NO_FORECASTS' ? 'No Forecasts' : 'No Usage';
            const notes = evalResult.reason === 'INSUFFICIENT_EVALUATION_DATA' ? `Requires at least ${evalResult.minimumRequiredDays} evaluated days (currently ${evalResult.evaluatedDays})` : evalResult.reason === 'NO_FORECASTS' ? 'No historical forecast snapshots found' : 'No historical usage records found';
            rows.push([generated(now), ingId, ing.name, ing.category, ing.unitOfMeasure ?? 'kg', null, statusLabel, evalResult.evaluatedDays, null, null, null, notes]);
          } else {
            rows.push([generated(now), ingId, ing.name, ing.category, ing.unitOfMeasure ?? 'kg', null, 'Not Found', 0, null, null, null, 'Ingredient not found']);
          }
        } else {
          rows.push([generated(now), ingId, ing.name, ing.category, ing.unitOfMeasure ?? 'kg', null, 'Pending Data', 0, null, null, null, 'Evaluation service offline']);
        }
      }
      rows.sort((a, b) => String(a[2] ?? '').localeCompare(String(b[2] ?? '')));
      return bounded({ columns, rows, dataRows: rows.length, empty: rows.length === 0 });
    }

    if (query.reportId === 'expiration-risk') {
      const batches = await models.batches.find({ quantity: { $gt: 0 } }).select('_id ingredientId batchID quantity unit expirationDate unitCost').lean().exec() as Batch[];
      const thirtyDaysAgo = new Date(now.getTime() - 30 * 86_400_000);
      const recentUsage = await models.usage.find({ dateUsed: { $gte: thirtyDaysAgo } }).select('ingredientId quantityUsed').lean().exec() as Array<{ ingredientId: Id; quantityUsed: number }>;
      const usageByIng = new Map<string, number>();
      for (const u of recentUsage) {
        const k = id(u.ingredientId);
        usageByIng.set(k, (usageByIng.get(k) ?? 0) + u.quantityUsed);
      }
      const rows: Cell[][] = [];
      for (const batch of batches) {
        const ingId = id(batch.ingredientId);
        const ingredient = ingredients.get(ingId);
        const daysToExpiry = businessDaysUntilExpiry(batch.expirationDate, now);
        const avgUsage = roundNumber((usageByIng.get(ingId) ?? 0) / 30, 2);
        const projectedDemand = Math.max(0, avgUsage * Math.max(0, daysToExpiry));
        const projectedExcess = roundNumber(Math.max(0, batch.quantity - projectedDemand), 2);
        const unitCost = batch.unitCost ?? ingredient?.standardUnitCost ?? 0;
        const atRiskCost = roundNumber(projectedExcess * unitCost, 2);
        const riskLevel = daysToExpiry <= 0 ? 'Expired' : daysToExpiry <= 3 ? 'Critical' : (projectedExcess > 0 || daysToExpiry <= 7) ? 'High' : daysToExpiry <= 14 ? 'Medium' : 'Low';
        const fefoAction = daysToExpiry <= 0
          ? 'Dispose / Waste Record'
          : daysToExpiry <= 3
            ? 'Immediate Kitchen Use (Urgent FEFO)'
            : daysToExpiry <= 7
              ? 'Priority Kitchen Prep (FEFO)'
              : projectedExcess > 0
                ? 'Promote / Menu Special to Prevent Waste'
                : 'Normal Stock Rotation';
        rows.push([
          generated(now),
          ingId,
          ingredient?.name ?? null,
          ingredient?.category ?? null,
          batch.batchID,
          day(batch.expirationDate),
          daysToExpiry,
          batch.quantity,
          batch.unit,
          avgUsage,
          projectedExcess,
          atRiskCost,
          riskLevel,
          fefoAction,
        ]);
      }
      rows.sort((a, b) => Number(a[6]) - Number(b[6]));
      return bounded({ columns, rows, dataRows: rows.length, empty: rows.length === 0 });
    }

    if (query.reportId === 'ai-insights-recommendations') {
      const batches = await models.batches.find({ quantity: { $gt: 0 } }).select('_id ingredientId batchID quantity unit expirationDate').lean().exec() as Batch[];
      const batchesByIng = new Map<string, Batch[]>();
      for (const b of batches) {
        const k = id(b.ingredientId);
        const list = batchesByIng.get(k) ?? [];
        list.push(b);
        batchesByIng.set(k, list);
      }
      const thirtyDaysAgo = new Date(now.getTime() - 30 * 86_400_000);
      const recentUsage = await models.usage.find({ dateUsed: { $gte: thirtyDaysAgo } }).select('ingredientId quantityUsed').lean().exec() as Array<{ ingredientId: Id; quantityUsed: number }>;
      const usageByIng = new Map<string, number>();
      for (const u of recentUsage) {
        const k = id(u.ingredientId);
        usageByIng.set(k, (usageByIng.get(k) ?? 0) + u.quantityUsed);
      }
      const rows: Cell[][] = [];
      for (const ing of ingredientRows) {
        const ingId = id(ing._id);
        const ingBatches = batchesByIng.get(ingId) ?? [];
        const currentStock = roundNumber(ingBatches.filter(b => b.expirationDate.getTime() >= now.getTime()).reduce((sum, b) => sum + b.quantity, 0), 1);
        const avgUsage = roundNumber((usageByIng.get(ingId) ?? 0) / 30, 2);
        const daysOfSupply = avgUsage > 0 ? roundNumber(currentStock / avgUsage, 1) : null;
        const hasNearExpiry = ingBatches.some(b => {
          const diff = businessDaysUntilExpiry(b.expirationDate, now);
          return diff > 0 && diff <= 7;
        });
        const minStock = ing.minimumStock ?? 10;
        const fDemand = roundNumber(avgUsage * 30, 1);
        const unit = ing.unitOfMeasure ?? 'kg';

        let riskLevel = 'Low';
        let priority = 'P4 - Routine';
        let action = 'Maintain Stock';
        let evidence = `Stock level optimal (${daysOfSupply ?? '—'} days of supply). Continue regular consumption.`;

        if (currentStock <= 0) {
          riskLevel = 'Critical';
          priority = 'P1 - Immediate';
          action = 'Immediate Stock-In';
          evidence = `Out of stock. 0 ${unit} available. Immediate replenishment required to maintain operations.`;
        } else if (currentStock < minStock || (avgUsage > 0 && currentStock < avgUsage * 3)) {
          riskLevel = 'High';
          priority = 'P2 - High';
          action = 'Reorder Stock';
          evidence = `Stock (${currentStock} ${unit}) is below minimum buffer (${minStock} ${unit}). Projected stockout in ${daysOfSupply ?? '—'} days.`;
        } else if (hasNearExpiry) {
          riskLevel = 'Medium';
          priority = 'P2 - High';
          action = 'FEFO Priority';
          evidence = `Batches expiring within 7 days. Prioritize first-expiry consumption before reordering.`;
        } else if (avgUsage > 0 && currentStock < avgUsage * 7) {
          riskLevel = 'Medium';
          priority = 'P3 - Moderate';
          action = 'Monitor Stock';
          evidence = `Supply covers ${daysOfSupply ?? '—'} days. Prepare purchase order for upcoming delivery cycle.`;
        } else if (fDemand > 0 && currentStock > fDemand * 2) {
          riskLevel = 'Low';
          priority = 'P4 - Routine';
          action = 'Reduce Orders (Surplus)';
          evidence = `Current stock exceeds 2x 30-day forecast demand (${currentStock} vs ${fDemand} ${unit}). Pause ordering to avoid excess holding.`;
        }

        rows.push([
          generated(now),
          ingId,
          ing.name,
          ing.category,
          currentStock,
          unit,
          daysOfSupply,
          riskLevel,
          priority,
          action,
          evidence,
        ]);
      }
      rows.sort((a, b) => String(a[8] ?? '').localeCompare(String(b[8] ?? '')) || String(a[2] ?? '').localeCompare(String(b[2] ?? '')));
      return bounded({ columns, rows, dataRows: rows.length, empty: rows.length === 0 });
    }

    const batches = await models.batches.find({}).select('_id ingredientId batchID quantity unit expirationDate unitCost').lean().exec() as Batch[];
    const byBatch = new Map(batches.map(row => [id(row._id), row]));
    if (query.reportId === 'inventory-summary') {
      let total = 0, unavailable = false;
      const rows: Cell[][] = batches.sort((a, b) => a.batchID.localeCompare(b.batchID)).map(batch => {
        const ingredient = ingredients.get(id(batch.ingredientId));
        const cost = batch.unitCost ?? ingredient?.standardUnitCost;
        const value = cost === undefined ? null : batch.quantity * cost;
        if (value === null) unavailable = true; else total += value;
        return ['BATCH', generated(now), id(batch.ingredientId), ingredient?.name ?? null, ingredient?.category ?? null, batch.batchID, batch.quantity, batch.unit, day(batch.expirationDate), cost ?? null, batch.unitCost !== undefined ? 'Batch' : ingredient?.standardUnitCost !== undefined ? 'Ingredient standard' : null, value, !ingredient ? 'Missing ingredient reference' : value === null ? 'Missing unit cost' : 'Complete'];
      });
      bounded({ columns, rows, dataRows: rows.length, empty: rows.length === 0 });
      rows.push(['SUMMARY', generated(now), null, null, null, null, null, null, null, null, null, unavailable ? null : total, unavailable ? 'Unavailable' : 'Complete']);
      return { columns, rows, dataRows: batches.length, empty: false };
    }
    const waste = await models.waste.find({ dateWasted: { $gte: query.start, $lt: query.end } }).select('batchId ingredientId unit quantityWasted wasteCost dateWasted').lean().exec() as Waste[];
    if (waste.length === 0) return { columns, rows: [], dataRows: 0, empty: true };
    const grouped = new Map<string, { batchId: string; ingredientId: string; unit: string; count: number; quantity: number; cost: number }>();
    for (const row of waste) {
      const batchId = id(row.batchId), ingredientId = id(row.ingredientId), key = JSON.stringify([batchId, ingredientId, row.unit]);
      const item = grouped.get(key) ?? { batchId, ingredientId, unit: row.unit, count: 0, quantity: 0, cost: 0 };
      item.count += 1; item.quantity += row.quantityWasted; item.cost += row.wasteCost; grouped.set(key, item);
    }
    const rows: Cell[][] = [];
    for (const batch of batches.sort((a, b) => a.batchID.localeCompare(b.batchID))) {
      const matching = [...grouped.entries()].filter(([, item]) => item.batchId === id(batch._id) && item.ingredientId === id(batch.ingredientId) && item.unit === batch.unit);
      const found = matching[0]; if (found) grouped.delete(found[0]);
      const item = found?.[1], ingredient = ingredients.get(id(batch.ingredientId));
      rows.push(['BATCH', generated(now), query.from!, query.to!, id(batch.ingredientId), ingredient?.name ?? null, batch.batchID, day(batch.expirationDate), batch.quantity, batch.unit, item?.count ?? 0, item?.quantity ?? 0, item?.cost ?? 0, ingredient ? 'Complete' : 'Missing ingredient reference']);
    }
    for (const item of grouped.values()) {
      const batch = byBatch.get(item.batchId), ingredient = ingredients.get(item.ingredientId);
      rows.push(['ORPHAN_WASTE', generated(now), query.from!, query.to!, item.ingredientId, ingredient?.name ?? null, batch?.batchID ?? null, batch ? day(batch.expirationDate) : null, null, item.unit, item.count, item.quantity, item.cost, !batch ? 'Missing batch reference' : id(batch.ingredientId) !== item.ingredientId ? 'Ingredient reference mismatch' : 'Unit mismatch']);
    }
    bounded({ columns, rows, dataRows: rows.length, empty: waste.length === 0 });
    return { columns, rows, dataRows: rows.length, empty: waste.length === 0 };
  }
  async function audit(actor: { id: string; name?: string; role: ReportActorRole }, query: ReportQuery, dataRows: number, status: 'Success' | 'Failed') {
    await models.audits.create({ userId: actor.id, actorName: actor.name?.trim() || 'Unknown account', actorRole: actor.role, action: 'EXPORT', targetType: 'Report', targetName: query.reportId, exportFormat: 'csv', module: 'Reports & Analytics', status, details: `${query.from ?? 'snapshot'}..${query.to ?? 'snapshot'}; ${dataRows} data rows` });
  }
  async function auditWorkbook(actor: { id: string; name?: string; role: ReportActorRole }, query: ReportQuery, reports: Array<{ reportId: ReportId; dataRows: number }>, status: 'Success' | 'Failed') {
    const combined = reports.length > 1;
    const details = reports.map(report => `${report.reportId} ${report.dataRows} data rows`).join(', ');
    await models.audits.create({ userId: actor.id, actorName: actor.name?.trim() || 'Unknown account', actorRole: actor.role, action: 'EXPORT', targetType: 'Report', targetName: combined ? 'management-workbook' : reports[0]?.reportId ?? 'management-workbook', exportFormat: 'xlsx', module: 'Reports & Analytics', status, details: `${query.from ?? 'snapshot'}..${query.to ?? 'snapshot'}; ${details}` });
  }
  async function recentExports(actorId: string) {
    const records = await models.audits.find({ userId: actorId, actorRole: { $in: ['Manager', 'Admin'] }, action: 'EXPORT', targetType: 'Report', module: 'Reports & Analytics', status: 'Success', targetName: { $in: [...Object.keys(headers), 'management-workbook'] }, exportFormat: 'xlsx', timestamp: { $type: 'date' } })
      .select('targetName exportFormat timestamp details -_id').sort({ timestamp: -1, _id: -1 }).limit(5).lean().exec();
    return records.flatMap(row => {
      const timestamp = new Date(row.timestamp);
      if (Number.isNaN(timestamp.valueOf())) return [];
      const period = /^([^;]+)\.\.([^;]+);/u.exec(row.details ?? '');
      const periodFrom = period?.[1] && /^\d{4}-\d{2}-\d{2}$/u.test(period[1]) ? period[1] : null;
      const periodTo = period?.[2] && /^\d{4}-\d{2}-\d{2}$/u.test(period[2]) ? period[2] : null;
      return [{ reportId: row.targetName as ReportId | 'management-workbook', format: 'xlsx' as const, exportedAt: timestamp.toISOString(), periodFrom, periodTo }];
    });
  }
  return { table, audit, auditWorkbook, recentExports };
}
export type ReportExportService = ReturnType<typeof createReportExports>;
