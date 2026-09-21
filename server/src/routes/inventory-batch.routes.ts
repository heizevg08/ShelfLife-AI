import { json } from 'express';
import type { AuthService } from '../services/auth';
import type { InventoryBatchService } from '../services/inventory-batches';
import { authorizeAdministration } from '../middleware/administration.middleware';
import { ROLES } from '../models/user';
import { objectId } from '../validators/administration';
import { finishInventoryRouter, inventoryRouter } from './inventory-router';

export function inventoryBatchRoutes(auth: AuthService, service: InventoryBatchService) {
  const router = inventoryRouter(auth), manager = authorizeAdministration(['Inventory Manager']), parse = json({ limit: '100kb' });
  router.get('/', authorizeAdministration([...ROLES]), async (req, res) => { res.json(await service.list(req.query)); });
  router.get('/:id', authorizeAdministration([...ROLES]), async (req, res) => { res.json({ batch: await service.get(objectId(req.params.id)) }); });
  router.post('/', manager, parse, async (req, res) => { res.status(201).json({ batch: await service.create(res.locals.user, req.body) }); });
  router.patch('/:id', manager, parse, async (req, res) => { res.json({ batch: await service.patch(res.locals.user, objectId(req.params.id), req.body) }); });
  router.post('/:id/quantity-corrections', manager, parse, async (req, res) => { res.json({ batch: await service.correctQuantity(res.locals.user, objectId(req.params.id), req.body) }); });
  router.delete('/:id', manager, parse, async (req, res) => { await service.archive(res.locals.user, objectId(req.params.id), req.body); res.status(204).end(); });
  return finishInventoryRouter(router);
}
