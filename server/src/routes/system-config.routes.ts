import { mongoInputGuard, secureJson as json } from '../middleware/request-security.middleware';
import type { AuthService } from '../services/auth';
import type { SystemConfigService } from '../services/system-config';
import { authorizeAdministration } from '../middleware/administration.middleware';
import { ROLES } from '../models/user';
import { finishInventoryRouter, inventoryRouter } from './inventory-router';

export function systemConfigRoutes(auth: AuthService, service: SystemConfigService) {
  const router = inventoryRouter(auth);
  router.get('/', authorizeAdministration([...ROLES]), mongoInputGuard, async (_req, res) => { res.json(await service.get()); });
  router.patch('/', authorizeAdministration(['Super Admin']), json({ limit: '100kb' }), async (req, res) => { res.json(await service.patch(res.locals.user.id, req.body)); });
  return finishInventoryRouter(router);
}
