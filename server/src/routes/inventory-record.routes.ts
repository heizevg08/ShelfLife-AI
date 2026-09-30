import type { AuthService } from '../services/auth';
import type { InventoryRecordService } from '../services/inventory-records';
import type { RecordKind } from '../models/inventory-record';
import { authorizeAdministration } from '../middleware/administration.middleware';
import { mongoInputGuard, secureJson as json } from '../middleware/request-security.middleware';
import { objectId } from '../validators/administration';
import { finishInventoryRouter, inventoryRouter } from './inventory-router';

export function inventoryRecordRoutes(auth: AuthService, service: InventoryRecordService, kind: RecordKind) {
  const router = inventoryRouter(auth), parse = json({ limit: '100kb' });
  const read = authorizeAdministration(['Inventory Manager', 'Admin', 'Super Admin']);
  const create = authorizeAdministration(['Inventory Manager', 'Inventory Staff']);
  const manager = authorizeAdministration(['Inventory Manager']);
  router.get('/', read, mongoInputGuard, async (req, res) => { res.json(await service.list(res.locals.user, req.query)); });
  router.get('/eligible-batches/:ingredientId', create, mongoInputGuard, async (req, res) => { res.json(await service.eligibleBatches(res.locals.user, objectId(req.params.ingredientId), req.query)); });
  router.get('/:id', read, mongoInputGuard, async (req, res) => { res.json({ record: await service.get(res.locals.user, objectId(req.params.id)) }); });
  router.post('/', create, parse, async (req, res) => { res.status(201).json({ record: await service.create(res.locals.user, req.body) }); });
  router.post('/:id/corrections', manager, parse, async (req, res) => { res.json({ record: await service.correct(res.locals.user, objectId(req.params.id), req.body) }); });
  router.delete('/:id', manager, parse, async (req, res) => { await service.archive(res.locals.user, objectId(req.params.id), req.body); res.status(204).end(); });
  return finishInventoryRouter(router);
}
