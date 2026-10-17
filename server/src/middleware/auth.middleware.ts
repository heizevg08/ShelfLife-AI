import type { RequestHandler } from 'express';
import type { AuthService } from '../services/auth';
import { HttpError } from './error.middleware';

export function authenticate(auth: AuthService): RequestHandler {
  return async (req, res, next) => {
    try {
      const user = await auth.authenticate(req.headers.authorization);
      if (user.mustChangePassword && !(req.method === 'GET' && req.path === '/me') && !(req.method === 'POST' && req.path === '/password/change')) {
        throw new HttpError(403, 'Change your temporary password before continuing');
      }
      res.locals.user = user; next();
    }
    catch (error) { next(error); }
  };
}
