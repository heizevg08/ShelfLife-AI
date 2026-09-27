import type { ClientSession, Mongoose } from 'mongoose';
import type { inventoryBatchModel } from '../models/inventory-batch';
import type { inventoryBatchCounterModel } from '../models/inventory-batch-counter';
import type { ingredientModel } from '../models/ingredient';
import type { userModel } from '../models/user';
import type { auditRecordModel } from '../models/audit-record';
import type { InventoryBatch, InventoryBatchStore } from './inventory-batches';
import type { InventoryBatchDisplayStatus, InventoryBatchPageQuery, StockInInput } from '../validators/inventory-batch';
import type { Actor } from './administration';
import { normalizeUserRole } from '../models/user';

type BatchRow = { _id: { toString(): string }; ingredientId: { toString(): string }; batchID: string; quantity: number; unit: string; dateReceived: Date; expirationDate: Date; unitCost?: number; status?: string; createdBy: { toString(): string }; createdAt: Date; updatedAt: Date };
type IngredientRow = { _id: { toString(): string }; name: string; category: string; unitOfMeasure: string; minimumStock?: number };
type Resolved = { row: BatchRow; ingredient: IngredientRow; totalStock: number; displayStatus: InventoryBatchDisplayStatus; creatorName: string };

export function deriveInventoryBatchDisplayStatus(expirationDate: Date, totalStock: number, minimumStock: number | undefined, now: Date): InventoryBatchDisplayStatus {
  if (expirationDate < now) return 'Expired';
  if (expirationDate <= new Date(now.getTime() + 7 * 86_400_000)) return 'Near Expiry';
  return minimumStock !== undefined && totalStock <= minimumStock ? 'Low Stock' : 'In Stock';
}
export function formatInventoryBatchID(dateReceived: Date, sequence: number) {
  const date = `${dateReceived.getUTCFullYear()}${String(dateReceived.getUTCMonth() + 1).padStart(2, '0')}${String(dateReceived.getUTCDate()).padStart(2, '0')}`;
  return `SL-${date}-${String(sequence).padStart(3, '0')}`;
}

export async function reserveInventoryBatchID(dateReceived: Date, increment: (key: string) => Promise<number>) {
  const key = `${dateReceived.getUTCFullYear()}${String(dateReceived.getUTCMonth() + 1).padStart(2, '0')}${String(dateReceived.getUTCDate()).padStart(2, '0')}`;
  return formatInventoryBatchID(dateReceived, await increment(key));
}

export function createInventoryBatchStore(driver: Mongoose, batches: ReturnType<typeof inventoryBatchModel>, counters: ReturnType<typeof inventoryBatchCounterModel>, ingredients: ReturnType<typeof ingredientModel>, users: ReturnType<typeof userModel>, audits: ReturnType<typeof auditRecordModel>): InventoryBatchStore {
  const resolve = async (now: Date): Promise<Resolved[]> => {
    const rows = await batches.find({}).sort({ createdAt: -1, _id: -1 }).lean().exec() as BatchRow[];
    const ingredientIds = [...new Set(rows.map(row => row.ingredientId.toString()))], creatorIds = [...new Set(rows.map(row => row.createdBy.toString()))];
    const [ingredientRows, creatorRows] = await Promise.all([
      ingredients.find({ _id: { $in: ingredientIds } }).select('_id name category unitOfMeasure minimumStock').lean().exec() as Promise<IngredientRow[]>,
      users.find({ _id: { $in: creatorIds } }).select('_id firstName lastName').lean().exec(),
    ]);
    const byId = new Map(ingredientRows.map(row => [row._id.toString(), row]));
    const creators = new Map(creatorRows.map(row => [row._id.toString(), `${row.firstName} ${row.lastName}`.trim()]));
    const totals = new Map<string, number>();
    for (const row of rows) totals.set(row.ingredientId.toString(), (totals.get(row.ingredientId.toString()) ?? 0) + row.quantity);
    return rows.flatMap(row => {
      const ingredient = byId.get(row.ingredientId.toString()); if (!ingredient) return [];
      const totalStock = totals.get(row.ingredientId.toString()) ?? 0;
      return [{ row, ingredient, totalStock, displayStatus: deriveInventoryBatchDisplayStatus(row.expirationDate, totalStock, ingredient.minimumStock, now), creatorName: creators.get(row.createdBy.toString()) ?? 'Unknown account' }];
    });
  };
  const serialize = ({ row, ingredient, displayStatus, creatorName }: Resolved): InventoryBatch => ({
    id: row._id.toString(), batchID: row.batchID,
    ingredient: { id: ingredient._id.toString(), name: ingredient.name, category: ingredient.category, unitOfMeasure: ingredient.unitOfMeasure, ...(ingredient.minimumStock !== undefined ? { minimumStock: ingredient.minimumStock } : {}) },
    quantity: row.quantity, unit: row.unit, dateReceived: row.dateReceived.toISOString(), expirationDate: row.expirationDate.toISOString(),
    ...(row.unitCost !== undefined ? { unitCost: row.unitCost } : {}), ...(row.status ? { persistedStatus: row.status } : {}), displayStatus,
    createdBy: { id: row.createdBy.toString(), name: creatorName }, createdAt: row.createdAt.toISOString(), updatedAt: row.updatedAt.toISOString(),
  });
  const filtered = (rows: Resolved[], query: InventoryBatchPageQuery) => rows.filter(item => {
    const search = query.search?.toLocaleLowerCase();
    return (!search || item.ingredient.name.toLocaleLowerCase().includes(search) || item.row.batchID.toLocaleLowerCase().includes(search))
      && (!query.category || item.ingredient.category === query.category) && (!query.status || item.displayStatus === query.status)
      && (!query.ingredientId || item.ingredient._id.toString() === query.ingredientId)
      && (!query.from || item.row.dateReceived >= query.from) && (!query.to || item.row.dateReceived <= query.to);
  });
  const createWithin = async (session: ClientSession, actor: Actor, input: StockInInput): Promise<string | null> => {
    const ingredient = await ingredients.findById(input.ingredientId).select('_id name category unitOfMeasure minimumStock').session(session).lean().exec() as IngredientRow | null;
    if (!ingredient) return null;
    const batchID = await reserveInventoryBatchID(input.dateReceived, async key => {
      const counter = await counters.findByIdAndUpdate(key, { $inc: { sequence: 1 } }, { upsert: true, new: true, setDefaultsOnInsert: true, session }).lean().exec();
      return counter!.sequence;
    });
    const created = await batches.create([{ ingredientId: input.ingredientId, batchID, quantity: input.quantity, unit: ingredient.unitOfMeasure, dateReceived: input.dateReceived, expirationDate: input.expirationDate, ...(input.unitCost !== undefined ? { unitCost: input.unitCost } : {}), createdBy: actor.id }], { session });
    const row = created[0] as unknown as BatchRow;
    await audits.create([{ userId: actor.id, actorName: actor.name?.trim() || 'Unknown account', actorRole: normalizeUserRole(actor.role) ?? undefined, action: 'CREATE', targetType: 'InventoryBatch', targetId: row._id.toString(), targetName: batchID, module: 'Stock-In', status: 'Success', details: 'Inventory batch received through Stock-In' }], { session });
    return row._id.toString();
  };
  return {
    async ready() { await batches.collection.createIndex({ batchID: 1 }, { unique: true, name: 'batchID_1', collation: { locale: 'en', strength: 2 } }); },
    async list(query, now) { const rows = filtered(await resolve(now), query), start = (query.page - 1) * query.pageSize; return { items: rows.slice(start, start + query.pageSize).map(serialize), page: query.page, pageSize: query.pageSize, total: rows.length }; },
    async detail(id, now) { const item = (await resolve(now)).find(candidate => candidate.row._id.toString() === id); return item ? serialize(item) : null; },
    async summary(now) { const rows = await resolve(now), ingredientRows = new Map(rows.map(item => [item.ingredient._id.toString(), item])); return { totalIngredients: ingredientRows.size, lowStockItems: [...ingredientRows.values()].filter(item => item.ingredient.minimumStock !== undefined && item.totalStock <= item.ingredient.minimumStock).length, nearExpiry: rows.filter(item => item.displayStatus === 'Near Expiry').length, expiredItems: rows.filter(item => item.displayStatus === 'Expired').length, categories: [...new Set(rows.map(item => item.ingredient.category))].sort((a, b) => a.localeCompare(b)) }; },
    async stockInSummary(now) {
      const rows = await resolve(now), dayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()), dayEnd = new Date(dayStart.getTime() + 86_400_000), monthStart = new Date(now.getFullYear(), now.getMonth(), 1), monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 1);
      const today = rows.filter(item => item.row.dateReceived >= dayStart && item.row.dateReceived < dayEnd);
      return { totalBatches: rows.length, stockInToday: today.length, ingredientsReceivedToday: new Set(today.map(item => item.ingredient._id.toString())).size, batchesReceivedThisMonth: rows.filter(item => item.row.dateReceived >= monthStart && item.row.dateReceived < monthEnd).length, expiringSoonBatches: rows.filter(item => item.row.expirationDate >= now && item.row.expirationDate <= new Date(now.getTime() + 7 * 86_400_000)).length };
    },
    async create(actor, input) {
      const id = await driver.connection.transaction(session => createWithin(session, actor, input));
      return id ? this.detail(id, new Date()) : null;
    },
  };
}
