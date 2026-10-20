import { EventEmitter } from 'node:events';
import { auditRecordModel } from '../models/audit-record';

// In-process fan-out for "an audit record was written". Listeners only learn
// that the trail changed; no record payload crosses the bus, so audit content
// never leaves the database layer through this channel.
const bus = new EventEmitter();
bus.setMaxListeners(0);

export function onAuditRecorded(listener: () => void): () => void {
  bus.on('recorded', listener);
  return () => bus.off('recorded', listener);
}

// Every audit write in the system goes through the injected model's `create`
// (user management, ingredients, stock-in, usage, waste, change requests,
// exports, profile updates), so shadowing that one static covers them all.
// The ping is deferred briefly so transactional writes given a `{ session }`
// have committed before any listener re-queries the collection; a ping for a
// transaction that rolls back is harmless — the listener simply finds nothing.
export function withAuditRecordedNotifications(
  model: ReturnType<typeof auditRecordModel>
): ReturnType<typeof auditRecordModel> {
  const create = model.create.bind(model) as (...args: unknown[]) => Promise<unknown>;

  (model as unknown as { create: (...args: unknown[]) => Promise<unknown> }).create = async (...args: unknown[]) => {
    const record = await create(...args);
    setTimeout(() => bus.emit('recorded'), 100);
    return record;
  };

  return model;
}
