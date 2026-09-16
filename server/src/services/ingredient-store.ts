import type { Mongoose } from 'mongoose';
import type { ingredientModel } from '../models/ingredient';
import type { userModel } from '../models/user';
import type { Ingredient, IngredientStore } from './ingredients';
import type { IngredientInput, IngredientPageQuery } from '../validators/ingredient';

type Row = {
  _id: { toString(): string };
  name: string; brand: string; description: string; category: string; unitOfMeasure: string;
  minimumStock?: number; standardUnitCost?: number; defaultShelfLifeDays?: number;
  createdBy: { toString(): string }; createdAt: Date; updatedAt: Date;
};
const escape = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

export function createIngredientStore(_driver: Mongoose, ingredients: ReturnType<typeof ingredientModel>, users: ReturnType<typeof userModel>): IngredientStore {
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
    async list(query: IngredientPageQuery) {
      const filter: Record<string, unknown> = {};
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
      const row = await ingredients.create({ ...input, createdBy: actorId });
      const names = await creators([row.toObject() as Row]);
      return serialize(row.toObject() as Row, names);
    },
    async update(id: string, input: IngredientInput) {
      const row = await ingredients.findByIdAndUpdate(id, { $set: input }, { new: true, runValidators: true }).lean().exec() as Row | null;
      if (!row) return null;
      const names = await creators([row]);
      return serialize(row, names);
    },
    async remove(id: string) {
      const result = await ingredients.deleteOne({ _id: id }).exec();
      return result.deletedCount === 1;
    },
  };
}
