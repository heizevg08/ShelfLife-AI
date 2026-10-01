import type { RequestHandler } from 'express';
import type { AuthService } from '../services/auth';
import { HttpError } from './error.middleware';

export function authenticate(auth: AuthService): RequestHandler {
  return async (req, res, next) => {
    try {
      const user = await auth.authenticate(req.headers.authorization);
      if (user.mustChangePassword && !['/me', '/password/change'].includes(req.path)) throw new HttpError(403, 'Change your temporary password before continuing');
      res.locals.user = user; next();
    }
    catch (error) { next(error); }
  };
}
