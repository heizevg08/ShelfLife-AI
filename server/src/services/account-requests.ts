import type { Mongoose, Types } from 'mongoose';
import type { accountRequestModel } from '../models/account-request';
import type { userModel } from '../models/user';
import type { auditRecordModel } from '../models/audit-record';
import type { accountRequestInput, accountRequestReview } from '../validators/account-request';
import { AdministrationError, forbidden } from '../middleware/administration.middleware';
import { versionConflict } from '../validators/inventory-contract';
import { hashPassword } from './password';
import { auditSnapshot } from './audit-snapshot';

type Actor = { id: string; role: string };
type RequestInput = ReturnType<typeof accountRequestInput>;
type ReviewInput = ReturnType<typeof accountRequestReview>;
type RequestRow = RequestInput & {
  _id: Types.ObjectId; requestedBy: Types.ObjectId; requestedByRole: string; status: 'Pending' | 'Approved' | 'Rejected';
  reviewedBy?: Types.ObjectId; reviewNote: string; accountId?: Types.ObjectId; version: number; createdAt: Date; updatedAt: Date;
  isDeleted?: boolean; deletedBy?: Types.ObjectId;
};
const missing = () => new AdministrationError(404, 'NOT_FOUND', 'Account request not found');
export const canReviewAccountRequest = (actor: Actor, _row: Pick<RequestRow, 'requestedByRole' | 'role'>) => actor.role === 'Super Admin';
const value = (row: RequestRow, requester?: { name: string; role: string }, reviewer?: { name: string }) => ({
  id: row._id.toString(), firstName: row.firstName, lastName: row.lastName, email: row.email, role: row.role,
  requestedBy: { id: row.requestedBy.toString(), name: requester?.name ?? 'Unknown account', role: requester?.role ?? row.requestedByRole },
  status: row.status, reviewedBy: row.reviewedBy ? { id: row.reviewedBy.toString(), name: reviewer?.name ?? 'Unknown account' } : null,
  reviewNote: row.reviewNote, accountId: row.accountId?.toString() ?? null, isDeleted: row.isDeleted === true, deletedBy: row.deletedBy?.toString() ?? null, version: row.version,
  createdAt: row.createdAt.toISOString(), updatedAt: row.updatedAt.toISOString(),
});

export function createAccountRequests(driver: Mongoose, requests: ReturnType<typeof accountRequestModel>, users: ReturnType<typeof userModel>, audits: ReturnType<typeof auditRecordModel>) {
  async function serialize(rows: RequestRow[]) {
    const ids = [...new Set(rows.flatMap(row => [row.requestedBy.toString(), ...(row.reviewedBy ? [row.reviewedBy.toString()] : [])]))];
    const people = await users.find({ _id: { $in: ids } }).select('_id firstName lastName role').lean().exec();
    const names = new Map(people.map(person => [person._id.toString(), { name: `${person.firstName} ${person.lastName}`, role: person.role }]));
    return rows.map(row => value(row, names.get(row.requestedBy.toString()), row.reviewedBy ? names.get(row.reviewedBy.toString()) : undefined));
  }
  return {
    async list(actor: Actor) {
      if (!['Super Admin', 'Admin'].includes(actor.role)) throw forbidden();
      const filter: Record<string, unknown> = { isDeleted: { $ne: true }, ...(actor.role === 'Super Admin' ? {} : { requestedBy: actor.id }) };
      const rows = await requests.find(filter).sort({ createdAt: -1, _id: -1 }).limit(100).lean().exec() as RequestRow[];
      return { items: await serialize(rows), total: rows.length };
    },
    async create(actor: Actor, input: RequestInput) {
      if (actor.role !== 'Admin') throw forbidden();
      const row = await driver.connection.transaction(async session => {
        const created = new requests({ ...input, requestedBy: actor.id, requestedByRole: actor.role });
        await created.save({ session });
        const request = created.toObject() as RequestRow;
        await audits.create([{ userId: actor.id, action: 'CREATE', targetType: 'AccountRequest', targetId: request._id, oldValue: null,
          newValue: auditSnapshot('AccountRequest', { id: request._id.toString(), firstName: request.firstName, lastName: request.lastName, email: request.email, role: request.role, requestedBy: actor.id, requestedByRole: actor.role, status: request.status }) }], { session });
        return request;
      });
      return (await serialize([row]))[0];
    },
    async review(actor: Actor, id: string, input: ReviewInput) {
      const passwordHash = input.decision === 'Approved' ? await hashPassword('shelfLife123') : undefined;
      const result = await driver.connection.transaction(async session => {
        const before = await requests.findById(id).session(session).lean().exec() as RequestRow | null;
        if (!before || before.isDeleted) throw missing();
        if (!canReviewAccountRequest(actor, before)) throw forbidden();
        if (before.status !== 'Pending') throw missing();
        if (before.version !== input.expectedVersion) throw versionConflict();
        let accountId: Types.ObjectId | undefined;
        if (input.decision === 'Approved') {
          const [account] = await users.create([{ firstName: before.firstName, lastName: before.lastName, email: before.email, role: before.role, passwordHash: passwordHash!, mustChangePassword: true }], { session });
          accountId = account._id;
          await audits.create([{ userId: actor.id, action: 'CREATE', targetType: 'User', targetId: account._id,
            oldValue: null, newValue: auditSnapshot('User', { id: account._id.toString(), firstName: before.firstName, lastName: before.lastName, name: `${before.firstName} ${before.lastName}`, email: before.email, role: before.role, isActive: true }) }], { session });
        }
        const after = await requests.findOneAndUpdate({ _id: id, status: 'Pending', isDeleted: { $ne: true }, version: input.expectedVersion }, {
          $set: { status: input.decision, reviewedBy: actor.id, reviewNote: input.note, ...(accountId ? { accountId } : {}) },
          $inc: { version: 1 },
        }, { session, returnDocument: 'after', runValidators: true }).lean().exec() as RequestRow | null;
        if (!after) throw versionConflict();
        await audits.create([{ userId: actor.id, action: 'UPDATE', targetType: 'AccountRequest', targetId: id,
          oldValue: auditSnapshot('AccountRequest', { id, firstName: before.firstName, lastName: before.lastName, email: before.email, role: before.role, requestedBy: before.requestedBy.toString(), requestedByRole: before.requestedByRole, status: before.status, reviewedBy: before.reviewedBy?.toString() ?? null }),
          newValue: auditSnapshot('AccountRequest', { id, firstName: after.firstName, lastName: after.lastName, email: after.email, role: after.role, requestedBy: after.requestedBy.toString(), requestedByRole: after.requestedByRole, status: after.status, reviewedBy: actor.id, accountId: accountId?.toString() ?? null }), reason: input.note || `Account request ${input.decision.toLowerCase()}` }], { session });
        return after;
      });
      return (await serialize([result]))[0];
    },
    async remove(actor: Actor, id: string) {
      await driver.connection.transaction(async session => {
        const before = await requests.findById(id).session(session).lean().exec() as RequestRow | null;
        if (!before || before.isDeleted) throw missing();
        if (!canReviewAccountRequest(actor, before)) throw forbidden();
        if (before.status !== 'Approved') throw new AdministrationError(409, 'REQUEST_NOT_APPROVED', 'Only approved account requests can be removed');
        const after = await requests.findOneAndUpdate({ _id: id, status: 'Approved', isDeleted: { $ne: true } }, {
          $set: { isDeleted: true, deletedBy: actor.id }, $inc: { version: 1 },
        }, { session, returnDocument: 'after', runValidators: true }).lean().exec() as RequestRow | null;
        if (!after) throw versionConflict();
        await audits.create([{ userId: actor.id, action: 'UPDATE', targetType: 'AccountRequest', targetId: id,
          oldValue: auditSnapshot('AccountRequest', { id, firstName: before.firstName, lastName: before.lastName, email: before.email, role: before.role, requestedBy: before.requestedBy.toString(), requestedByRole: before.requestedByRole, status: before.status, reviewedBy: before.reviewedBy?.toString() ?? null, accountId: before.accountId?.toString() ?? null, isDeleted: false }),
          newValue: auditSnapshot('AccountRequest', { id, firstName: after.firstName, lastName: after.lastName, email: after.email, role: after.role, requestedBy: after.requestedBy.toString(), requestedByRole: after.requestedByRole, status: after.status, reviewedBy: after.reviewedBy?.toString() ?? null, accountId: after.accountId?.toString() ?? null, isDeleted: true, deletedBy: actor.id }),
          reason: 'Approved account request removed from the request list' }], { session });
      });
    },
  };
}
export type AccountRequestService = ReturnType<typeof createAccountRequests>;
