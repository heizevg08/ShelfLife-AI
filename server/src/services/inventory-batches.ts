import type { Mongoose, Types } from 'mongoose';
import type { inventoryBatchModel } from '../models/inventory-batch';
import type { ingredientModel } from '../models/ingredient';
import type { auditRecordModel } from '../models/audit-record';
import type { SystemConfigService, SystemConfig } from './system-config';
import { batchStatus } from './batch-status';
import { batchCorrection, batchDates, batchInput, batchPagination, batchPatch } from '../validators/inventory-batch';
import { archiveInput, decimal, decimalUnits, storedDecimal, versionConflict } from '../validators/inventory-contract';
import { invalid, objectId } from '../validators/administration';
import { AdministrationError, forbidden } from '../middleware/administration.middleware';
import { auditSnapshot } from './audit-snapshot';

type Actor = { id: string; role: string };
type Row = {
  _id: Types.ObjectId; ingredientId: Types.ObjectId; batchCode: string; initialQuantity: Types.Decimal128; quantity: Types.Decimal128;
  unit: string; unitCost: Types.Decimal128; currency: string; dateReceived: string; expirationDate: string;
  isActive: boolean; version: number; createdBy: Types.ObjectId; createdAt: Date; updatedAt: Date;
};
type IngredientRow = { _id: Types.ObjectId; category: string; minimumStock?: number; isActive?: boolean };
export type InventoryBatchSummary = {
  totalIngredients: number;
  totalBatches: number;
  lowStockItems: number;
  lowStockExcludedCount: number;
  statusCounts: Record<'Normal' | 'Approaching Expiry' | 'Critical' | 'Expired', number>;
  categoryCounts: Array<{ category: string; batchCount: number; quantity: string; inventoryValue: string }>;
  inventoryValue: string;
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
function fixed(units: bigint, scale: number) {
  const denominator = 10n ** BigInt(scale), whole = units / denominator, fraction = (units % denominator).toString().padStart(scale, '0');
  return `${whole}.${fraction}`;
}
function money(rawUnits: bigint) {
  // Quantity (3) multiplied by unit cost (4) is rounded only once at the final PHP total (2).
  return fixed((rawUnits + 50_000n) / 100_000n, 2);
}
function minimumStockUnits(value: unknown): bigint | null {
  if (typeof value !== 'number' || !Number.isFinite(value) || value < 0) return null;
  try {
    // Existing ingredient thresholds are Number values. Convert only the shortest decimal form,
    // then use fixed-point units so this read-only summary never performs quantity arithmetic in Number.
    return decimalUnits(decimal(String(value), 3, 'minimumStock'));
  } catch { return null; }
}

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
    async summary(): Promise<InventoryBatchSummary> {
      const [rows, ingredientRows, thresholds] = await Promise.all([
        batches.find({ isActive: true }).lean().exec() as Promise<Row[]>,
        ingredients.find({ isActive: { $ne: false } }).select('_id category minimumStock isActive').lean().exec() as Promise<IngredientRow[]>,
        config.get(),
      ]);
      const ingredientsById = new Map(ingredientRows.map(row => [row._id.toString(), row]));
      const activeRows = rows.filter(row => ingredientsById.has(row.ingredientId.toString()));
      const statusCounts: InventoryBatchSummary['statusCounts'] = { Normal: 0, 'Approaching Expiry': 0, Critical: 0, Expired: 0 };
      const categories = new Map<string, { batchCount: number; quantity: bigint; inventoryValue: bigint }>();
      const availableByIngredient = new Map<string, bigint>();
      let inventoryValue = 0n;
      const nowDate = now();
      for (const row of activeRows) {
        const ingredient = ingredientsById.get(row.ingredientId.toString())!;
        statusCounts[batchStatus(row.expirationDate, thresholds, nowDate)] += 1;
        const quantity = decimalUnits(storedDecimal(row.quantity, 3));
        const value = quantity * decimalUnits(storedDecimal(row.unitCost, 4));
        inventoryValue += value;
        const category = categories.get(ingredient.category) ?? { batchCount: 0, quantity: 0n, inventoryValue: 0n };
        category.batchCount += 1; category.quantity += quantity; category.inventoryValue += value;
        categories.set(ingredient.category, category);
        // Match Usage/Waste availability: active ingredient, active batch, and quantity > 0.000.
        if (quantity > 0n) availableByIngredient.set(row.ingredientId.toString(), (availableByIngredient.get(row.ingredientId.toString()) ?? 0n) + quantity);
      }
      const multiplier = decimalUnits(thresholds.lowStockMultiplier);
      let lowStockItems = 0, lowStockExcludedCount = 0;
      for (const ingredient of ingredientRows) {
        const threshold = minimumStockUnits(ingredient.minimumStock);
        if (ingredient.minimumStock === undefined) continue;
        if (threshold === null) { lowStockExcludedCount += 1; continue; }
        const onHand = availableByIngredient.get(ingredient._id.toString()) ?? 0n;
        if (onHand * 1000n <= threshold * multiplier) lowStockItems += 1;
      }
      return {
        totalIngredients: new Set(activeRows.map(row => row.ingredientId.toString())).size,
        totalBatches: activeRows.length,
        lowStockItems,
        lowStockExcludedCount,
        statusCounts,
        categoryCounts: [...categories.entries()].sort(([left], [right]) => left.localeCompare(right)).map(([category, values]) => ({
          category, batchCount: values.batchCount, quantity: fixed(values.quantity, 3), inventoryValue: money(values.inventoryValue),
        })),
        inventoryValue: money(inventoryValue),
      };
    },
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
