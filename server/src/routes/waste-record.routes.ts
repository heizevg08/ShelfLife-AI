import { Router, type ErrorRequestHandler } from 'express';
import type { AuthService } from '../services/auth';
import type { WasteRecordService } from '../services/waste-records';
import { authenticate } from '../middleware/auth.middleware';
import { AdministrationError, authorizeAdministration } from '../middleware/administration.middleware';
import { HttpError } from '../middleware/error.middleware';
import { wasteRecordControllers } from '../controllers/waste-record.controller';
import { mongoInputGuard, secureJson } from '../middleware/request-security.middleware';

export function wasteRecordRoutes(auth: AuthService, service: WasteRecordService) {
  const router = Router(), actions = wasteRecordControllers(service);
  router.use((_req, res, next) => { res.setHeader('Cache-Control', 'no-store'); next(); });
  router.use(authenticate(auth));
  router.use(mongoInputGuard);
  router.get('/summary', authorizeAdministration(['Super Admin', 'Manager', 'Inventory Staff']), actions.summary);
  router.get('/reason-breakdown', authorizeAdministration(['Super Admin', 'Manager', 'Inventory Staff']), actions.reasonBreakdown);
  router.get('/', authorizeAdministration(['Super Admin', 'Manager', 'Inventory Staff']), actions.list);
  router.get('/:id', authorizeAdministration(['Super Admin', 'Manager', 'Inventory Staff']), actions.detail);
  router.post('/bulk', authorizeAdministration(['Inventory Staff']), secureJson({ limit: '100kb' }), actions.createMany);
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
