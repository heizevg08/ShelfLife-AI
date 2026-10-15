import type { RequestHandler } from 'express';
import { HttpError } from './error.middleware';

export class AdministrationError extends HttpError {
  constructor(status: number, public readonly code: string, message: string, public readonly details: { field: string; message: string }[] = []) { super(status, message); }
}
export const forbidden = () => new AdministrationError(403, 'FORBIDDEN', 'This action is not permitted');
export function authorizeAdministration(roles: string[]): RequestHandler {
  return (_req, res, next) => {
    if (!roles.includes(res.locals.user?.role)) { next(forbidden()); return; }
    next();
  };
}
