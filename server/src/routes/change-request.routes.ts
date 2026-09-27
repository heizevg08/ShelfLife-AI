import { secureJson as json } from '../middleware/request-security.middleware';
import type { AuthService } from '../services/auth';
import type { ChangeRequestService } from '../services/change-requests';
import { authorizeAdministration } from '../middleware/administration.middleware';
import { changeRequestId } from '../validators/change-request';
import { finishInventoryRouter, inventoryRouter } from './inventory-router';

export function changeRequestRoutes(auth: AuthService, service: ChangeRequestService) {
  const router = inventoryRouter(auth), staff = authorizeAdministration(['Inventory Staff']);
  router.get('/', authorizeAdministration(['Inventory Staff', 'Inventory Manager', 'Super Admin']), async (_req, res) => {
    res.json(await service.list(res.locals.user));
  });
  router.post('/', staff, json({ limit: '100kb' }), async (req, res) => {
    res.status(201).json({ request: await service.create(res.locals.user, req.body) });
  });
  router.patch('/:id', staff, json({ limit: '100kb' }), async (req, res) => {
    res.json({ request: await service.update(res.locals.user, changeRequestId(req.params.id), req.body) });
  });
  router.delete('/:id', staff, async (req, res) => {
    await service.remove(res.locals.user, changeRequestId(req.params.id));
    res.status(204).end();
  });
  return finishInventoryRouter(router);
}