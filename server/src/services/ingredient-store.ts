import type { Mongoose } from 'mongoose';
import type { ingredientModel } from '../models/ingredient';
import type { userModel } from '../models/user';
import type { auditRecordModel } from '../models/audit-record';
import type { Ingredient, IngredientStore } from './ingredients';
import type { IngredientInput, IngredientPageQuery } from '../validators/ingredient';
import type { Actor } from './administration';
import { normalizeUserRole } from '../models/user';

type Row = {
  _id: { toString(): string };
  name: string; brand: string; description: string; category: string; unitOfMeasure: string;
  minimumStock?: number; standardUnitCost?: number; defaultShelfLifeDays?: number;
  createdBy: { toString(): string }; createdAt: Date; updatedAt: Date;
};
const escape = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

export function createIngredientStore(driver: Mongoose, ingredients: ReturnType<typeof ingredientModel>, users: ReturnType<typeof userModel>, audits: ReturnType<typeof auditRecordModel>): IngredientStore {
  const creators = async (rows: Row[]) => {
    const ids = [...new Set(rows.map(row => row.createdBy.toString()))];
    const records = await users.find({ _id: { $in: ids } }).select('_id firstName lastName name').lean().exec();
    return new Map(records.map(user => [user._id.toString(), (user.name || `${user.firstName} ${user.lastName}`).trim()]));
  };
  const serialize = (row: Row, names: Map<string, string>): Ingredient => {
    const creatorId = row.createdBy.toString();
    return {
      id: row._id.toString(), name: row.name, brand: row.brand, description: row.description,
      category: row.category, unitOfMeasure: row.unitOfMeasure,
      ...(row.minimumStock !== undefined ? { minimumStock: row.minimumStock } : {}),
      ...(row.standardUnitCost !== undefined ? { standardUnitCost: row.standardUnitCost } : {}),
      ...(row.defaultShelfLifeDays ? { defaultShelfLifeDays: row.defaultShelfLifeDays } : {}),
      createdBy: { id: creatorId, name: names.get(creatorId) || 'Unknown account' },
      createdAt: row.createdAt.toISOString(), updatedAt: row.updatedAt.toISOString(),
    };
  };
  return {
    async stockInOptions() {
      const rows = await ingredients.find({}).select('_id name category unitOfMeasure standardUnitCost defaultShelfLifeDays').sort({ name: 1, _id: 1 }).lean().exec();
      return rows.map(row => ({ id: row._id.toString(), name: row.name, category: row.category, unitOfMeasure: row.unitOfMeasure, ...(typeof row.standardUnitCost === 'number' ? { standardUnitCost: row.standardUnitCost } : {}), ...(typeof row.defaultShelfLifeDays === 'number' ? { defaultShelfLifeDays: row.defaultShelfLifeDays } : {}) }));
    },
    async summary() {
      const [total, categories, units] = await Promise.all([
        ingredients.countDocuments({}).exec(),
        ingredients.distinct('category').exec(),
        ingredients.distinct('unitOfMeasure').exec(),
      ]);
      return {
        total,
        categories: categories.filter(Boolean).sort((a, b) => a.localeCompare(b)),
        units: units.filter(Boolean).sort((a, b) => a.localeCompare(b)),
        mostCommonIngredient: null,
      };
    },
    async list(query: IngredientPageQuery) {
      const filter: Record<string, unknown> = {};
      if (query.category) filter.category = query.category;
      if (query.unit) filter.unitOfMeasure = query.unit;
      if (query.search) filter.$or = [
        { name: { $regex: escape(query.search), $options: 'i' } },
        { brand: { $regex: escape(query.search), $options: 'i' } },
        { category: { $regex: escape(query.search), $options: 'i' } },
      ];
      const [rows, total] = await Promise.all([
        ingredients.find(filter).sort({ createdAt: -1, _id: -1 }).skip((query.page - 1) * query.pageSize).limit(query.pageSize).lean().exec() as Promise<Row[]>,
        ingredients.countDocuments(filter).exec(),
      ]);
      const names = await creators(rows);
      return { items: rows.map(row => serialize(row, names)), page: query.page, pageSize: query.pageSize, total };
    },
    async create(actor: Actor, input: IngredientInput) {
      const row = await driver.connection.transaction(async session => {
        const created = await ingredients.create([{ ...input, createdBy: actor.id }], { session });
        const result = created[0]!.toObject() as Row;
        await audits.create([{ userId: actor.id, actorName: actor.name?.trim() || 'Unknown account', actorRole: normalizeUserRole(actor.role) ?? undefined, action: 'CREATE', targetType: 'Ingredient', targetId: result._id.toString(), targetName: result.name, module: 'Ingredients', status: 'Success', details: 'Ingredient master-data record created' }], { session });
        return result;
      });
      const names = await creators([row]);
      return serialize(row, names);
    },
    async update(actor: Actor, id: string, input: IngredientInput) {
      const row = await driver.connection.transaction(async session => {
        const result = await ingredients.findByIdAndUpdate(id, { $set: input }, { new: true, runValidators: true, session }).lean().exec() as Row | null;
        if (!result) return null;
        await audits.create([{ userId: actor.id, actorName: actor.name?.trim() || 'Unknown account', actorRole: normalizeUserRole(actor.role) ?? undefined, action: 'UPDATE', targetType: 'Ingredient', targetId: result._id.toString(), targetName: result.name, module: 'Ingredients', status: 'Success', details: 'Ingredient master-data record updated' }], { session });
        return result;
      });
      if (!row) return null;
      const names = await creators([row]);
      return serialize(row, names);
    },
    async remove(actor: Actor, id: string) {
      return driver.connection.transaction(async session => {
        const row = await ingredients.findByIdAndDelete(id, { session }).lean().exec() as Row | null;
        if (!row) return false;
        await audits.create([{ userId: actor.id, actorName: actor.name?.trim() || 'Unknown account', actorRole: normalizeUserRole(actor.role) ?? undefined, action: 'DELETE', targetType: 'Ingredient', targetId: row._id.toString(), targetName: row.name, module: 'Ingredients', status: 'Success', details: 'Ingredient master-data record removed' }], { session });
        return true;
      });
    },
  };
}
