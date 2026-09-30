import { Router, type ErrorRequestHandler } from 'express';
import type { AuthService } from '../services/auth';
import { authenticate } from '../middleware/auth.middleware';
import { AdministrationError } from '../middleware/administration.middleware';
import { HttpError } from '../middleware/error.middleware';
import { requestErrorDiagnostics } from '../middleware/request-diagnostics.middleware';

function duplicateConflictMessage(error: { keyPattern?: Record<string, unknown>; index?: unknown; message?: unknown }) {
  const index = `${error.index ?? ''} ${error.message ?? ''}`;
  if ((error.keyPattern?.ingredientId && error.keyPattern?.batchCode) || /ingredient.*batch.*code/i.test(index)) {
    return 'A batch with this code already exists for this ingredient, including archived batches';
  }
  if (error.keyPattern?.name || /ingredient.*name/i.test(index)) {
    return 'An ingredient with this name already exists, including archived ingredients';
  }
  return 'A duplicate record already exists, including archived records';
}

export function inventoryRouter(auth: AuthService) {
  const router = Router();
  router.use((_req, res, next) => { res.setHeader('Cache-Control', 'no-store'); next(); });
  router.use(authenticate(auth));
  return router;
}
export function finishInventoryRouter(router: ReturnType<typeof Router>) {
  router.use((_req, res) => { res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Not found', details: [] } }); });
  const errors: ErrorRequestHandler = (error, _req, res, next) => {
    if (res.headersSent) { next(error); return; }
    let status = 500, code = 'INTERNAL_ERROR', message = 'Unable to complete the request', details: { field: string; message: string }[] = [];
    if (error instanceof AdministrationError) { status = error.status; code = error.code; message = error.message; details = error.details; }
    else if (error instanceof HttpError) { status = error.status; code = status === 401 ? 'UNAUTHENTICATED' : 'REQUEST_FAILED'; message = error.message; }
    else if (error?.code === 11000) { status = 409; code = 'CONFLICT'; message = duplicateConflictMessage(error); }
    else if (error?.type === 'entity.parse.failed' || error?.type === 'entity.too.large') { status = error.type === 'entity.too.large' ? 413 : 400; code = 'VALIDATION_ERROR'; message = 'Invalid request body'; }
    res.status(status).json({ error: { code, message, details } });
  };
  router.use(requestErrorDiagnostics, errors);
  return router;
}
