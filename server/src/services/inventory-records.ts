import type { Mongoose, Types } from 'mongoose';
import type { inventoryRecordModel, RecordKind } from '../models/inventory-record';
import type { inventoryBatchModel } from '../models/inventory-batch';
import type { ingredientModel } from '../models/ingredient';
import type { auditRecordModel } from '../models/audit-record';
import { auditSnapshot } from './audit-snapshot';
import { recordArchiveInput, recordCorrectionInput, recordCreateInput, recordPagination } from '../validators/inventory-record';
import { decimal, decimalUnits, storedDecimal, versionConflict } from '../validators/inventory-contract';
import { objectId } from '../validators/administration';
import { AdministrationError, forbidden } from '../middleware/administration.middleware';

type Actor = { id: string; role: string };
type Batch = { _id: Types.ObjectId; ingredientId: Types.ObjectId; quantity: Types.Decimal128; initialQuantity: Types.Decimal128; unit: string; unitCost: Types.Decimal128; isActive: boolean; version: number };
type Row = { _id: Types.ObjectId; ingredientId: Types.ObjectId; batchId: Types.ObjectId; quantity: Types.Decimal128; unit: string; unitCostSnapshot: Types.Decimal128; totalCostSnapshot: Types.Decimal128; recordedBy: Types.ObjectId; recordedAt: string; notes: string; reason?: string; correctionOf?: Types.ObjectId | null; type: 'original' | 'correction'; isActive: boolean; version: number; createdAt: Date; updatedAt: Date };
type RecordModel = ReturnType<typeof inventoryRecordModel>;
const notFound = (label: string) => new AdministrationError(404, 'NOT_FOUND', `${label} not found`);
const manager = (actor: Actor) => { if (actor.role !== 'Inventory Manager') throw forbidden(); };
const creator = (actor: Actor) => { if (!['Inventory Manager', 'Inventory Staff'].includes(actor.role)) throw forbidden(); };
const reader = (actor: Actor) => { if (!['Inventory Manager', 'Admin', 'Super Admin'].includes(actor.role)) throw forbidden(); };

function fixed(units: bigint, scale: number) {
  const denominator = 10n ** BigInt(scale), whole = units / denominator, fraction = (units % denominator).toString().padStart(scale, '0');
  return `${whole}.${fraction}`;
}
export function recordTotalCost(quantity: string, unitCost: string) {
  const raw = decimalUnits(quantity) * decimalUnits(unitCost); // 3 + 4 decimal places
  const divisor = 100000n, rounded = (raw + (divisor / 2n)) / divisor; // final 2-place half-up rounding
  return fixed(rounded, 2);
}
function serialize(row: Row) {
  return { id: row._id.toString(), ingredientId: row.ingredientId.toString(), batchId: row.batchId.toString(), quantity: storedDecimal(row.quantity, 3), unit: row.unit,
    unitCostSnapshot: storedDecimal(row.unitCostSnapshot, 4), totalCostSnapshot: storedDecimal(row.totalCostSnapshot, 2), recordedBy: row.recordedBy.toString(), recordedAt: row.recordedAt,
    notes: row.notes, ...(row.reason ? { reason: row.reason } : {}), ...(row.correctionOf ? { correctionOf: row.correctionOf.toString() } : {}), type: row.type,
    isActive: row.isActive, version: row.version, createdAt: row.createdAt.toISOString(), updatedAt: row.updatedAt.toISOString() };
}
function change(current: string, next: string) { return decimalUnits(next) - decimalUnits(current); }

export function createInventoryRecords(driver: Mongoose, kind: RecordKind, rows: RecordModel, batches: ReturnType<typeof inventoryBatchModel>, ingredients: ReturnType<typeof ingredientModel>, audits: ReturnType<typeof auditRecordModel>) {
  const label = kind === 'UsageRecord' ? 'Usage record' : 'Waste record';
  const targetType = kind;
  const action = (event: 'Created' | 'Corrected' | 'Voided') => `${kind}${event}`;
  const snapshot = (row: Row) => auditSnapshot(targetType, serialize(row));
  const updateBatch = async (session: Parameters<Mongoose['connection']['transaction']>[0] extends (session: infer T) => unknown ? T : never, batch: Batch, delta: bigint, expectedVersion?: number) => {
    const current = decimalUnits(storedDecimal(batch.quantity, 3)), initial = decimalUnits(storedDecimal(batch.initialQuantity, 3)), next = current + delta;
    if (next < 0n) throw new AdministrationError(400, 'VALIDATION_ERROR', 'Check the supplied fields', [{ field: 'quantity', message: 'Quantity exceeds the available batch quantity' }]);
    if (next > initial) throw new AdministrationError(400, 'VALIDATION_ERROR', 'Check the supplied fields', [{ field: 'quantity', message: 'Quantity cannot exceed the batch initial quantity' }]);
    const version = expectedVersion ?? batch.version;
    const updated = await batches.findOneAndUpdate({ _id: batch._id, isActive: true, version }, { $set: { quantity: fixed(next, 3), version: version + 1 } }, { session, returnDocument: 'after', runValidators: true }).lean().exec() as Batch | null;
    if (!updated) throw versionConflict();
    return updated;
  };
  const activeSource = async (session: Parameters<Mongoose['connection']['transaction']>[0] extends (session: infer T) => unknown ? T : never, ingredientId: string, batchId: string) => {
    const [ingredient, batch] = await Promise.all([
      ingredients.findOne({ _id: ingredientId, isActive: { $ne: false } }).session(session).lean().exec(),
      batches.findOne({ _id: batchId, ingredientId, isActive: true }).session(session).lean().exec() as Promise<Batch | null>,
    ]);
    if (!ingredient || !batch) throw new AdministrationError(404, 'NOT_FOUND', 'Active ingredient or batch not found');
    return batch;
  };
  return {
    async list(actor: Actor, query: Record<string, unknown>) {
      reader(actor);
      const page = recordPagination(query), filter: Record<string, unknown> = { ...(page.includeArchived ? {} : { isActive: true }) };
      for (const field of ['ingredientId', 'batchId', 'recordedBy'] as const) if (page[field]) filter[field] = page[field];
      if (page.from || page.to) filter.recordedAt = { ...(page.from ? { $gte: page.from } : {}), ...(page.to ? { $lte: page.to } : {}) };
      const [items, total] = await Promise.all([
        rows.find(filter).sort({ recordedAt: -1, _id: -1 }).skip((page.page - 1) * page.limit).limit(page.limit).lean().exec() as Promise<Row[]>, rows.countDocuments(filter).exec(),
      ]);
      return { items: items.map(serialize), page: page.page, limit: page.limit, total };
    },
    async get(actor: Actor, id: string) {
      reader(actor);
      const row = await rows.findById(objectId(id)).lean().exec() as Row | null;
      if (!row) throw notFound(label);
      return serialize(row);
    },
    async eligibleBatches(actor: Actor, ingredientId: string, query: Record<string, unknown> = {}) {
      creator(actor);
      const page = recordPagination(query);
      const activeIngredient = await ingredients.findOne({ _id: objectId(ingredientId), isActive: { $ne: false } }).lean().exec();
      if (!activeIngredient) throw new AdministrationError(404, 'NOT_FOUND', 'Active ingredient not found');
      const filter = { ingredientId, isActive: true, quantity: { $gt: '0.000' } } as never;
      const [candidates, total] = await Promise.all([
        batches.find(filter).sort({ expirationDate: 1, dateReceived: 1, _id: 1 }).skip((page.page - 1) * page.limit).limit(page.limit).lean().exec() as Promise<Batch[]>,
        batches.countDocuments(filter).exec(),
      ]);
      return { items: candidates.map(batch => ({ id: batch._id.toString(), ingredientId: batch.ingredientId.toString(), quantity: storedDecimal(batch.quantity, 3), unit: batch.unit, unitCost: storedDecimal(batch.unitCost, 4) })), page: page.page, limit: page.limit, total };
    },
    async create(actor: Actor, body: unknown) {
      creator(actor);
      const input = recordCreateInput(kind, body);
      const row = await driver.connection.transaction(async session => {
        const batch = await activeSource(session, input.ingredientId, input.batchId);
        const unitCost = storedDecimal(batch.unitCost, 4), total = recordTotalCost(input.quantity, unitCost);
        await updateBatch(session, batch, -decimalUnits(input.quantity));
        const [created] = await (rows as any).create([{ ...input, unit: batch.unit, unitCostSnapshot: unitCost, totalCostSnapshot: total, recordedBy: actor.id, type: 'original' }], { session });
        const value = created.toObject() as Row;
        await audits.create([{ userId: actor.id, action: 'CREATE', targetType, targetId: value._id, reason: action('Created'), oldValue: null, newValue: snapshot(value) }], { session });
        return value;
      });
      return serialize(row);
    },
    async correct(actor: Actor, id: string, body: unknown) {
      manager(actor);
      const input = recordCorrectionInput(body);
      const row = await driver.connection.transaction(async session => {
        const original = await rows.findById(objectId(id)).session(session).lean().exec() as Row | null;
        if (!original || !original.isActive || original.type !== 'original') throw notFound(label);
        const batch = await activeSource(session, original.ingredientId.toString(), original.batchId.toString());
        if (batch.version !== input.expectedVersion) throw versionConflict();
        const previous = await rows.findOne({ correctionOf: original._id, isActive: true }).sort({ createdAt: -1, _id: -1 }).session(session).lean().exec() as Row | null;
        const previousQuantity = previous ? storedDecimal(previous.quantity, 3) : storedDecimal(original.quantity, 3);
        const delta = change(previousQuantity, input.correctedQuantity);
        const unitCost = storedDecimal(batch.unitCost, 4), total = recordTotalCost(input.correctedQuantity, unitCost);
        await updateBatch(session, batch, delta, input.expectedVersion);
        const [created] = await (rows as any).create([{ ingredientId: original.ingredientId, batchId: original.batchId, quantity: input.correctedQuantity, unit: original.unit, unitCostSnapshot: unitCost, totalCostSnapshot: total, recordedBy: actor.id, recordedAt: original.recordedAt, notes: input.reason, ...(kind === 'WasteRecord' ? { reason: original.reason } : {}), correctionOf: original._id, type: 'correction' }], { session });
        const value = created.toObject() as Row;
        await audits.create([{ userId: actor.id, action: 'UPDATE', targetType, targetId: value._id, reason: action('Corrected'), oldValue: snapshot(previous ?? original), newValue: snapshot(value) }], { session });
        return value;
      });
      return serialize(row);
    },
    async archive(actor: Actor, id: string, body: unknown) {
      manager(actor);
      const expected = recordArchiveInput(body);
      return driver.connection.transaction(async session => {
        const original = await rows.findById(objectId(id)).session(session).lean().exec() as Row | null;
        if (!original || !original.isActive || original.type !== 'original') throw notFound(label);
        const batch = await activeSource(session, original.ingredientId.toString(), original.batchId.toString());
        if (batch.version !== expected) throw versionConflict();
        const latest = await rows.findOne({ correctionOf: original._id, isActive: true }).sort({ createdAt: -1, _id: -1 }).session(session).lean().exec() as Row | null;
        const restore = decimalUnits(storedDecimal((latest ?? original).quantity, 3));
        await updateBatch(session, batch, restore, expected);
        const after = await rows.findOneAndUpdate({ _id: original._id, isActive: true }, { $set: { isActive: false, version: original.version + 1 } }, { session, returnDocument: 'after', runValidators: true }).lean().exec() as Row | null;
        if (!after) throw versionConflict();
        await audits.create([{ userId: actor.id, action: 'DEACTIVATE', targetType, targetId: original._id, reason: action('Voided'), oldValue: snapshot(original), newValue: snapshot(after) }], { session });
      });
    },
  };
}
export type InventoryRecordService = ReturnType<typeof createInventoryRecords>;
