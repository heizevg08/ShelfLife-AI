import type { ClientSession, Mongoose } from 'mongoose';
import type { wasteRecordModel, WASTE_REASONS } from '../models/waste-record';
import type { inventoryBatchModel } from '../models/inventory-batch';
import type { ingredientModel } from '../models/ingredient';
import type { userModel } from '../models/user';
import type { auditRecordModel } from '../models/audit-record';
import { normalizeUserRole } from '../models/user';
import { AdministrationError } from '../middleware/administration.middleware';
import type { Actor } from './administration';
import type { WasteCreateInput, WastePageQuery, WasteReason } from '../validators/waste-record';
import type { WasteReasonBreakdown, WasteRecordStore, WasteRecordView, WasteSummary } from './waste-records';

type Id = { toString(): string };
type WasteRow = { _id: Id; batchId: Id; ingredientId: Id; quantityWasted: number; unit: string; reason: WasteReason; wasteCost: number; dateWasted: Date; recordedBy: Id; createdAt: Date };
type IngredientRow = { _id: Id; name: string; standardUnitCost?: number };
type BatchRow = { _id: Id; ingredientId: Id; batchID: string; quantity: number; unit: string; unitCost?: number };
type UserRow = { _id: Id; name?: string; firstName: string; lastName: string };
type Resolved = { row: WasteRow; ingredient: IngredientRow; batch: BatchRow; staff: UserRow };
const reasons = ['Expired', 'Spoiled', 'Damaged', 'Over-prepared', 'Other'] as const satisfies readonly WasteReason[];

const dayBounds = (now: Date) => {
  const start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  return { start, end: new Date(start.getTime() + 86_400_000) };
};
const staffIdentity = (staff: UserRow) => ({ name: staff.name?.trim() || `${staff.firstName} ${staff.lastName}`.trim() || 'Unknown account', firstName: staff.firstName, lastName: staff.lastName });
const serialize = ({ row, ingredient, batch, staff }: Resolved): WasteRecordView => ({
  id: row._id.toString(), dateWasted: row.dateWasted.toISOString(), ingredient: { id: ingredient._id.toString(), name: ingredient.name },
  batch: { id: batch._id.toString(), batchID: batch.batchID }, quantityWasted: row.quantityWasted, unit: row.unit, reason: row.reason,
  wasteCost: row.wasteCost, recordedBy: { id: staff._id.toString(), ...staffIdentity(staff) }, createdAt: row.createdAt.toISOString(),
});

export function createWasteRecordStore(driver: Mongoose, records: ReturnType<typeof wasteRecordModel>, batches: ReturnType<typeof inventoryBatchModel>, ingredients: ReturnType<typeof ingredientModel>, users: ReturnType<typeof userModel>, audits: ReturnType<typeof auditRecordModel>): WasteRecordStore {
  const resolve = async (): Promise<Resolved[]> => {
    const rows = await records.find({}).sort({ createdAt: -1, _id: -1 }).lean().exec() as WasteRow[];
    const ingredientIds = [...new Set(rows.map(row => row.ingredientId.toString()))];
    const batchIds = [...new Set(rows.map(row => row.batchId.toString()))];
    const staffIds = [...new Set(rows.map(row => row.recordedBy.toString()))];
    const [ingredientRows, batchRows, staffRows] = await Promise.all([
      ingredients.find({ _id: { $in: ingredientIds } }).select('_id name standardUnitCost').lean().exec() as Promise<IngredientRow[]>,
      batches.find({ _id: { $in: batchIds } }).select('_id ingredientId batchID quantity unit unitCost').lean().exec() as Promise<BatchRow[]>,
      users.find({ _id: { $in: staffIds } }).select('_id name firstName lastName').lean().exec() as Promise<UserRow[]>,
    ]);
    const ingredientsById = new Map(ingredientRows.map(row => [row._id.toString(), row]));
    const batchesById = new Map(batchRows.map(row => [row._id.toString(), row]));
    const staffById = new Map(staffRows.map(row => [row._id.toString(), row]));
    return rows.flatMap(row => {
      const ingredient = ingredientsById.get(row.ingredientId.toString());
      const batch = batchesById.get(row.batchId.toString());
      const staff = staffById.get(row.recordedBy.toString());
      return ingredient && batch && staff ? [{ row, ingredient, batch, staff }] : [];
    });
  };
  const filtered = (items: Resolved[], query: WastePageQuery) => {
    const search = query.search?.toLocaleLowerCase();
    return items.filter(item => (!search || item.ingredient.name.toLocaleLowerCase().includes(search) || item.batch.batchID.toLocaleLowerCase().includes(search))
      && (!query.reason || item.row.reason === query.reason)
      && (!query.ingredientId || item.ingredient._id.toString() === query.ingredientId)
      && (!query.from || item.row.dateWasted >= query.from)
      && (!query.to || item.row.dateWasted <= query.to));
  };
  const resolveCost = (batch: BatchRow, ingredient: IngredientRow) => {
    const source = batch.unitCost !== undefined ? 'batch unit cost' : 'ingredient standard unit cost';
    const value = batch.unitCost ?? ingredient.standardUnitCost;
    if (typeof value !== 'number' || !Number.isFinite(value) || value < 0) throw new AdministrationError(400, 'VALIDATION_ERROR', 'Check the supplied fields', [{ field: 'batchId', message: 'A valid unit cost is required to record waste for this batch' }]);
    return { source, value };
  };
  const createManyWithin = async (session: ClientSession, actor: Actor, inputs: WasteCreateInput[]) => {
    const ingredientIds = [...new Set(inputs.map(input => input.ingredientId))];
    const batchIds = [...new Set(inputs.map(input => input.batchId))];
    const ingredientRows = await ingredients.find({ _id: { $in: ingredientIds } }).select('_id name standardUnitCost').session(session).lean().exec() as IngredientRow[];
    const batchRows = await batches.find({ _id: { $in: batchIds } }).select('_id ingredientId batchID quantity unit unitCost').session(session).lean().exec() as BatchRow[];
    const ingredientsById = new Map(ingredientRows.map(row => [row._id.toString(), row]));
    const batchesById = new Map(batchRows.map(row => [row._id.toString(), row]));
    const deductions = new Map<string, number>();
    const firstRowByBatch = new Map<string, number>();
    const costs = inputs.map((input, index) => {
      const ingredient = ingredientsById.get(input.ingredientId);
      const batch = batchesById.get(input.batchId);
      if (!ingredient) throw new AdministrationError(404, 'NOT_FOUND', 'Ingredient not found', [{ field: `items.${index}.ingredientId`, message: 'Ingredient not found' }]);
      if (!batch) throw new AdministrationError(404, 'NOT_FOUND', 'Inventory batch not found', [{ field: `items.${index}.batchId`, message: 'Inventory batch not found' }]);
      if (batch.ingredientId.toString() !== ingredient._id.toString()) throw new AdministrationError(400, 'VALIDATION_ERROR', 'Check the supplied fields', [{ field: `items.${index}.batchId`, message: 'Selected batch does not belong to the ingredient' }]);
      if (!firstRowByBatch.has(input.batchId)) firstRowByBatch.set(input.batchId, index);
      deductions.set(input.batchId, (deductions.get(input.batchId) ?? 0) + input.quantityWasted);
      return resolveCost(batch, ingredient);
    });
    for (const [batchId, quantity] of deductions) {
      const deducted = await batches.findOneAndUpdate({ _id: batchId, quantity: { $gte: quantity } }, { $inc: { quantity: -quantity } }, { new: true, session }).lean().exec() as BatchRow | null;
      if (!deducted) throw new AdministrationError(400, 'VALIDATION_ERROR', 'Check the supplied fields', [{ field: `items.${firstRowByBatch.get(batchId) ?? 0}.quantityWasted`, message: 'Combined waste exceeds the available quantity for the selected batch' }]);
    }
    const ids: string[] = [];
    for (let index = 0; index < inputs.length; index += 1) {
      const input = inputs[index]!, batch = batchesById.get(input.batchId)!, unitCost = costs[index]!;
      const created = await records.create([{ batchId: input.batchId, ingredientId: input.ingredientId, quantityWasted: input.quantityWasted, unit: batch.unit, reason: input.reason, wasteCost: input.quantityWasted * unitCost.value, dateWasted: input.dateWasted, recordedBy: new driver.Types.ObjectId(actor.id) }], { session });
      const row = created[0] as unknown as WasteRow;
      ids.push(row._id.toString());
      await audits.create([{ userId: actor.id, actorName: actor.name?.trim() || 'Unknown account', actorRole: normalizeUserRole(actor.role) ?? undefined, action: 'CREATE', targetType: 'WasteRecord', targetId: row._id.toString(), targetName: batch.batchID, module: 'Waste Recording', status: 'Success', details: `Inventory waste recorded and batch quantity deducted using ${unitCost.source}` }], { session });
    }
    return ids;
  };
  return {
    async ready() { await Promise.all([records.collection.createIndex({ createdAt: -1, _id: -1 }, { name: 'createdAt_-1__id_-1' }), records.collection.createIndex({ ingredientId: 1, dateWasted: -1 }, { name: 'ingredientId_1_dateWasted_-1' }), records.collection.createIndex({ reason: 1, dateWasted: -1 }, { name: 'reason_1_dateWasted_-1' })]); },
    async list(query) { const items = filtered(await resolve(), query); const start = (query.page - 1) * query.pageSize; return { items: items.slice(start, start + query.pageSize).map(serialize), page: query.page, pageSize: query.pageSize, total: items.length }; },
    async detail(id) { const item = (await resolve()).find(candidate => candidate.row._id.toString() === id); return item ? serialize(item) : null; },
    async summary(now) {
      const items = await resolve(), today = dayBounds(now);
      const todayItems = items.filter(item => item.row.dateWasted >= today.start && item.row.dateWasted < today.end);
      const units = new Set(todayItems.map(item => item.row.unit));
      const totalWasteToday = units.size === 1 ? { quantity: todayItems.reduce((total, item) => total + item.row.quantityWasted, 0), unit: todayItems[0]!.row.unit } : null;
      const mostWastedIngredient = units.size === 1 && todayItems.length ? [...todayItems.reduce((totals, item) => totals.set(item.ingredient.name, (totals.get(item.ingredient.name) ?? 0) + item.row.quantityWasted), new Map<string, number>()).entries()].sort(([leftName, left], [rightName, right]) => right - left || leftName.localeCompare(rightName))[0]![0] : null;
      const reasonCounts = todayItems.reduce((counts, item) => counts.set(item.row.reason, (counts.get(item.row.reason) ?? 0) + 1), new Map<WasteReason, number>());
      const commonWasteReason = reasons.reduce<WasteReason | null>((best, reason) => !best || (reasonCounts.get(reason) ?? 0) > (reasonCounts.get(best) ?? 0) ? reason : best, null);
      return { totalWasteToday, wasteRecordsToday: todayItems.length, mostWastedIngredient, commonWasteReason: todayItems.length ? commonWasteReason : null, totalWasteCostToday: todayItems.reduce((total, item) => total + item.row.wasteCost, 0) } satisfies WasteSummary;
    },
    async reasonBreakdown(now) {
      const start = new Date(dayBounds(now).start.getTime() - 29 * 86_400_000);
      const counts = Object.fromEntries(reasons.map(reason => [reason, 0])) as Record<WasteReason, number>;
      for (const item of await resolve()) if (item.row.dateWasted >= start) counts[item.row.reason] += 1;
      return { period: 'Last 30 Days', counts, total: Object.values(counts).reduce((sum, count) => sum + count, 0) } satisfies WasteReasonBreakdown;
    },
    async create(actor, input) {
      try { return (await this.createMany(actor, [input]))[0]!; }
      catch (error) {
        if (error instanceof AdministrationError) throw new AdministrationError(error.status, error.code, error.message, error.details.map(detail => ({ ...detail, field: detail.field.replace(/^items\.0\.?/, '') || 'quantityWasted' })));
        throw error;
      }
    },
    async createMany(actor, inputs) { const ids = await driver.connection.transaction(session => createManyWithin(session, actor, inputs)); const created = await Promise.all(ids.map(id => this.detail(id))); if (created.some(record => !record)) throw new AdministrationError(500, 'REQUEST_FAILED', 'Waste records could not be loaded'); return created as WasteRecordView[]; },
  };
}
