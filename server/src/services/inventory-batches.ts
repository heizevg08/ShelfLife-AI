import type { Mongoose, Types } from 'mongoose';
import type { inventoryBatchModel } from '../models/inventory-batch';
import type { ingredientModel } from '../models/ingredient';
import type { auditRecordModel } from '../models/audit-record';
import type { SystemConfigService, SystemConfig } from './system-config';
import { batchStatus } from './batch-status';
import { batchCorrection, batchDates, batchInput, batchPagination, batchPatch } from '../validators/inventory-batch';
import { archiveInput, decimalUnits, storedDecimal, versionConflict } from '../validators/inventory-contract';
import { invalid, objectId } from '../validators/administration';
import { AdministrationError, forbidden } from '../middleware/administration.middleware';
import { auditSnapshot } from './audit-snapshot';

type Actor = { id: string; role: string };
type Row = {
  _id: Types.ObjectId; ingredientId: Types.ObjectId; batchCode: string; initialQuantity: Types.Decimal128; quantity: Types.Decimal128;
  unit: string; unitCost: Types.Decimal128; currency: string; dateReceived: string; expirationDate: string;
  isActive: boolean; version: number; createdBy: Types.ObjectId; createdAt: Date; updatedAt: Date;
};
const notFound = () => new AdministrationError(404, 'NOT_FOUND', 'Batch not found');
function manager(actor: Actor) { if (actor.role !== 'Inventory Manager') throw forbidden(); }
function record(row: Row) {
  return { id: row._id.toString(), ingredientId: row.ingredientId.toString(), batchCode: row.batchCode,
    initialQuantity: storedDecimal(row.initialQuantity, 3), quantity: storedDecimal(row.quantity, 3), unit: row.unit,
    unitCost: storedDecimal(row.unitCost, 4), currency: row.currency, dateReceived: row.dateReceived, expirationDate: row.expirationDate,
    isActive: row.isActive, version: row.version, createdBy: row.createdBy.toString(), createdAt: row.createdAt.toISOString(), updatedAt: row.updatedAt.toISOString() };
}
const response = (row: Row, config: SystemConfig, now: Date) => ({ ...record(row), status: batchStatus(row.expirationDate, config, now) });

export function createInventoryBatches(driver: Mongoose, batches: ReturnType<typeof inventoryBatchModel>, ingredients: ReturnType<typeof ingredientModel>, audits: ReturnType<typeof auditRecordModel>, config: Pick<SystemConfigService, 'get'>, now: () => Date = () => new Date()) {
  const mutate = async (actor: Actor, id: string, version: number, action: 'UPDATE' | 'DEACTIVATE', changes: (before: Row) => Record<string, unknown>, reason?: string) => {
    const thresholds = await config.get(), date = now();
    const row = await driver.connection.transaction(async session => {
      const before = await batches.findById(objectId(id)).session(session).lean().exec() as Row | null;
      if (!before) throw notFound();
      if (before.version !== version) throw versionConflict();
      if (!before.isActive) throw notFound();
      const patch = changes(before);
      const after = await batches.findOneAndUpdate({ _id: id, version, isActive: true }, { $set: { ...patch, version: version + 1 } }, { session, returnDocument: 'after', runValidators: true }).lean().exec() as Row | null;
      if (!after) throw versionConflict();
      await audits.create([{ userId: actor.id, action, targetType: 'InventoryBatch', targetId: id, oldValue: auditSnapshot('InventoryBatch', record(before)), newValue: auditSnapshot('InventoryBatch', record(after)), ...(reason ? { reason } : {}) }], { session });
      return after;
    });
    return response(row, thresholds, date);
  };
  return {
    async list(query: Record<string, unknown>) {
      const page = batchPagination(query), filter = { ...(page.includeArchived ? {} : { isActive: true }), ...(page.ingredientId ? { ingredientId: page.ingredientId } : {}) };
      const [rows, total, thresholds] = await Promise.all([
        batches.find(filter).sort({ expirationDate: 1, dateReceived: 1, _id: 1 }).skip((page.page - 1) * page.limit).limit(page.limit).lean().exec() as Promise<Row[]>,
        batches.countDocuments(filter).exec(), config.get(),
      ]);
      const date = now();
      return { items: rows.map(row => response(row, thresholds, date)), page: page.page, limit: page.limit, total };
    },
    async get(id: string) {
      const row = await batches.findById(objectId(id)).lean().exec() as Row | null;
      if (!row) throw notFound();
      return response(row, await config.get(), now());
    },
    async create(actor: Actor, body: unknown) {
      manager(actor);
      const input = batchInput(body), thresholds = await config.get(), date = now();
      const row = await driver.connection.transaction(async session => {
        const ingredient = await ingredients.findOne({ _id: input.ingredientId, isActive: { $ne: false } }).session(session).lean().exec();
        if (!ingredient) throw new AdministrationError(404, 'NOT_FOUND', 'Active ingredient not found');
        const [created] = await batches.create([{ ...input, quantity: input.initialQuantity, createdBy: actor.id }], { session });
        const value = created.toObject() as Row;
        await audits.create([{ userId: actor.id, action: 'CREATE', targetType: 'InventoryBatch', targetId: value._id, oldValue: null, newValue: auditSnapshot('InventoryBatch', record(value)) }], { session });
        return value;
      });
      return response(row, thresholds, date);
    },
    async patch(actor: Actor, id: string, body: unknown) {
      manager(actor);
      const input = batchPatch(body);
      return mutate(actor, id, input.expectedVersion, 'UPDATE', before => {
        batchDates(input.patch.dateReceived ?? before.dateReceived, input.patch.expirationDate ?? before.expirationDate);
        return input.patch;
      });
    },
    async correctQuantity(actor: Actor, id: string, body: unknown) {
      manager(actor);
      const input = batchCorrection(body);
      return mutate(actor, id, input.expectedVersion, 'UPDATE', before => {
        if (decimalUnits(input.correctedQuantity) > decimalUnits(storedDecimal(before.initialQuantity, 3))) invalid('correctedQuantity', 'Correction cannot exceed initialQuantity');
        return { quantity: input.correctedQuantity };
      }, input.reason);
    },
    async archive(actor: Actor, id: string, body: unknown) {
      manager(actor);
      return mutate(actor, id, archiveInput(body), 'DEACTIVATE', () => ({ isActive: false }));
    },
  };
}
export type InventoryBatchService = ReturnType<typeof createInventoryBatches>;
