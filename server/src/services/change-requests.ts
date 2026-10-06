import type { Mongoose, Types } from 'mongoose';
import type { changeRequestModel } from '../models/change-request';
import type { changeRequestCounterModel } from '../models/change-request-counter';
import type { ingredientModel } from '../models/ingredient';
import type { auditRecordModel } from '../models/audit-record';
import { AdministrationError, forbidden } from '../middleware/administration.middleware';
import { typedChangeRequestInput, typedChangeRequestQuery, typedReviewInput, revalidateRequestedValue, type ChangeRequestType } from '../validators/change-request';
import { objectId } from '../validators/administration';
import { auditSnapshot } from './audit-snapshot';

type Actor = { id: string; role: string };
type TypedRow = {
  _id: Types.ObjectId; schemaVersion: 2; requestID: string; requestType: ChangeRequestType; ingredientId: Types.ObjectId;
  targetField: string; reason: string; currentValue: string; requestedValue: string; ingredientVersion: number;
  status: 'PENDING' | 'APPROVED' | 'REJECTED'; requestedBy: Types.ObjectId; reviewedBy?: Types.ObjectId; reviewedAt?: Date;
  reviewNote?: string; version: number; createdAt: Date; updatedAt: Date;
};
type LegacyRow = { _id: Types.ObjectId; schemaVersion?: unknown; target?: string; type?: string; proposedCorrection?: string; reason?: string; status?: string; version?: number; createdBy?: Types.ObjectId; createdAt: Date; updatedAt: Date };
type Ingredient = { _id: Types.ObjectId; name: string; brand: string; description: string; category: string; customCategory?: string; unitOfMeasure: string; minimumStock?: number; standardUnitCost?: number; defaultShelfLifeDays?: number; version: number; isActive: boolean; createdBy: Types.ObjectId; createdAt: Date; updatedAt: Date };
const notFound = () => new AdministrationError(404, 'NOT_FOUND', 'Change request not found');
const conflict = (message = 'This change request is no longer current. Reload it before reviewing.') => new AdministrationError(409, 'VERSION_CONFLICT', message);
const typed = (row: LegacyRow | TypedRow): row is TypedRow => row.schemaVersion === 2;
const manager = (actor: Actor) => { if (actor.role !== 'Inventory Manager') throw forbidden(); };
const reader = (actor: Actor) => { if (!['Inventory Staff', 'Inventory Manager', 'Super Admin'].includes(actor.role)) throw forbidden(); };
function manilaDateKey(now: Date) {
  const values = new Intl.DateTimeFormat('en-US', { timeZone: 'Asia/Manila', year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(now);
  const part = (kind: string) => values.find(value => value.type === kind)?.value;
  return `${part('year')}${part('month')}${part('day')}`;
}
function typedRecord(row: TypedRow) {
  return { id: row._id.toString(), schemaVersion: 2, requestID: row.requestID, requestType: row.requestType, ingredientId: row.ingredientId.toString(), targetField: row.targetField,
    reason: row.reason, currentValue: row.currentValue, requestedValue: row.requestedValue, ingredientVersion: row.ingredientVersion, status: row.status,
    requestedBy: row.requestedBy.toString(), ...(row.reviewedBy ? { reviewedBy: row.reviewedBy.toString(), reviewedAt: row.reviewedAt?.toISOString() } : {}),
    ...(row.reviewNote ? { reviewNote: row.reviewNote } : {}), version: row.version, createdAt: row.createdAt.toISOString(), updatedAt: row.updatedAt.toISOString(), readOnly: false };
}
function legacyRecord(row: LegacyRow) {
  return { id: row._id.toString(), schemaVersion: null, requestID: null, requestType: row.type ?? 'LEGACY', ingredientId: null, targetField: null,
    reason: row.reason ?? '', currentValue: row.target ?? '', requestedValue: row.proposedCorrection ?? '', ingredientVersion: null, status: row.status ?? 'Legacy',
    requestedBy: row.createdBy?.toString() ?? null, version: row.version ?? 0, createdAt: row.createdAt.toISOString(), updatedAt: row.updatedAt.toISOString(), readOnly: true };
}
function valueFor(ingredient: Ingredient, field: string): string {
  const value = ingredient[field as keyof Ingredient];
  return value === undefined || value === null ? '' : String(value);
}
function fieldValue(type: ChangeRequestType, value: string) {
  const revalidated = revalidateRequestedValue(type, value);
  if (type === 'MINIMUM_STOCK_CHANGE' || type === 'STANDARD_UNIT_COST_CHANGE' || type === 'DEFAULT_SHELF_LIFE_CHANGE') return Number(revalidated);
  return revalidated;
}

export function createChangeRequests(driver: Mongoose, rows: ReturnType<typeof changeRequestModel>, counters: ReturnType<typeof changeRequestCounterModel>, ingredients: ReturnType<typeof ingredientModel>, audits: ReturnType<typeof auditRecordModel>, clock: () => Date = () => new Date()) {
  const requestSnapshot = (row: TypedRow) => auditSnapshot('ChangeRequest', typedRecord(row));
  const ingredientSnapshot = (row: Ingredient) => auditSnapshot('Ingredient', { id: row._id.toString(), name: row.name, brand: row.brand, description: row.description, category: row.category, customCategory: row.customCategory ?? '', unitOfMeasure: row.unitOfMeasure, minimumStock: row.minimumStock, standardUnitCost: row.standardUnitCost, defaultShelfLifeDays: row.defaultShelfLifeDays, version: row.version, isActive: row.isActive, createdBy: row.createdBy.toString(), createdAt: row.createdAt.toISOString(), updatedAt: row.updatedAt.toISOString() });
  const nextRequestId = async (session: any) => {
    const dateKey = manilaDateKey(clock());
    const counter = await (counters as any).findOneAndUpdate({ dateKey }, { $inc: { sequence: 1 } }, { upsert: true, new: true, returnDocument: 'after', setDefaultsOnInsert: true, session }).lean().exec();
    return `REQ-${dateKey}-${String(counter.sequence).padStart(3, '0')}`;
  };
  return {
    async list(actor: Actor, query: Record<string, unknown>) {
      reader(actor); const page = typedChangeRequestQuery(query);
      const filter: Record<string, unknown> = { ...(page.status ? { status: page.status } : {}) };
      if (actor.role === 'Inventory Staff') filter.$or = [{ schemaVersion: 2, requestedBy: objectId(actor.id) }, { schemaVersion: { $ne: 2 }, createdBy: objectId(actor.id) }];
      const [items, total] = await Promise.all([
        (rows as any).find(filter).sort({ createdAt: -1, _id: -1 }).skip((page.page - 1) * page.limit).limit(page.limit).lean().exec() as Promise<(TypedRow | LegacyRow)[]>,
        (rows as any).countDocuments(filter).exec(),
      ]);
      return { items: items.map(row => typed(row) ? typedRecord(row) : legacyRecord(row)), page: page.page, limit: page.limit, total };
    },
    async detail(actor: Actor, id: string) {
      reader(actor); const row = await (rows as any).findById(objectId(id)).lean().exec() as TypedRow | LegacyRow | null;
      if (!row || (actor.role === 'Inventory Staff' && (typed(row) ? row.requestedBy.toString() : row.createdBy?.toString()) !== actor.id)) throw notFound();
      return typed(row) ? typedRecord(row) : legacyRecord(row);
    },
    async summary(actor: Actor) {
      if (actor.role !== 'Inventory Staff') throw forbidden();
      const grouped = await (rows as any).aggregate([{ $match: { schemaVersion: 2, requestedBy: objectId(actor.id) } }, { $group: { _id: '$status', count: { $sum: 1 } } }]).exec();
      const counts = Object.fromEntries(grouped.map((item: { _id: string; count: number }) => [item._id, item.count]));
      return { total: Object.values(counts).reduce((sum, value) => sum + Number(value), 0), pending: counts.PENDING ?? 0, approved: counts.APPROVED ?? 0, rejected: counts.REJECTED ?? 0 };
    },
    async managerSummary(actor: Actor) {
      manager(actor);
      const grouped = await (rows as any).aggregate([{ $match: { schemaVersion: 2 } }, { $group: { _id: '$status', count: { $sum: 1 } } }]).exec();
      const counts = Object.fromEntries(grouped.map((item: { _id: string; count: number }) => [item._id, item.count]));
      return { total: Object.values(counts).reduce((sum, value) => sum + Number(value), 0), pending: counts.PENDING ?? 0, approved: counts.APPROVED ?? 0, rejected: counts.REJECTED ?? 0 };
    },
    async ingredientOptions(actor: Actor) {
      if (!['Inventory Staff', 'Inventory Manager'].includes(actor.role)) throw forbidden();
      const items = await (ingredients as any).find({ isActive: { $ne: false } }).sort({ name: 1, _id: 1 }).lean().exec() as Ingredient[];
      return { items: items.map(item => ({ id: item._id.toString(), name: item.name, category: item.category, unitOfMeasure: item.unitOfMeasure, version: item.version })) };
    },
    async create(actor: Actor, body: unknown) {
      if (actor.role !== 'Inventory Staff') throw forbidden();
      const input = typedChangeRequestInput(body);
      const created = await driver.connection.transaction(async session => {
        const ingredient = await (ingredients as any).findOne({ _id: input.ingredientId, isActive: { $ne: false } }).session(session).lean().exec() as Ingredient | null;
        if (!ingredient) throw new AdministrationError(404, 'NOT_FOUND', 'Active ingredient not found');
        const requestID = await nextRequestId(session);
        const [document] = await (rows as any).create([{ ...input, requestID, currentValue: valueFor(ingredient, input.targetField), ingredientVersion: ingredient.version, requestedBy: actor.id }], { session });
        const row = document.toObject() as TypedRow;
        await (audits as any).create([{ userId: actor.id, action: 'CHANGE_REQUEST_SUBMITTED', targetType: 'ChangeRequest', targetId: row._id, reason: 'Typed change request submitted', oldValue: null, newValue: requestSnapshot(row) }], { session });
        return row;
      });
      return typedRecord(created);
    },
    async review(actor: Actor, id: string, outcome: 'APPROVED' | 'REJECTED', body: unknown) {
      manager(actor); const input = typedReviewInput(body, outcome === 'REJECTED');
      const reviewed = await driver.connection.transaction(async session => {
        const request = await (rows as any).findOne({ _id: objectId(id), schemaVersion: 2 }).session(session).lean().exec() as TypedRow | null;
        if (!request) throw notFound();
        if (request.status !== 'PENDING' || request.version !== input.expectedVersion) throw conflict();
        const ingredient = await (ingredients as any).findOne({ _id: request.ingredientId }).session(session).lean().exec() as Ingredient | null;
        if (!ingredient || ingredient.isActive === false) throw conflict('The target ingredient is no longer active.');
        if (ingredient.version !== request.ingredientVersion || valueFor(ingredient, request.targetField) !== request.currentValue) throw conflict('The target ingredient changed after this request was submitted.');
        const reviewedAt = clock();
        let ingredientAfter: Ingredient | undefined;
        if (outcome === 'APPROVED') {
          const value = fieldValue(request.requestType, request.requestedValue);
          const updatedIngredient = await (ingredients as any).findOneAndUpdate({ _id: ingredient._id, isActive: { $ne: false }, version: ingredient.version }, { $set: { [request.targetField]: value }, $inc: { version: 1 } }, { session, returnDocument: 'after', runValidators: true }).lean().exec() as Ingredient | null;
          if (!updatedIngredient) throw conflict();
          ingredientAfter = updatedIngredient;
        }
        const after = await (rows as any).findOneAndUpdate({ _id: request._id, schemaVersion: 2, status: 'PENDING', version: input.expectedVersion }, { $set: { status: outcome, reviewedBy: actor.id, reviewedAt, reviewNote: input.reviewNote }, $inc: { version: 1 } }, { session, returnDocument: 'after', runValidators: true }).lean().exec() as TypedRow | null;
        if (!after) throw conflict();
        await (audits as any).create([{ userId: actor.id, action: outcome === 'APPROVED' ? 'CHANGE_REQUEST_APPROVED' : 'CHANGE_REQUEST_REJECTED', targetType: 'ChangeRequest', targetId: request._id, reason: input.reviewNote || `Typed change request ${outcome.toLowerCase()}`, oldValue: requestSnapshot(request), newValue: requestSnapshot(after) }], { session });
        if (ingredientAfter) await (audits as any).create([{ userId: actor.id, action: 'UPDATE', targetType: 'Ingredient', targetId: ingredient._id, reason: `Approved ${request.requestID}`, oldValue: ingredientSnapshot(ingredient), newValue: ingredientSnapshot(ingredientAfter) }], { session });
        return after;
      });
      return typedRecord(reviewed);
    },
  };
}
export type ChangeRequestService = ReturnType<typeof createChangeRequests>;
export { manilaDateKey };
