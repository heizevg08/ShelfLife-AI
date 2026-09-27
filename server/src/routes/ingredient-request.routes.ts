import { secureJson as json } from '../middleware/request-security.middleware';
import type { AuthService } from '../services/auth';
import type { IngredientRequestService } from '../services/ingredient-requests';
import { authorizeAdministration } from '../middleware/administration.middleware';
import { ingredientRequestId, ingredientRequestInput, ingredientRequestPatch, ingredientRequestReview } from '../validators/ingredient-request';
import { finishInventoryRouter, inventoryRouter } from './inventory-router';

export function ingredientRequestRoutes(auth: AuthService, service: IngredientRequestService) {
  const router = inventoryRouter(auth);
  router.get('/', authorizeAdministration(['Inventory Staff', 'Inventory Manager', 'Admin', 'Super Admin']), async (_req, res) => {
    res.json(await service.list(res.locals.user));
  });
  router.post('/', authorizeAdministration(['Inventory Staff']), json({ limit: '100kb' }), async (req, res) => {
    res.status(201).json({ request: await service.create(res.locals.user, ingredientRequestInput(req.body)) });
  });
  router.patch('/:id', authorizeAdministration(['Inventory Staff']), json({ limit: '100kb' }), async (req, res) => {
    const patch = ingredientRequestPatch(req.body);
    res.json({ request: await service.update(res.locals.user, ingredientRequestId(req.params.id), patch.input, patch.expectedVersion) });
  });
  router.patch('/:id/review', authorizeAdministration(['Inventory Manager', 'Admin', 'Super Admin']), json({ limit: '100kb' }), async (req, res) => {
    res.json(await service.review(res.locals.user, ingredientRequestId(req.params.id), ingredientRequestReview(req.body)));
  });
  router.delete('/:id', authorizeAdministration(['Inventory Manager', 'Admin', 'Super Admin']), async (req, res) => {
    await service.remove(res.locals.user, ingredientRequestId(req.params.id));
    res.status(204).end();
  });
  return finishInventoryRouter(router);
}