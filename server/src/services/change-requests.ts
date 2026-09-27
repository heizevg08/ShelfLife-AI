import type { Types } from 'mongoose';
import type { changeRequestModel } from '../models/change-request';
import { AdministrationError } from '../middleware/administration.middleware';
import { changeRequestInput, changeRequestPatch } from '../validators/change-request';

type Actor = { id: string; role: string };
type Row = {
  _id: Types.ObjectId; target: string; type: string; proposedCorrection: string; reason: string;
  status: 'Pending' | 'Approved' | 'Rejected'; version: number; createdBy: Types.ObjectId; createdAt: Date; updatedAt: Date;
};
const notFound = () => new AdministrationError(404, 'NOT_FOUND', 'Change request not found');
const forbidden = () => new AdministrationError(403, 'FORBIDDEN', 'This action is not permitted');
function record(row: Row) {
  return { id: row._id.toString(), target: row.target, type: row.type, proposedCorrection: row.proposedCorrection, reason: row.reason,
    status: row.status, version: row.version, createdBy: row.createdBy.toString(), createdAt: row.createdAt.toISOString(), updatedAt: row.updatedAt.toISOString() };
}

export function createChangeRequests(rows: ReturnType<typeof changeRequestModel>) {
  return {
    async list(actor: Actor) {
      if (!['Inventory Staff', 'Inventory Manager', 'Super Admin'].includes(actor.role)) throw forbidden();
      const filter = actor.role === 'Inventory Staff' ? { createdBy: actor.id } : {};
      const [items, total] = await Promise.all([
        rows.find(filter).sort({ createdAt: -1, _id: -1 }).limit(100).lean().exec() as Promise<Row[]>,
        rows.countDocuments(filter).exec(),
      ]);
      return { items: items.map(record), total };
    },
    async create(actor: Actor, body: unknown) {
      if (actor.role !== 'Inventory Staff') throw forbidden();
      const [created] = await rows.create([{ ...changeRequestInput(body), createdBy: actor.id }]);
      return record(created.toObject() as Row);
    },
    async update(actor: Actor, id: string, body: unknown) {
      if (actor.role !== 'Inventory Staff') throw forbidden();
      const input = changeRequestPatch(body);
      const updated = await rows.findOneAndUpdate({ _id: id, createdBy: actor.id, status: 'Pending', version: input.expectedVersion }, {
        $set: { target: input.target, type: input.type, proposedCorrection: input.proposedCorrection, reason: input.reason }, $inc: { version: 1 },
      }, { returnDocument: 'after', runValidators: true }).lean().exec() as Row | null;
      if (!updated) throw notFound();
      return record(updated);
    },
    async remove(actor: Actor, id: string) {
      if (actor.role !== 'Inventory Staff') throw forbidden();
      const removed = await rows.findOneAndDelete({ _id: id, createdBy: actor.id, status: 'Pending' }).lean().exec();
      if (!removed) throw notFound();
    },
  };
}
export type ChangeRequestService = ReturnType<typeof createChangeRequests>;