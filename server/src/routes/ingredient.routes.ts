import { Router, json, type ErrorRequestHandler } from 'express';
import type { AuthService } from '../services/auth';
import type { IngredientService } from '../services/ingredients';
import { authenticate } from '../middleware/auth.middleware';
import { AdministrationError, authorizeAdministration } from '../middleware/administration.middleware';
import { HttpError } from '../middleware/error.middleware';
import { ingredientControllers } from '../controllers/ingredient.controller';

export function ingredientRoutes(auth: AuthService, service: IngredientService) {
  const router = Router(), actions = ingredientControllers(service);
  router.use((_req, res, next) => { res.setHeader('Cache-Control', 'no-store'); next(); });
  router.use(authenticate(auth));

  router.get('/', authorizeAdministration(['Super Admin', 'Admin', 'Inventory Manager', 'Inventory Staff']), actions.list);
  router.post('/', authorizeAdministration(['Inventory Manager', 'Inventory Staff']), json({ limit: '100kb' }), actions.create);
  router.put('/:id', authorizeAdministration(['Inventory Manager']), json({ limit: '100kb' }), actions.update);
  router.delete('/:id', authorizeAdministration(['Inventory Manager']), actions.remove);
  router.use((_req, res) => { res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Not found', details: [] } }); });
  const error: ErrorRequestHandler = (value, _req, res, next) => {
    if (res.headersSent) { next(value); return; }
    if (value instanceof AdministrationError) { res.status(value.status).json({ error: { code: value.code, message: value.message, details: value.details } }); return; }
    if (value instanceof HttpError) { res.status(value.status).json({ error: { code: value.status === 401 ? 'UNAUTHENTICATED' : 'REQUEST_FAILED', message: value.message, details: [] } }); return; }
    if (value?.code === 11000) { res.status(409).json({ error: { code: 'CONFLICT', message: 'An ingredient with that name already exists', details: [{ field: 'name', message: 'Use a unique ingredient name' }] } }); return; }
    if (value?.type === 'entity.parse.failed' || value?.type === 'entity.too.large') { res.status(value.type === 'entity.too.large' ? 413 : 400).json({ error: { code: 'VALIDATION_ERROR', message: 'Invalid request body', details: [] } }); return; }
    res.status(500).json({ error: { code: 'INTERNAL_ERROR', message: 'Unable to complete the request', details: [] } });
  };
  router.use(error);
  return router;
}
