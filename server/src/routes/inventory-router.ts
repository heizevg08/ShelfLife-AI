import { Router, type ErrorRequestHandler } from 'express';
import type { AuthService } from '../services/auth';
import { authenticate } from '../middleware/auth.middleware';
import { AdministrationError } from '../middleware/administration.middleware';
import { HttpError } from '../middleware/error.middleware';

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
    else if (error?.code === 11000) { status = 409; code = 'CONFLICT'; message = 'This identity is already in use, including archived records'; }
    else if (error?.type === 'entity.parse.failed' || error?.type === 'entity.too.large') { status = error.type === 'entity.too.large' ? 413 : 400; code = 'VALIDATION_ERROR'; message = 'Invalid request body'; }
    res.status(status).json({ error: { code, message, details } });
  };
  router.use(errors);
  return router;
}
