import type { Mongoose } from 'mongoose';
import type { ingredientModel } from '../models/ingredient';
import type { userModel } from '../models/user';
import type { Ingredient, IngredientStore } from './ingredients';
import type { IngredientInput, IngredientPageQuery } from '../validators/ingredient';
import type { auditRecordModel } from '../models/audit-record';
import { auditSnapshot } from './audit-snapshot';

type Row = {
  _id: { toString(): string };
  name: string; brand: string; description: string; category: string; unitOfMeasure: string;
  minimumStock?: number; standardUnitCost?: number; defaultShelfLifeDays?: number;
  isActive?: boolean;
  createdBy: { toString(): string }; createdAt: Date; updatedAt: Date;
};
const escape = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

export function createIngredientStore(driver: Mongoose, ingredients: ReturnType<typeof ingredientModel>, users: ReturnType<typeof userModel>, audits: ReturnType<typeof auditRecordModel>): IngredientStore {
  const snapshot = (row: Row | null) => row ? auditSnapshot('Ingredient', {
    ...row, isActive: row.isActive !== false, id: row._id.toString(), createdBy: row.createdBy.toString(),
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
      isActive: row.isActive !== false,
      category: row.category, unitOfMeasure: row.unitOfMeasure,
      ...(row.minimumStock !== undefined ? { minimumStock: row.minimumStock } : {}),
      ...(row.standardUnitCost !== undefined ? { standardUnitCost: row.standardUnitCost } : {}),
      ...(row.defaultShelfLifeDays ? { defaultShelfLifeDays: row.defaultShelfLifeDays } : {}),
      createdBy: { id: creatorId, name: names.get(creatorId) || 'Unknown account' },
      createdAt: row.createdAt.toISOString(), updatedAt: row.updatedAt.toISOString(),
    };
  };
  return {
    async list(query: IngredientPageQuery) {
      const filter: Record<string, unknown> = {};
      // Documents created before soft archiving have no flag and remain active.
      if (!query.includeArchived) filter.isActive = { $ne: false };
      if (query.category) filter.category = query.category;
      if (query.search) filter.$or = [{ name: { $regex: escape(query.search), $options: 'i' } }, { brand: { $regex: escape(query.search), $options: 'i' } }];
      const [rows, total] = await Promise.all([
        ingredients.find(filter).sort({ createdAt: -1, _id: -1 }).skip((query.page - 1) * query.pageSize).limit(query.pageSize).lean().exec() as Promise<Row[]>,
        ingredients.countDocuments(filter).exec(),
      ]);
      const names = await creators(rows);
      return { items: rows.map(row => serialize(row, names)), page: query.page, pageSize: query.pageSize, total };
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
    async update(actorId: string, id: string, input: IngredientInput) {
      const row = await driver.connection.transaction(async session => {
        const before = await ingredients.findOne({ _id: id, isActive: { $ne: false } }).session(session).lean().exec() as Row | null;
        if (!before) return null;
        const after = await ingredients.findOneAndUpdate({ _id: id, isActive: { $ne: false } }, { $set: input }, { session, returnDocument: 'after', runValidators: true }).lean().exec() as Row | null;
        if (!after) throw new Error('Ingredient changed during transaction');
        await audits.create([{ userId: actorId, action: 'UPDATE', targetType: 'Ingredient', targetId: id, oldValue: snapshot(before), newValue: snapshot(after) }], { session });
        return after;
      });
      if (!row) return null;
      const names = await creators([row]);
      return serialize(row, names);
    },
    async remove(actorId: string, id: string) {
      return driver.connection.transaction(async session => {
        const before = await ingredients.findOne({ _id: id, isActive: { $ne: false } }).session(session).lean().exec() as Row | null;
        if (!before) return false;
        const after = await ingredients.findOneAndUpdate({ _id: id, isActive: { $ne: false } }, { $set: { isActive: false } }, { session, returnDocument: 'after', runValidators: true }).lean().exec() as Row | null;
        if (!after) throw new Error('Ingredient changed during transaction');
        await audits.create([{ userId: actorId, action: 'DEACTIVATE', targetType: 'Ingredient', targetId: id, oldValue: snapshot(before), newValue: snapshot(after) }], { session });
        return true;
      });
    },
  };
}
