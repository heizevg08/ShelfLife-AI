import { Router, type ErrorRequestHandler } from 'express';
import type { AuthService } from '../services/auth';
import type { WasteRecordService } from '../services/waste-records';
import { authenticate } from '../middleware/auth.middleware';
import { AdministrationError, authorizeAdministration } from '../middleware/administration.middleware';
import { HttpError } from '../middleware/error.middleware';
import { wasteRecordControllers } from '../controllers/waste-record.controller';
import { mongoInputGuard, secureJson } from '../middleware/request-security.middleware';

/**
 * Register the waste-record routes on a new router.
 *
 * @param auth - the auth service used to guard every route.
 * @param service - the waste-record service behind the handlers.
 * @returns the configured router.
 */
export function wasteRecordRoutes(auth: AuthService, service: WasteRecordService) {
  const router = Router(), actions = wasteRecordControllers(service);
  router.use((_req, res, next) => { res.setHeader('Cache-Control', 'no-store'); next(); });
  router.use(authenticate(auth));
  router.use(mongoInputGuard);
  // Admin Reports reads this aggregate only. Record-level list/detail access and every
  // waste mutation remain restricted to Manager and Inventory Staff below.
  router.get('/summary', authorizeAdministration(['Admin', 'Manager', 'Inventory Staff']), actions.summary);
  router.get('/reason-breakdown', authorizeAdministration(['Manager', 'Inventory Staff']), actions.reasonBreakdown);
  router.get('/analytics', authorizeAdministration(['Manager']), actions.analytics);
  router.get('/', authorizeAdministration(['Manager', 'Inventory Staff']), actions.list);
  router.get('/:id', authorizeAdministration(['Manager', 'Inventory Staff']), actions.detail);
  // Manager bulk waste recording is an explicitly approved business rule (2026-10-11 RBAC
  // decision), matching the usage bulk grant. Scoped to this operation only: Manager does not
  // receive inventory batch bulk recording, and no other role is widened.
  router.post('/bulk', authorizeAdministration(['Inventory Staff', 'Manager']), secureJson({ limit: '100kb' }), actions.createMany);
  router.post('/', authorizeAdministration(['Manager', 'Inventory Staff']), secureJson({ limit: '100kb' }), actions.create);
  router.use((_req, res) => { res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Not found', details: [] } }); });
  const error: ErrorRequestHandler = (value, _req, res, next) => {
    if (res.headersSent) { next(value); return; }
    if (value instanceof AdministrationError) { res.status(value.status).json({ error: { code: value.code, message: value.message, details: value.details } }); return; }
    if (value instanceof HttpError) { res.status(value.status).json({ error: { code: value.status === 401 ? 'UNAUTHENTICATED' : 'REQUEST_FAILED', message: value.message, details: [] } }); return; }
    next(value);
  };
  router.use(error);
  return router;
}
