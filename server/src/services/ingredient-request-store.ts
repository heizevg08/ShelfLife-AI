import type { Mongoose, Types } from 'mongoose';
import type { ingredientRequestModel } from '../models/ingredient-request';
import type { ingredientModel } from '../models/ingredient';
import type { userModel } from '../models/user';
import type { auditRecordModel } from '../models/audit-record';
import type { IngredientInput } from '../validators/ingredient';
import type { IngredientRequestReview } from '../validators/ingredient-request';
import { AdministrationError } from '../middleware/administration.middleware';
import { versionConflict } from '../validators/inventory-contract';
import { auditSnapshot } from './audit-snapshot';

type RequestRow = IngredientInput & {
  _id: Types.ObjectId; status: 'Pending' | 'Approved' | 'Rejected'; version: number;
  createdBy: Types.ObjectId; reviewedBy?: Types.ObjectId; reviewNote: string;
  ingredientId?: Types.ObjectId; isDeleted?: boolean; deletedBy?: Types.ObjectId; createdAt: Date; updatedAt: Date;
};
const missing = () => new AdministrationError(404, 'NOT_FOUND', 'Ingredient request not found');
const editWindowMs = 15 * 60 * 1000;
const requestValue = (row: RequestRow) => ({ id: row._id.toString(), name: row.name, brand: row.brand, description: row.description, category: row.category,
  ...(row.customCategory ? { customCategory: row.customCategory } : {}),
  unitOfMeasure: row.unitOfMeasure, ...(row.minimumStock !== undefined ? { minimumStock: row.minimumStock } : {}),
  ...(row.standardUnitCost !== undefined ? { standardUnitCost: row.standardUnitCost } : {}), ...(row.defaultShelfLifeDays !== undefined ? { defaultShelfLifeDays: row.defaultShelfLifeDays } : {}),
  status: row.status, version: row.version, createdBy: row.createdBy.toString(), reviewedBy: row.reviewedBy?.toString() ?? null,
  reviewNote: row.reviewNote, ingredientId: row.ingredientId?.toString() ?? null, isDeleted: row.isDeleted === true,
  deletedBy: row.deletedBy?.toString() ?? null, createdAt: row.createdAt.toISOString(), updatedAt: row.updatedAt.toISOString() });

export function createIngredientRequestStore(driver: Mongoose, requests: ReturnType<typeof ingredientRequestModel>, ingredients: ReturnType<typeof ingredientModel>, users: ReturnType<typeof userModel>, audits: ReturnType<typeof auditRecordModel>) {
  async function serialize(rows: RequestRow[]) {
    const ids = [...new Set(rows.flatMap(row => [row.createdBy.toString(), ...(row.reviewedBy ? [row.reviewedBy.toString()] : [])]))];
    const people = await users.find({ _id: { $in: ids } }).select('_id firstName lastName name').lean().exec();
    const names = new Map(people.map(person => [person._id.toString(), (person.name || `${person.firstName} ${person.lastName}`).trim()]));
    return rows.map(row => ({
      ...requestValue(row),
      createdBy: { id: row.createdBy.toString(), name: names.get(row.createdBy.toString()) || 'Unknown account' },
      reviewedBy: row.reviewedBy ? { id: row.reviewedBy.toString(), name: names.get(row.reviewedBy.toString()) || 'Unknown account' } : null,
    }));
  }
  return {
    async list(createdBy?: string) {
      const filter: Record<string, unknown> = { isDeleted: { $ne: true }, ...(createdBy ? { createdBy, status: 'Pending' } : {}) };
      const [rows, total] = await Promise.all([
        requests.find(filter).sort({ createdAt: -1, _id: -1 }).limit(100).lean().exec() as Promise<RequestRow[]>,
        requests.countDocuments(filter).exec(),
      ]);
      return { items: await serialize(rows), total };
    },
    async create(actorId: string, input: IngredientInput) {
      const row = await driver.connection.transaction(async session => {
        const [created] = await requests.create([{ ...input, createdBy: actorId }], { session });
        const value = created.toObject() as RequestRow;
        await audits.create([{ userId: actorId, action: 'CREATE', targetType: 'ChangeRequest', targetId: value._id,
          oldValue: null, newValue: auditSnapshot('ChangeRequest', { ...requestValue(value), createdBy: actorId }) }], { session });
        return value;
      });
      return (await serialize([row]))[0];
    },
    async update(actorId: string, id: string, input: IngredientInput, expectedVersion: number) {
      const row = await driver.connection.transaction(async session => {
        const before = await requests.findById(id).session(session).lean().exec() as RequestRow | null;
        if (!before || before.createdBy.toString() !== actorId || before.status !== 'Pending' || before.isDeleted) throw missing();
        if (Date.now() - before.createdAt.getTime() > editWindowMs) throw new AdministrationError(403, 'EDIT_WINDOW_EXPIRED', 'Ingredient requests can only be edited within 15 minutes of submission');
        if (before.version !== expectedVersion) throw versionConflict();
        const after = await requests.findOneAndUpdate({ _id: id, createdBy: actorId, status: 'Pending', isDeleted: { $ne: true }, createdAt: { $gte: new Date(Date.now() - editWindowMs) }, version: expectedVersion }, {
          $set: input, $inc: { version: 1 },
        }, { session, returnDocument: 'after', runValidators: true }).lean().exec() as RequestRow | null;
        if (!after) throw versionConflict();
        await audits.create([{ userId: actorId, action: 'UPDATE', targetType: 'ChangeRequest', targetId: id,
          oldValue: auditSnapshot('ChangeRequest', { ...requestValue(before), createdBy: before.createdBy.toString() }),
          newValue: auditSnapshot('ChangeRequest', { ...requestValue(after), createdBy: after.createdBy.toString() }) }], { session });
        return after;
      });
      return (await serialize([row]))[0];
    },
    async remove(actorId: string, id: string) {
      await driver.connection.transaction(async session => {
        const before = await requests.findById(id).session(session).lean().exec() as RequestRow | null;
        if (!before || before.isDeleted) throw missing();
        const after = await requests.findOneAndUpdate({ _id: id, isDeleted: { $ne: true } }, {
          $set: { isDeleted: true, deletedBy: actorId }, $inc: { version: 1 },
        }, { session, returnDocument: 'after', runValidators: true }).lean().exec() as RequestRow | null;
        if (!after) throw versionConflict();
        await audits.create([{ userId: actorId, action: 'UPDATE', targetType: 'ChangeRequest', targetId: id,
          oldValue: auditSnapshot('ChangeRequest', { ...requestValue(before), createdBy: before.createdBy.toString() }),
          newValue: auditSnapshot('ChangeRequest', { ...requestValue(after), createdBy: after.createdBy.toString() }), reason: 'Ingredient request removed from the review list' }], { session });
      });
    },
    async review(reviewerId: string, id: string, input: IngredientRequestReview) {
      const result = await driver.connection.transaction(async session => {
        const before = await requests.findById(id).session(session).lean().exec() as RequestRow | null;
        if (!before || before.status !== 'Pending' || before.isDeleted) throw missing();
        if (before.version !== input.expectedVersion) throw versionConflict();
        let createdIngredient: (RequestRow & { isActive: boolean }) | undefined;
        if (input.decision === 'Approved') {
          const [created] = await ingredients.create([{ name: before.name, brand: before.brand, description: before.description, category: before.category,
            ...(before.customCategory ? { customCategory: before.customCategory } : {}),
            unitOfMeasure: before.unitOfMeasure, ...(before.minimumStock !== undefined ? { minimumStock: before.minimumStock } : {}),
            ...(before.standardUnitCost !== undefined ? { standardUnitCost: before.standardUnitCost } : {}), ...(before.defaultShelfLifeDays !== undefined ? { defaultShelfLifeDays: before.defaultShelfLifeDays } : {}),
            createdBy: before.createdBy }], { session });
          createdIngredient = created.toObject() as RequestRow & { isActive: boolean };
          await audits.create([{ userId: reviewerId, action: 'CREATE', targetType: 'Ingredient', targetId: createdIngredient._id,
            oldValue: null, newValue: auditSnapshot('Ingredient', { ...createdIngredient, id: createdIngredient._id.toString(), createdBy: before.createdBy.toString() }) }], { session });
        }
        const after = await requests.findOneAndUpdate({ _id: id, status: 'Pending', isDeleted: { $ne: true }, version: input.expectedVersion }, {
          $set: { status: input.decision, reviewedBy: reviewerId, reviewNote: input.note, ...(createdIngredient ? { ingredientId: createdIngredient._id } : {}) },
          $inc: { version: 1 },
        }, { session, returnDocument: 'after', runValidators: true }).lean().exec() as RequestRow | null;
        if (!after) throw versionConflict();
        await audits.create([{ userId: reviewerId, action: 'UPDATE', targetType: 'ChangeRequest', targetId: id,
          oldValue: auditSnapshot('ChangeRequest', { ...requestValue(before), createdBy: before.createdBy.toString() }),
          newValue: auditSnapshot('ChangeRequest', { ...requestValue(after), createdBy: after.createdBy.toString() }), reason: input.note || `Ingredient request ${input.decision.toLowerCase()}` }], { session });
        return { request: after, ingredientId: createdIngredient?._id.toString() ?? null };
      });
      return { request: (await serialize([result.request]))[0], ingredientId: result.ingredientId };
    },
  };
}
export type IngredientRequestStore = ReturnType<typeof createIngredientRequestStore>;
