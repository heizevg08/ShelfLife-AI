import type { Mongoose } from 'mongoose';
import { CHANGE_REQUEST_TARGET_FIELDS, CHANGE_REQUEST_TYPES } from '../models/change-request';
import { AdministrationError, forbidden } from '../middleware/administration.middleware';
import type { Actor } from './administration';
import type { ChangeRequestInput, ChangeRequestTargetField } from '../validators/change-request';

const typeLabel = (type: string) => type.split('_').map(word => word[0] + word.slice(1).toLowerCase()).join(' ');
const fieldValue = (ingredient: any, field: ChangeRequestTargetField) => String(ingredient[field] ?? '');
const parsedValue = (field: ChangeRequestTargetField, value: string) => ['minimumStock', 'standardUnitCost', 'defaultShelfLifeDays'].includes(field) ? Number(value) : value;

export function createChangeRequests(driver: Mongoose, requests: any, counters: any, ingredients: any, _batches: any, users: any, audits: any) {
  const name = (user: any) => `${user?.firstName ?? ''} ${user?.lastName ?? ''}`.trim() || user?.name?.trim() || 'Unknown account';
  const view = async (row: any) => {
    const [ingredient, requester, reviewer] = await Promise.all([
      ingredients.findById(row.ingredientId).select('_id name').lean().exec(),
      users.findById(row.requestedBy).select('_id name firstName lastName').lean().exec(),
      row.reviewedBy ? users.findById(row.reviewedBy).select('_id name firstName lastName').lean().exec() : null,
    ]);
    return { id: row._id.toString(), requestID: row.requestID, requestType: row.requestType, targetField: row.targetField, ingredient: ingredient ? { id: ingredient._id.toString(), name: ingredient.name } : undefined, reason: row.reason, currentValue: row.currentValue, requestedValue: row.requestedValue, status: row.status, requestedBy: { id: requester?._id?.toString() ?? row.requestedBy.toString(), name: name(requester) }, reviewedBy: reviewer ? { id: reviewer._id.toString(), name: name(reviewer) } : undefined, reviewedAt: row.reviewedAt?.toISOString(), reviewNote: row.reviewNote, createdAt: row.createdAt.toISOString(), updatedAt: row.updatedAt.toISOString() };
  };
  const ensureRole = (actor: Actor) => { if (!['Inventory Staff', 'Manager', 'Super Admin'].includes(actor.role)) throw forbidden(); };
  return {
    async list(actor: Actor, query: any) {
      ensureRole(actor); const filter: any = actor.role === 'Inventory Staff' ? { requestedBy: actor.id } : {};
      if (query.currentOnly) { filter.requestType = { $in: CHANGE_REQUEST_TYPES }; filter.targetField = { $in: CHANGE_REQUEST_TARGET_FIELDS }; }
      if (query.type) filter.requestType = query.type; if (query.status) filter.status = query.status; if (query.from || query.to) filter.createdAt = { ...(query.from ? { $gte: query.from } : {}), ...(query.to ? { $lte: query.to } : {}) };
      if (query.search) { const rows = await requests.find(filter).sort({ createdAt: -1, _id: -1 }).populate('ingredientId', 'name').lean().exec(); const term = query.search.toLowerCase(); const items = rows.filter((row: any) => [row.requestID, row.ingredientId?.name].some(value => value?.toLowerCase().includes(term))); return { items: await Promise.all(items.slice((query.page - 1) * query.pageSize, query.page * query.pageSize).map(view)), page: query.page, pageSize: query.pageSize, total: items.length }; }
      const total = await requests.countDocuments(filter), rows = await requests.find(filter).sort({ createdAt: -1, _id: -1 }).skip((query.page - 1) * query.pageSize).limit(query.pageSize).lean().exec(); return { items: await Promise.all(rows.map(view)), page: query.page, pageSize: query.pageSize, total };
    },
    async detail(actor: Actor, id: string) { ensureRole(actor); const row = await requests.findById(id).lean().exec(); if (!row || (actor.role === 'Inventory Staff' && row.requestedBy.toString() !== actor.id)) throw new AdministrationError(404, 'NOT_FOUND', 'Change request not found'); return view(row); },
    async summary(actor: Actor) { if (actor.role !== 'Inventory Staff') throw forbidden(); const counts = await requests.aggregate([{ $match: { requestedBy: new driver.Types.ObjectId(actor.id) } }, { $group: { _id: '$status', count: { $sum: 1 } } }]); const map = new Map<string, number>(counts.map((row: any) => [row._id, row.count])); return { totalRequests: [...map.values()].reduce((a, b) => a + b, 0), approved: map.get('APPROVED') ?? 0, pending: map.get('PENDING') ?? 0, rejected: map.get('REJECTED') ?? 0 }; },
    async create(actor: Actor, input: ChangeRequestInput) {
      if (actor.role !== 'Inventory Staff') throw forbidden(); const ingredient = await ingredients.findById(input.ingredientId).select(CHANGE_REQUEST_TARGET_FIELDS.join(' ')).lean().exec(); if (!ingredient) throw new AdministrationError(404, 'NOT_FOUND', 'Ingredient not found');
      return driver.connection.transaction(async (session: any) => { const now = new Date(), dateKey = `${now.getUTCFullYear()}${String(now.getUTCMonth() + 1).padStart(2, '0')}${String(now.getUTCDate()).padStart(2, '0')}`; const counter = await counters.findOneAndUpdate({ dateKey }, { $inc: { sequence: 1 } }, { new: true, upsert: true, setDefaultsOnInsert: true, session }).lean().exec(); const requestID = `REQ-${dateKey}-${String(counter.sequence).padStart(3, '0')}`; const created = await requests.create([{ ...input, currentValue: fieldValue(ingredient, input.targetField), requestID, status: 'PENDING', requestedBy: new driver.Types.ObjectId(actor.id) }], { session }); const row = created[0]; await audits.create([{ userId: actor.id, actorName: actor.name?.trim() || 'Unknown account', actorRole: actor.role, action: 'CREATE', targetType: 'ChangeRequest', targetId: row._id.toString(), targetName: requestID, module: 'Change Requests', status: 'Success', details: `${typeLabel(input.requestType)} submitted` }], { session }); return view(row); });
    },
    async review(actor: Actor, id: string, status: 'APPROVED' | 'REJECTED', reviewNote?: string) {
      if (actor.role !== 'Manager') throw forbidden();
      return driver.connection.transaction(async (session: any) => {
        const pending = await requests.findOne({ _id: id, status: 'PENDING' }).session(session).lean().exec(); if (!pending) throw new AdministrationError(409, 'CONFLICT', 'This change request has already been reviewed');
        if (status === 'APPROVED') {
          if (!CHANGE_REQUEST_TYPES.includes(pending.requestType) || !CHANGE_REQUEST_TARGET_FIELDS.includes(pending.targetField)) throw new AdministrationError(409, 'CONFLICT', 'Legacy requests cannot be applied through this workflow');
          const ingredient = await ingredients.findById(pending.ingredientId).session(session).lean().exec(); if (!ingredient) throw new AdministrationError(404, 'NOT_FOUND', 'Ingredient not found');
          if (fieldValue(ingredient, pending.targetField) !== pending.currentValue) throw new AdministrationError(409, 'CONFLICT', 'The ingredient changed after this request was submitted');
          await ingredients.updateOne({ _id: pending.ingredientId }, { $set: { [pending.targetField]: parsedValue(pending.targetField, pending.requestedValue) } }, { session, runValidators: true });
          await audits.create([{ userId: actor.id, actorName: actor.name?.trim() || 'Unknown account', actorRole: actor.role, action: 'UPDATE', targetType: 'Ingredient', targetId: pending.ingredientId.toString(), targetName: pending.requestID, module: 'Ingredients', status: 'Success', details: `Applied approved ${typeLabel(pending.requestType)}` }], { session });
        }
        const row = await requests.findOneAndUpdate({ _id: id, status: 'PENDING' }, { $set: { status, reviewedBy: new driver.Types.ObjectId(actor.id), reviewedAt: new Date(), ...(reviewNote ? { reviewNote } : {}) } }, { new: true, session }).lean().exec(); if (!row) throw new AdministrationError(409, 'CONFLICT', 'This change request has already been reviewed');
        await audits.create([{ userId: actor.id, actorName: actor.name?.trim() || 'Unknown account', actorRole: actor.role, action: 'UPDATE', targetType: 'ChangeRequest', targetId: id, targetName: row.requestID, module: 'Change Requests', status: 'Success', details: `${status === 'APPROVED' ? 'Approved and applied' : 'Rejected'} ${typeLabel(row.requestType)}` }], { session }); return view(row);
      });
    },
  };
}
