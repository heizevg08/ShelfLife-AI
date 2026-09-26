import type { ClientSession, Mongoose } from 'mongoose';
import type { userModel } from '../models/user';
import { normalizeUserRole, storedUserRoles } from '../models/user';
import type { auditRecordModel } from '../models/audit-record';
import type { Account, Actor, AdministrationStore } from './administration';
import type { AccountPageQuery, AuditPageQuery, PageQuery } from '../validators/administration';

const publicFields = '_id firstName lastName email role isActive lastLoginAt createdAt updatedAt';
type PublicDocument = { _id: { toString(): string }; firstName: string; lastName: string; email: string; role: string; isActive: boolean; lastLoginAt?: Date | null; createdAt: Date; updatedAt: Date };
function account(user: PublicDocument): Account {
  return { id: user._id.toString(), firstName: user.firstName, lastName: user.lastName,
    name: `${user.firstName} ${user.lastName}`, email: user.email, role: normalizeUserRole(user.role) ?? user.role, isActive: user.isActive,
    ...(user.lastLoginAt ? { lastLoginAt: user.lastLoginAt.toISOString() } : {}), createdAt: user.createdAt.toISOString(), updatedAt: user.updatedAt.toISOString() };
}
const sorting = (query: PageQuery): Record<string, 1 | -1> => ({ [query.sortBy]: query.sortOrder === 'asc' ? 1 : -1, _id: query.sortOrder === 'asc' ? 1 : -1 });
const escaped = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
export function createAdministrationStore(driver: Mongoose, users: ReturnType<typeof userModel>, audits: ReturnType<typeof auditRecordModel>): AdministrationStore {
  const get = async (id: string, session?: ClientSession) => {
    const user = await users.findById(id).select(publicFields).session(session ?? null).lean().exec();
    return user ? account(user) : null;
  };
  return {
    get,
    async list(roles, query: AccountPageQuery, includeActorId) {
      const clauses: Record<string, unknown>[] = [];
      const includeActorObjectId = includeActorId ? new driver.Types.ObjectId(includeActorId) : undefined;
      if (roles) clauses.push(includeActorObjectId ? { $or: [{ role: { $in: storedUserRoles(roles) } }, { _id: includeActorObjectId }] } : { role: { $in: storedUserRoles(roles) } });
      if (query.role) clauses.push(includeActorId && query.role === 'Admin' ? { _id: includeActorId } : { role: { $in: storedUserRoles([query.role]) } });
      if (query.status) clauses.push({ isActive: query.status === 'Active' });
      if (query.search) {
        const regex = new RegExp(escaped(query.search), 'i');
        const matches: Record<string, unknown>[] = [{ firstName: regex }, { lastName: regex }, { email: regex }, { role: regex }];
        if (/^(active|inactive|deactivated)$/i.test(query.search)) matches.push({ isActive: /^active$/i.test(query.search) });
        clauses.push({ $or: matches });
      }
      const filter = clauses.length === 0 ? {} : clauses.length === 1 ? clauses[0] : { $and: clauses };
      const rowsQuery = users.find(filter);
      const countQuery = users.countDocuments(filter);
      const [rows, total] = await Promise.all([
        rowsQuery.select(publicFields).sort(sorting(query)).skip((query.page - 1) * query.pageSize).limit(query.pageSize).lean().exec(),
        countQuery.exec(),
      ]);
      return { items: rows.map(account), page: query.page, pageSize: query.pageSize, total };
    },
    async summary(roles = null, activeOnly = false, includeActorId?: string) {
      const clauses: Record<string, unknown>[] = [];
      if (roles) clauses.push(includeActorId ? { $or: [{ role: { $in: storedUserRoles(roles) } }, { _id: includeActorId }] } : { role: { $in: storedUserRoles(roles) } });
      if (activeOnly) clauses.push({ isActive: true });
      const roleFilter = clauses.length === 0 ? {} : clauses.length === 1 ? clauses[0] : { $and: clauses };
      const [counts, roleRows] = await Promise.all([
        users.aggregate([{ $match: roleFilter }, { $group: { _id: null, totalUsers: { $sum: 1 }, activeUsers: { $sum: { $cond: [{ $eq: ['$isActive', true] }, 1, 0] } }, inactiveUsers: { $sum: { $cond: [{ $eq: ['$isActive', false] }, 1, 0] } } } }]).exec(),
        users.aggregate([{ $match: roleFilter }, { $group: { _id: '$role', count: { $sum: 1 } } }]).exec(),
      ]);
      const roleCounts = roleRows.reduce<Record<string, number>>((result, row) => {
        const role = normalizeUserRole(row._id) ?? row._id;
        result[role] = (result[role] ?? 0) + row.count;
        return result;
      }, {});
      const totals = counts[0];
      return { totalUsers: totals?.totalUsers ?? 0, activeUsers: totals?.activeUsers ?? 0, inactiveUsers: activeOnly ? 0 : totals?.inactiveUsers ?? 0, roleCounts };
    },
    async audits(query: AuditPageQuery, allowedActorRoles?: string[] | null) {
      const filter: Record<string, unknown> = {};
      if (query.action) filter.action = query.action;
      if (query.module) filter.module = new RegExp(`^${escaped(query.module)}$`, 'i');
      if (query.status) filter.status = query.status;
      if (query.from || query.to) filter.timestamp = { ...(query.from ? { $gte: query.from } : {}), ...(query.to ? { $lte: query.to } : {}) };
      const actorClauses: Record<string, unknown>[] = [];
      const rolesToMatch = query.actorRole ? [query.actorRole] : allowedActorRoles;
      if (rolesToMatch?.length) {
        const ids = await users.find().where('role').in(storedUserRoles(rolesToMatch)).select('_id').lean().exec();
        actorClauses.push({ $or: [{ actorRole: { $in: rolesToMatch } }, { userId: { $in: ids.map(actor => actor._id) } }] });
      }
      if (actorClauses.length) filter.$and = actorClauses;
      if (query.search) {
        const regex = new RegExp(escaped(query.search), 'i');
        const actorMatches = await users.find({ $or: [{ firstName: regex }, { lastName: regex }, { email: regex }, { role: regex }] }).select('_id').lean().exec();
        const ids = actorMatches.map(actor => actor._id);
        const search = { $or: [{ action: regex }, { module: regex }, { targetType: regex }, { targetName: regex }, { details: regex }, { actorName: regex }, ...(ids.length ? [{ userId: { $in: ids } }] : [])] };
        filter.$and = [...(Array.isArray(filter.$and) ? filter.$and : []), search];
      }
      const [rows, total] = await Promise.all([
        audits.find(filter).sort(sorting(query)).skip((query.page - 1) * query.pageSize).limit(query.pageSize).lean().exec(),
        audits.countDocuments(filter).exec(),
      ]);
      const actorIds = [...new Set(rows.map(row => row.userId?.toString?.()).filter(Boolean))];
      const actorRows = await users.find({ _id: { $in: actorIds } }).select('_id firstName lastName role').lean().exec();
      const actorById = new Map(actorRows.map(actor => [actor._id.toString(), { id: actor._id.toString(), name: `${actor.firstName} ${actor.lastName}`, role: normalizeUserRole(actor.role) ?? actor.role }]));
      const userTargetIds = [...new Set(rows.flatMap(row => row.targetType === 'User' && row.targetId ? [row.targetId.toString()] : []))];
      const targetRows = userTargetIds.length ? await users.find({ _id: { $in: userTargetIds } }).select('_id firstName lastName').lean().exec() : [];
      const targetNameById = new Map(targetRows.map(target => [target._id.toString(), `${target.firstName} ${target.lastName}`.trim()]));
      return { items: rows.map(row => {
        const userId = row.userId?.toString?.() ?? '';
        const targetId = row.targetId?.toString?.();
        const liveActor = userId ? actorById.get(userId) : undefined;
        const actor = liveActor
          ? { ...liveActor, ...(row.actorName ? { name: row.actorName } : {}), ...(row.actorRole ? { role: row.actorRole } : {}) }
          : row.actorName && row.actorRole ? { id: userId, name: row.actorName, role: row.actorRole } : { id: userId, name: 'Unknown account', role: 'Unavailable' };
        return { id: row._id.toString(), userId, actor, action: row.action, targetType: row.targetType, ...(targetId ? { targetId } : {}), ...(row.targetName ? { targetName: row.targetName } : targetId && targetNameById.get(targetId) ? { targetName: targetNameById.get(targetId) } : {}), ...(row.module ? { module: row.module } : {}), status: row.status ?? 'Success', ...(row.details ? { details: row.details } : {}), timestamp: row.timestamp.toISOString() };
      }), page: query.page, pageSize: query.pageSize, total };
    },
    async recordAudit(actor: Actor, record) {
      await audits.create({ userId: actor.id, actorName: actor.name?.trim() || 'Unknown account', actorRole: normalizeUserRole(actor.role) ?? undefined, ...record });
    },
    async transaction(work) {
      // Account changes and audit records succeed together or both roll back.
      return driver.connection.transaction(async session => work({
        get: id => get(id, session),
        async create(input) {
          const [row] = await users.create([{ ...input, isActive: true }], { session });
          return account(row);
        },
        async update(id, input) {
          const invalidate = input.isActive === false || input.role !== undefined || input.email !== undefined;
          const row = await users.findByIdAndUpdate(id, {
            $set: input,
            ...(invalidate ? { $inc: { authVersion: 1 }, $unset: { resetTokenHash: 1, resetExpiresAt: 1 } } : {}),
          }, { session, new: true, runValidators: true }).select(publicFields).lean().exec();
          if (!row) throw new Error('Account changed during transaction');
          return account(row);
        },
        async audit(actor, action, targetId) {
          await audits.create([{ userId: actor.id, actorName: actor.name?.trim() || 'Unknown account', actorRole: normalizeUserRole(actor.role) ?? undefined, action, targetType: 'User', targetId, targetName: 'User account', module: 'User Management', status: 'Success' }], { session });
        },
      }));
    },
  };
}
