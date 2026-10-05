import express, { type RequestHandler } from 'express';
import mongoSanitize from 'express-mongo-sanitize';
import { HttpError } from './error.middleware';

// Express 5 exposes req.query through a getter. Detect prohibited keys and reject the request instead of mutating input.
export const mongoInputGuard: RequestHandler = (req, _res, next) => {
  for (const value of [req.body, req.query, req.params]) {
    if (value && typeof value === 'object' && mongoSanitize.has(value)) {
      next(new HttpError(400, 'MongoDB operator and dotted keys are not permitted'));
      return;
    }
  }
  next();
};

export function secureJson(options: Parameters<typeof express.json>[0] = { limit: '100kb' }): RequestHandler {
  const parse = express.json(options);
  return (req, res, next) => {
    parse(req, res, error => {
      if (error) { next(error); return; }
      mongoInputGuard(req, res, next);
    });
  };
}
