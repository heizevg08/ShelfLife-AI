import type { RequestHandler } from 'express';
import type { AuthService } from '../services/auth';

export function authenticate(auth: AuthService): RequestHandler {
  return async (req, res, next) => {
    try { res.locals.user = await auth.authenticate(req.headers.authorization); next(); }
    catch (error) { next(error); }
  };
}
