import { Router, type ErrorRequestHandler } from 'express';
import { authenticate } from '../middleware/auth.middleware';
import { AdministrationError, authorizeAdministration } from '../middleware/administration.middleware';
import { HttpError } from '../middleware/error.middleware';
import type { AuthService } from '../services/auth';
import type { ChangeRequestService } from '../services/change-requests';
import { changeRequestControllers } from '../controllers/change-request.controller';
import { mongoInputGuard, secureJson } from '../middleware/request-security.middleware';

/**
 * Register the change-request routes on a new router.
 *
 * @param auth - the auth service used to guard every route.
 * @param service - the change-request service behind the handlers.
 * @returns the configured router.
 */
export function changeRequestRoutes(auth: AuthService, service: ChangeRequestService) {
  const router = Router(), actions = changeRequestControllers(service);
  router.use((_req, res, next) => { res.setHeader('Cache-Control', 'no-store'); next(); });
  router.use(authenticate(auth));
  router.use(mongoInputGuard);
  router.get('/summary', authorizeAdministration(['Inventory Staff']), actions.summary);
  router.get('/manager-summary', authorizeAdministration(['Manager']), actions.managerSummary);
  router.get('/ingredient-options', authorizeAdministration(['Inventory Staff', 'Manager']), actions.ingredientOptions);
  router.get('/', authorizeAdministration(['Inventory Staff', 'Manager']), actions.list);
  router.get('/:id', authorizeAdministration(['Inventory Staff', 'Manager']), actions.detail);
  router.post('/', authorizeAdministration(['Inventory Staff']), secureJson({ limit: '100kb' }), actions.create);
  router.post('/:id/approve', authorizeAdministration(['Manager']), secureJson({ limit: '100kb' }), actions.approve);
  router.post('/:id/reject', authorizeAdministration(['Manager']), secureJson({ limit: '100kb' }), actions.reject);
  router.use((_req, res) => res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Not found', details: [] } }));
  const error: ErrorRequestHandler = (value, _req, res, next) => {
    if (res.headersSent) { next(value); return; }
    if (value instanceof AdministrationError) { res.status(value.status).json({ error: { code: value.code, message: value.message, details: value.details } }); return; }
    if (value instanceof HttpError) { res.status(value.status).json({ error: { code: value.status === 401 ? 'UNAUTHENTICATED' : 'REQUEST_FAILED', message: value.message, details: [] } }); return; }
    if (value && typeof value === 'object' && value.name === 'ValidationError' && 'errors' in value) {
      const fields = Object.values(value.errors as Record<string, { path?: unknown; message?: unknown }>).map(detail => ({
        field: typeof detail.path === 'string' ? detail.path : 'requestedValue',
        message: typeof detail.message === 'string' ? detail.message : 'Enter a valid value.',
      }));
      res.status(400).json({ error: { code: 'VALIDATION_ERROR', message: 'Check the supplied fields', details: fields } }); return;
    }
    if (value && typeof value === 'object' && 'code' in value && value.code === 11000) {
      res.status(409).json({ error: { code: 'CONFLICT', message: 'This request could not be saved because its identifier is already in use. Please try again.', details: [] } }); return;
    }
    next(value);
  };
  router.use(error);
  return router;
}
