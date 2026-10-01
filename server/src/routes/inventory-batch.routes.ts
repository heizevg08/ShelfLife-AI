import { Router, json, type ErrorRequestHandler } from 'express';
import type { AuthService } from '../services/auth';
import type { InventoryBatchService } from '../services/inventory-batches';
import { authenticate } from '../middleware/auth.middleware';
import { AdministrationError, authorizeAdministration } from '../middleware/administration.middleware';
import { HttpError } from '../middleware/error.middleware';
import { inventoryBatchControllers } from '../controllers/inventory-batch.controller';

export function inventoryBatchRoutes(auth: AuthService, service: InventoryBatchService) {
  const router = Router(), actions = inventoryBatchControllers(service);
  router.use((_req, res, next) => { res.setHeader('Cache-Control', 'no-store'); next(); });
  router.use(authenticate(auth));
  router.get('/summary', authorizeAdministration(['Super Admin', 'Admin', 'Manager', 'Inventory Staff']), actions.summary);
  router.get('/stock-in-summary', authorizeAdministration(['Manager', 'Inventory Staff']), actions.stockInSummary);
  router.get('/', authorizeAdministration(['Super Admin', 'Admin', 'Manager', 'Inventory Staff']), actions.list);
  router.get('/:id', authorizeAdministration(['Super Admin', 'Admin', 'Manager', 'Inventory Staff']), actions.detail);
  router.post('/', authorizeAdministration(['Manager', 'Inventory Staff']), json({ limit: '100kb' }), actions.create);
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
