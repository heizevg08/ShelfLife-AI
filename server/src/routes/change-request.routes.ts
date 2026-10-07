import { secureJson as json, mongoInputGuard } from '../middleware/request-security.middleware';
import type { AuthService } from '../services/auth';
import type { ChangeRequestService } from '../services/change-requests';
import { authorizeAdministration } from '../middleware/administration.middleware';
import { changeRequestControllers } from '../controllers/change-request.controller';
import { finishInventoryRouter, inventoryRouter } from './inventory-router';

export function changeRequestRoutes(auth: AuthService, service: ChangeRequestService) {
  const router = inventoryRouter(auth), actions = changeRequestControllers(service);
  const staff = authorizeAdministration(['Inventory Staff']), manager = authorizeAdministration(['Inventory Manager']);
  router.use(mongoInputGuard);
  router.get('/summary', staff, actions.summary);
  router.get('/manager-summary', manager, actions.managerSummary);
  router.get('/ingredient-options', authorizeAdministration(['Inventory Staff', 'Inventory Manager']), actions.ingredientOptions);
  router.get('/', authorizeAdministration(['Inventory Staff', 'Inventory Manager', 'Super Admin']), actions.list);
  router.get('/:id', authorizeAdministration(['Inventory Staff', 'Inventory Manager', 'Super Admin']), actions.detail);
  router.post('/', staff, json({ limit: '100kb' }), actions.create);
  router.post('/:id/approve', manager, json({ limit: '100kb' }), actions.approve);
  router.post('/:id/reject', manager, json({ limit: '100kb' }), actions.reject);
  // Legacy documents (without schemaVersion: 2) are listed as read-only history.
  // PATCH and DELETE are deliberately absent; no generic mutation path remains.
  return finishInventoryRouter(router);
}
