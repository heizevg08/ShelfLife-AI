import type { ClientSession, Mongoose } from 'mongoose';
import type { userModel } from '../models/user';
import { ROLES } from '../models/user';
import type { auditRecordModel } from '../models/audit-record';
import type { Account, AdministrationStore } from './administration';
import type { AuditPageQuery, PageQuery } from '../validators/administration';

const publicFields = '_id firstName lastName email role isActive createdAt updatedAt';
type PublicDocument = { _id: { toString(): string }; firstName: string; lastName: string; email: string; role: string; isActive: boolean; createdAt: Date; updatedAt: Date };
function account(user: PublicDocument): Account {
  return { id: user._id.toString(), firstName: user.firstName, lastName: user.lastName,
    name: `${user.firstName} ${user.lastName}`, email: user.email, role: user.role, isActive: user.isActive,
    createdAt: user.createdAt.toISOString(), updatedAt: user.updatedAt.toISOString() };
}
const sorting = (query: PageQuery): Record<string, 1 | -1> => ({ [query.sortBy]: query.sortOrder === 'asc' ? 1 : -1, _id: query.sortOrder === 'asc' ? 1 : -1 });
export function createAdministrationStore(driver: Mongoose, users: ReturnType<typeof userModel>, audits: ReturnType<typeof auditRecordModel>): AdministrationStore {
  const get = async (id: string, session?: ClientSession) => {
    const user = await users.findById(id).select(publicFields).session(session ?? null).lean().exec();
    return user ? account(user) : null;
  };
  return {
    get,
    async list(roles, query) {
      const filter = roles ? { role: { $in: ROLES.filter(role => roles.includes(role)) } } : {};
      const [rows, total] = await Promise.all([
        users.find(filter).select(publicFields).sort(sorting(query)).skip((query.page - 1) * query.pageSize).limit(query.pageSize).lean().exec(),
        users.countDocuments(filter).exec(),
      ]);
      return { items: rows.map(account), page: query.page, pageSize: query.pageSize, total };
    },
    async summary(roles = null) {
      const roleFilter = roles ? { role: { $in: ROLES.filter(role => roles.includes(role)) } } : {};
      const [counts] = await users.aggregate([{ $match: roleFilter }, { $group: { _id: null, totalUsers: { $sum: 1 }, activeUsers: { $sum: { $cond: [{ $eq: ['$isActive', true] }, 1, 0] } }, inactiveUsers: { $sum: { $cond: [{ $eq: ['$isActive', false] }, 1, 0] } } } }]).exec();
      return { totalUsers: counts?.totalUsers ?? 0, activeUsers: counts?.activeUsers ?? 0, inactiveUsers: counts?.inactiveUsers ?? 0 };
    },
    async audits(query) {
      const filter: Record<string, unknown> = {};
      if (query.action) filter.action = query.action;
      if (query.from) filter.timestamp = { $gte: query.from };
      if (query.actorRole) {
        const actors = await users.find({ role: query.actorRole }).select('_id').lean().exec();
        filter.userId = { $in: actors.map(actor => actor._id) };
      }
      const [rows, total] = await Promise.all([
        audits.find(filter).sort(sorting(query)).skip((query.page - 1) * query.pageSize).limit(query.pageSize).lean().exec(),
        audits.countDocuments(filter).exec(),
      ]);
      const actorIds = [...new Set(rows.map(row => row.userId.toString()))];
      const actorRows = await users.find({ _id: { $in: actorIds } }).select('_id firstName lastName role').lean().exec();
      const actorById = new Map(actorRows.map(actor => [actor._id.toString(), { id: actor._id.toString(), name: `${actor.firstName} ${actor.lastName}`, role: actor.role }]));
      return { items: rows.map(row => {
        const userId = row.userId.toString();
        return { id: row._id.toString(), userId, actor: actorById.get(userId) ?? { id: userId, name: 'Unknown account', role: 'Unavailable' }, action: row.action, targetType: row.targetType, targetId: row.targetId.toString(), timestamp: row.timestamp.toISOString() };
      }), page: query.page, pageSize: query.pageSize, total };
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
        async audit(userId, action, targetId) { await audits.create([{ userId, action, targetType: 'User', targetId }], { session }); },
      }));
    },
  };
}
