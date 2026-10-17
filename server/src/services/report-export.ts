import type { inventoryBatchModel } from '../models/inventory-batch';
import type { ingredientModel } from '../models/ingredient';
import type { usageRecordModel } from '../models/usage-record';
import type { wasteRecordModel } from '../models/waste-record';
import type { auditRecordModel } from '../models/audit-record';
import type { ReportQuery, ReportId } from '../validators/report';
import { AdministrationError } from '../middleware/administration.middleware';

type Id = { toString(): string };
type Batch = { _id: Id; ingredientId: Id; batchID: string; quantity: number; unit: string; expirationDate: Date; unitCost?: number };
type Ingredient = { _id: Id; name: string; category: string; standardUnitCost?: number };
type Waste = { batchId: Id; ingredientId: Id; unit: string; quantityWasted: number; wasteCost: number; dateWasted: Date };
type Usage = { ingredientId: Id; unit: string; quantityUsed: number; dateUsed: Date };
type Cell = string | number | null;
type ReportActorRole = 'Manager' | 'Admin';
export type ReportTable = { columns: string[]; rows: Cell[][]; dataRows: number; empty: boolean };

const headers: Record<ReportId, string[]> = {
  'inventory-summary': ['Record Type', 'Generated At (PHT)', 'Ingredient ID', 'Ingredient', 'Category', 'Batch ID', 'Quantity On Hand', 'Unit', 'Expiration Date', 'Unit Cost (PHP)', 'Unit Cost Source', 'Inventory Value (PHP)', 'Valuation Status'],
  'expiration-waste': ['Record Type', 'Generated At (PHT)', 'Period From', 'Period To', 'Ingredient ID', 'Ingredient', 'Batch ID', 'Expiration Date', 'Current Quantity', 'Unit', 'Waste Record Count', 'Quantity Wasted In Period', 'Waste Cost In Period (PHP)', 'Data Status'],
  'usage-consumption': ['Usage Date (PHT)', 'Ingredient ID', 'Ingredient', 'Unit', 'Quantity Used', 'Usage Record Count', 'Data Status'],
};
const day = (value: Date) => new Intl.DateTimeFormat('sv-SE', { timeZone: 'Asia/Manila', year: 'numeric', month: '2-digit', day: '2-digit' }).format(value);
const generated = (value: Date) => new Intl.DateTimeFormat('sv-SE', { timeZone: 'Asia/Manila', dateStyle: 'short', timeStyle: 'medium' }).format(value);
const id = (value: Id) => value.toString();

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
}) {
  async function table(query: ReportQuery, now = new Date()): Promise<ReportTable> {
    const columns = headers[query.reportId];
    const ingredientRows = await models.ingredients.find({}).select('_id name category standardUnitCost').lean().exec() as Ingredient[];
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
  async function ingredientCodesForIds(ids: string[]) {
    const uniqueIds = [...new Set(ids.filter(Boolean))];
    if (!uniqueIds.length) return new Map<string, string>();
    const rows = await models.ingredients.find({ _id: { $in: uniqueIds } }).select('_id ingredientCode').lean().exec() as Array<{ _id: Id; ingredientCode?: string }>;
    return new Map(rows.flatMap(row => typeof row.ingredientCode === 'string' ? [[id(row._id), row.ingredientCode] as const] : []));
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
  return { table, ingredientCodesForIds, audit, auditWorkbook, recentExports };
}
export type ReportExportService = ReturnType<typeof createReportExports>;
