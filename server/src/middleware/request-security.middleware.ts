import express, { type RequestHandler } from 'express';
import mongoSanitize from 'express-mongo-sanitize';
import { HttpError } from './error.middleware';

// express-mongo-sanitize's default middleware assigns req.query, which is a
// read-only getter in Express 5. Use its recursive detector instead: reject
// prohibited keys without deleting fields or changing password/string values.
export const mongoInputGuard: RequestHandler = (req, _res, next) => {
  for (const value of [req.body, req.query, req.params]) {
    if (value && typeof value === 'object' && mongoSanitize.has(value)) {
      next(new HttpError(400, 'MongoDB operator and dotted keys are not permitted'));
      return;
    }
  }
  next();
};

// Keep each route's existing auth -> role guard -> bounded JSON parser order.
export function secureJson(options: Parameters<typeof express.json>[0] = { limit: '100kb' }): RequestHandler {
  const parse = express.json(options);
  return (req, res, next) => {
    parse(req, res, error => {
      if (error) { next(error); return; }
      mongoInputGuard(req, res, next);
    });
  };
}
