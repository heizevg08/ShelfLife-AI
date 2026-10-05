import { Router, type ErrorRequestHandler } from 'express';
import { authenticate } from '../middleware/auth.middleware';
import { AdministrationError, authorizeAdministration } from '../middleware/administration.middleware';
import { HttpError } from '../middleware/error.middleware';
import { changeRequestControllers } from '../controllers/change-request.controller';
import { mongoInputGuard, secureJson } from '../middleware/request-security.middleware';

export function changeRequestRoutes(auth: any, service: any) {
  const router = Router(), actions = changeRequestControllers(service);
  router.use((_req, res, next) => { res.setHeader('Cache-Control', 'no-store'); next(); });
  router.use(authenticate(auth));
  router.use(mongoInputGuard);
  router.get('/summary', authorizeAdministration(['Inventory Staff']), actions.summary);
  router.get('/manager-summary', authorizeAdministration(['Manager']), actions.managerSummary);
  router.get('/ingredient-options', authorizeAdministration(['Inventory Staff', 'Manager']), actions.ingredientOptions);
  router.get('/', authorizeAdministration(['Inventory Staff', 'Manager', 'Super Admin']), actions.list);
  router.get('/:id', authorizeAdministration(['Inventory Staff', 'Manager', 'Super Admin']), actions.detail);
  router.post('/', authorizeAdministration(['Inventory Staff']), secureJson({ limit: '100kb' }), actions.create);
  router.post('/:id/approve', authorizeAdministration(['Manager']), secureJson({ limit: '100kb' }), actions.approve);
  router.post('/:id/reject', authorizeAdministration(['Manager']), secureJson({ limit: '100kb' }), actions.reject);
  router.use((_req, res) => res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Not found', details: [] } }));
  const error: ErrorRequestHandler = (value, _req, res, next) => {
    if (res.headersSent) { next(value); return; }
    if (value instanceof AdministrationError) { res.status(value.status).json({ error: { code: value.code, message: value.message, details: value.details } }); return; }
    if (value instanceof HttpError) { res.status(value.status).json({ error: { code: value.status === 401 ? 'UNAUTHENTICATED' : 'REQUEST_FAILED', message: value.message, details: [] } }); return; }
    next(value);
  };
  router.use(error);
  return router;
}
