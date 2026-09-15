import { Router, json, type ErrorRequestHandler } from 'express';
import type { AuthService } from '../services/auth';
import type { AdministrationService } from '../services/administration';
import { authenticate } from '../middleware/auth.middleware';
import { AdministrationError, authorizeAdministration } from '../middleware/administration.middleware';
import { HttpError } from '../middleware/error.middleware';
import { administrationControllers } from '../controllers/administration.controller';

export function administrationRoutes(auth: AuthService, service: AdministrationService) {
  const router = Router(), actions = administrationControllers(service);
  router.use((_req, res, next) => { res.setHeader('Cache-Control', 'no-store'); next(); });
  router.use(authenticate(auth));
  router.use('/users', authorizeAdministration(['Super Admin', 'Admin']));
  router.use('/dashboard', authorizeAdministration(['Super Admin']));
  router.use(json({ limit: '100kb' }));
  router.get('/users', actions.list);
  router.get('/users/:id', actions.get);
  router.post('/users', actions.create);
  router.patch('/users/:id', actions.update);
  router.post('/users/:id/deactivate', actions.deactivate);
  router.post('/users/:id/reactivate', actions.reactivate);
  router.get('/dashboard/summary', authorizeAdministration(['Super Admin']), actions.summary);
  router.get('/audit-records', authorizeAdministration(['Super Admin', 'Admin']), actions.audit);
  router.use((_req, res) => { res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Not found', details: [] } }); });
  // Keep the richer error envelope local to these APIs, preserving the auth contract.
  const error: ErrorRequestHandler = (value, _req, res, next) => {
    if (res.headersSent) { next(value); return; }
    if (value instanceof AdministrationError) { res.status(value.status).json({ error: { code: value.code, message: value.message, details: value.details } }); return; }
    if (value instanceof HttpError) { res.status(value.status).json({ error: { code: value.status === 401 ? 'UNAUTHENTICATED' : 'REQUEST_FAILED', message: value.message, details: [] } }); return; }
    if (value?.code === 11000) { res.status(409).json({ error: { code: 'CONFLICT', message: 'An account with that email already exists', details: [] } }); return; }
    if (value?.type === 'entity.parse.failed' || value?.type === 'entity.too.large') { res.status(value.type === 'entity.too.large' ? 413 : 400).json({ error: { code: 'VALIDATION_ERROR', message: 'Invalid request body', details: [] } }); return; }
    res.status(500).json({ error: { code: 'INTERNAL_ERROR', message: 'Unable to complete the request', details: [] } });
  };
  router.use(error);
  return router;
}
