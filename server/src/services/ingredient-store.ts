import { expectedVersion as validateVersion, versionConflict, versionFilter } from '../validators/inventory-contract';
import type { Mongoose } from 'mongoose';
import type { ingredientModel } from '../models/ingredient';
import type { userModel } from '../models/user';
import type { Ingredient, IngredientStore, IngredientSummary, StockInIngredientOption } from './ingredients';
import type { IngredientInput, IngredientPageQuery } from '../validators/ingredient';
import type { auditRecordModel } from '../models/audit-record';
import { auditSnapshot } from './audit-snapshot';

type Row = {
  _id: { toString(): string };
  name: string; brand: string; description: string; category: string; customCategory?: string; unitOfMeasure: string;
  minimumStock?: number; standardUnitCost?: number; defaultShelfLifeDays?: number;
  isActive?: boolean; version?: number;
  createdBy: { toString(): string }; createdAt: Date; updatedAt: Date;
};
const escape = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

export function createIngredientStore(driver: Mongoose, ingredients: ReturnType<typeof ingredientModel>, users: ReturnType<typeof userModel>, audits: ReturnType<typeof auditRecordModel>): IngredientStore {
  const snapshot = (row: Row | null) => row ? auditSnapshot('Ingredient', {
    ...row, version: row.version ?? 0, isActive: row.isActive !== false, id: row._id.toString(), createdBy: row.createdBy.toString(),
  }) : null;
  const creators = async (rows: Row[]) => {
    const ids = [...new Set(rows.map(row => row.createdBy.toString()))];
    const records = await users.find({ _id: { $in: ids } }).select('_id firstName lastName name').lean().exec();
    return new Map(records.map(user => [user._id.toString(), (user.name || `${user.firstName} ${user.lastName}`).trim()]));
  };
  const serialize = (row: Row, names: Map<string, string>): Ingredient => {
    const creatorId = row.createdBy.toString();
    return {
      id: row._id.toString(), name: row.name, brand: row.brand, description: row.description,
      isActive: row.isActive !== false, version: row.version ?? 0,
      category: row.category, ...(row.customCategory ? { customCategory: row.customCategory } : {}), unitOfMeasure: row.unitOfMeasure,
      ...(row.minimumStock !== undefined ? { minimumStock: row.minimumStock } : {}),
      ...(row.standardUnitCost !== undefined ? { standardUnitCost: row.standardUnitCost } : {}),
      ...(row.defaultShelfLifeDays ? { defaultShelfLifeDays: row.defaultShelfLifeDays } : {}),
      createdBy: { id: creatorId, name: names.get(creatorId) || 'Unknown account' },
      createdAt: row.createdAt.toISOString(), updatedAt: row.updatedAt.toISOString(),
    };
  };
  return {
    async summary(): Promise<IngredientSummary> {
      const filter = { isActive: { $ne: false } };
      const [total, categories, units] = await Promise.all([
        ingredients.countDocuments(filter).exec(),
        ingredients.distinct('category', filter).exec(),
        ingredients.distinct('unitOfMeasure', filter).exec(),
      ]);
      return {
        total,
        categories: categories.filter(Boolean).sort((left, right) => left.localeCompare(right)),
        units: units.filter(Boolean).sort((left, right) => left.localeCompare(right)),
        // Ingredient master data has no usage frequency, so this value must not imply one.
        mostCommonIngredient: null,
      };
    },
    async stockInOptions(): Promise<StockInIngredientOption[]> {
      const rows = await ingredients.find({ isActive: { $ne: false } })
        .select('_id name category unitOfMeasure defaultShelfLifeDays').sort({ name: 1, _id: 1 }).lean().exec() as Row[];
      return rows.map(row => ({
        id: row._id.toString(), name: row.name, category: row.category, unitOfMeasure: row.unitOfMeasure,
        ...(row.defaultShelfLifeDays !== undefined ? { defaultShelfLifeDays: row.defaultShelfLifeDays } : {}),
      }));
    },
    async list(query: IngredientPageQuery) {
      const filter: Record<string, unknown> = {};
      // Documents created before soft archiving have no flag and remain active.
      if (query.status === 'archived') filter.isActive = false;
      else if (query.status === 'active' || (!query.status && !query.includeArchived)) filter.isActive = { $ne: false };
      if (query.category) filter.category = query.category;
      if (query.unit) filter.unitOfMeasure = query.unit;
      if (query.search) filter.$or = [{ name: { $regex: escape(query.search), $options: 'i' } }, { brand: { $regex: escape(query.search), $options: 'i' } }];
      const [rows, total] = await Promise.all([
        ingredients.find(filter).sort({ createdAt: -1, _id: -1 }).skip((query.page - 1) * query.limit).limit(query.limit).lean().exec() as Promise<Row[]>,
        ingredients.countDocuments(filter).exec(),
      ]);
      const names = await creators(rows);
      return { items: rows.map(row => serialize(row, names)), page: query.page, limit: query.limit, total };
    },
    async create(actorId: string, input: IngredientInput) {
      const row = await driver.connection.transaction(async session => {
        const [created] = await ingredients.create([{ ...input, createdBy: actorId }], { session });
        const value = created.toObject() as Row;
        await audits.create([{ userId: actorId, action: 'CREATE', targetType: 'Ingredient', targetId: created._id, oldValue: null, newValue: snapshot(value) }], { session });
        return value;
      });
      return serialize(row, await creators([row]));
    },
    async update(actorId: string, id: string, input: Partial<IngredientInput>, expectedVersion: number) {
      const row = await driver.connection.transaction(async session => {
        const before = await ingredients.findById(id).session(session).lean().exec() as Row | null;
        if (!before) return null;
        if ((before.version ?? 0) !== validateVersion(expectedVersion)) throw versionConflict();
        if (before.isActive === false) return null;
        const after = await ingredients.findOneAndUpdate({ _id: id, isActive: { $ne: false }, ...versionFilter(expectedVersion) }, { $set: { ...input, version: expectedVersion + 1 } }, { session, returnDocument: 'after', runValidators: true }).lean().exec() as Row | null;
        if (!after) throw versionConflict();
        await audits.create([{ userId: actorId, action: 'UPDATE', targetType: 'Ingredient', targetId: id, oldValue: snapshot(before), newValue: snapshot(after) }], { session });
        return after;
      });
      if (!row) return null;
      const names = await creators([row]);
      return serialize(row, names);
    },
    async remove(actorId: string, id: string, expectedVersion: number) {
      return driver.connection.transaction(async session => {
        const before = await ingredients.findById(id).session(session).lean().exec() as Row | null;
        if (!before) return false;
        if ((before.version ?? 0) !== validateVersion(expectedVersion)) throw versionConflict();
        if (before.isActive === false) return false;
        const after = await ingredients.findOneAndUpdate({ _id: id, isActive: { $ne: false }, ...versionFilter(expectedVersion) }, { $set: { isActive: false, version: expectedVersion + 1 } }, { session, returnDocument: 'after', runValidators: true }).lean().exec() as Row | null;
        if (!after) throw versionConflict();
        await audits.create([{ userId: actorId, action: 'DEACTIVATE', targetType: 'Ingredient', targetId: id, oldValue: snapshot(before), newValue: snapshot(after) }], { session });
        return true;
      });
    },
  };
}
