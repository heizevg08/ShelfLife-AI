import type { ClientSession, Mongoose } from 'mongoose';
import type { usageRecordModel } from '../models/usage-record';
import type { inventoryBatchModel } from '../models/inventory-batch';
import type { ingredientModel } from '../models/ingredient';
import type { userModel } from '../models/user';
import type { auditRecordModel } from '../models/audit-record';
import { normalizeUserRole } from '../models/user';
import { AdministrationError } from '../middleware/administration.middleware';
import type { Actor } from './administration';
import type { UsageCreateInput, UsagePageQuery } from '../validators/usage-record';
import type { UsageRecordStore, UsageRecordView, UsageSummary } from './usage-records';

type Id = { toString(): string };
type UsageRow = { _id: Id; batchId: Id; ingredientId: Id; quantityUsed: number; unit: string; dateUsed: Date; staffId: Id; createdAt: Date };
type IngredientRow = { _id: Id; name: string; unitOfMeasure: string };
type BatchRow = { _id: Id; ingredientId: Id; batchID: string; quantity: number; unit: string };
type UserRow = { _id: Id; name?: string; firstName: string; lastName: string };
type Resolved = { row: UsageRow; ingredient: IngredientRow; batch: BatchRow; staff: UserRow };

const dayBounds = (now: Date) => {
  const start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  return { start, end: new Date(start.getTime() + 86_400_000) };
};
const staffIdentity = (staff: UserRow) => ({ name: staff.name?.trim() || `${staff.firstName} ${staff.lastName}`.trim() || 'Unknown account', firstName: staff.firstName, lastName: staff.lastName });
const serialize = ({ row, ingredient, batch, staff }: Resolved): UsageRecordView => ({
  id: row._id.toString(), dateUsed: row.dateUsed.toISOString(), ingredient: { id: ingredient._id.toString(), name: ingredient.name },
  batch: { id: batch._id.toString(), batchID: batch.batchID }, quantityUsed: row.quantityUsed, unit: row.unit,
  recordedBy: { id: staff._id.toString(), ...staffIdentity(staff) }, createdAt: row.createdAt.toISOString(),
});

export function createUsageRecordStore(driver: Mongoose, records: ReturnType<typeof usageRecordModel>, batches: ReturnType<typeof inventoryBatchModel>, ingredients: ReturnType<typeof ingredientModel>, users: ReturnType<typeof userModel>, audits: ReturnType<typeof auditRecordModel>): UsageRecordStore {
  const resolve = async (): Promise<Resolved[]> => {
    const rows = await records.find({}).sort({ dateUsed: -1, _id: -1 }).lean().exec() as UsageRow[];
    const ingredientIds = [...new Set(rows.map(row => row.ingredientId.toString()))];
    const batchIds = [...new Set(rows.map(row => row.batchId.toString()))];
    const staffIds = [...new Set(rows.map(row => row.staffId.toString()))];
    const [ingredientRows, batchRows, staffRows] = await Promise.all([
      ingredients.find({ _id: { $in: ingredientIds } }).select('_id name unitOfMeasure').lean().exec() as Promise<IngredientRow[]>,
      batches.find({ _id: { $in: batchIds } }).select('_id ingredientId batchID quantity unit').lean().exec() as Promise<BatchRow[]>,
      users.find({ _id: { $in: staffIds } }).select('_id name firstName lastName').lean().exec() as Promise<UserRow[]>,
    ]);
    const ingredientsById = new Map(ingredientRows.map(row => [row._id.toString(), row]));
    const batchesById = new Map(batchRows.map(row => [row._id.toString(), row]));
    const staffById = new Map(staffRows.map(row => [row._id.toString(), row]));
    return rows.flatMap(row => {
      const ingredient = ingredientsById.get(row.ingredientId.toString());
      const batch = batchesById.get(row.batchId.toString());
      const staff = staffById.get(row.staffId.toString());
      return ingredient && batch && staff ? [{ row, ingredient, batch, staff }] : [];
    });
  };
  const filtered = (items: Resolved[], query: UsagePageQuery) => {
    const search = query.search?.toLocaleLowerCase();
    return items.filter(item => (!search || item.ingredient.name.toLocaleLowerCase().includes(search) || item.batch.batchID.toLocaleLowerCase().includes(search))
      && (!query.ingredientId || item.ingredient._id.toString() === query.ingredientId)
      && (!query.from || item.row.dateUsed >= query.from)
      && (!query.to || item.row.dateUsed <= query.to));
  };
  const createWithin = async (session: ClientSession, actor: Actor, input: UsageCreateInput) => {
    const ingredient = await ingredients.findById(input.ingredientId).select('_id name unitOfMeasure').session(session).lean().exec() as IngredientRow | null;
    if (!ingredient) throw new AdministrationError(404, 'NOT_FOUND', 'Ingredient not found');
    const batch = await batches.findById(input.batchId).select('_id ingredientId batchID quantity unit').session(session).lean().exec() as BatchRow | null;
    if (!batch) throw new AdministrationError(404, 'NOT_FOUND', 'Inventory batch not found');
    if (batch.ingredientId.toString() !== ingredient._id.toString()) throw new AdministrationError(400, 'VALIDATION_ERROR', 'Check the supplied fields', [{ field: 'batchId', message: 'Selected batch does not belong to the ingredient' }]);
    const deducted = await batches.findOneAndUpdate({ _id: input.batchId, ingredientId: input.ingredientId, quantity: { $gte: input.quantityUsed } }, { $inc: { quantity: -input.quantityUsed } }, { new: true, session }).lean().exec() as BatchRow | null;
    if (!deducted) throw new AdministrationError(400, 'VALIDATION_ERROR', 'Check the supplied fields', [{ field: 'quantityUsed', message: 'Quantity used exceeds the available batch quantity' }]);
    const created = await records.create([{ batchId: input.batchId, ingredientId: input.ingredientId, quantityUsed: input.quantityUsed, unit: batch.unit, dateUsed: input.dateUsed, staffId: new driver.Types.ObjectId(actor.id) }], { session });
    const row = created[0] as unknown as UsageRow;
    await audits.create([{ userId: actor.id, actorName: actor.name?.trim() || 'Unknown account', actorRole: normalizeUserRole(actor.role) ?? undefined, action: 'CREATE', targetType: 'UsageRecord', targetId: row._id.toString(), targetName: batch.batchID, module: 'Usage Recording', status: 'Success', details: 'Inventory usage recorded and batch quantity deducted' }], { session });
    return row._id.toString();
  };
  return {
    async ready() { await Promise.all([records.collection.createIndex({ dateUsed: -1, _id: -1 }, { name: 'dateUsed_-1__id_-1' }), records.collection.createIndex({ ingredientId: 1, dateUsed: -1 }, { name: 'ingredientId_1_dateUsed_-1' })]); },
    async list(query) { const items = filtered(await resolve(), query); const start = (query.page - 1) * query.pageSize; return { items: items.slice(start, start + query.pageSize).map(serialize), page: query.page, pageSize: query.pageSize, total: items.length }; },
    async detail(id) { const item = (await resolve()).find(candidate => candidate.row._id.toString() === id); return item ? serialize(item) : null; },
    async summary(now) {
      const items = await resolve(); const today = dayBounds(now); const todayItems = items.filter(item => item.row.dateUsed >= today.start && item.row.dateUsed < today.end);
      const units = new Set(todayItems.map(item => item.row.unit));
      const totalUsageToday = units.size === 1 ? { quantity: todayItems.reduce((total, item) => total + item.row.quantityUsed, 0), unit: todayItems[0]!.row.unit } : null;
      const weekStart = new Date(today.start.getTime() - ((today.start.getUTCDay() + 6) % 7) * 86_400_000);
      // A cross-unit "most used" ranking is invalid until the product defines unit normalization.
      return { totalUsageToday, usageRecordsToday: todayItems.length, mostUsedIngredient: null, ingredientsUsedThisWeek: new Set(items.filter(item => item.row.dateUsed >= weekStart && item.row.dateUsed < today.end).map(item => item.row.ingredientId.toString())).size } satisfies UsageSummary;
    },
    async create(actor, input) { const id = await driver.connection.transaction(session => createWithin(session, actor, input)); const record = await this.detail(id); if (!record) throw new AdministrationError(500, 'REQUEST_FAILED', 'Usage record could not be loaded'); return record; },
  };
}
