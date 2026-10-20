import type { Response } from 'express';

/**
 * Write the canonical error envelope every /api route group uses for an expected failure:
 * `{ error: { code, message, details } }`.
 *
 * One helper instead of hand-written objects, so a code or message can never drift between
 * two controllers that should answer identically.
 */
export function sendError(
  res: Response,
  status: number,
  code: string,
  message: string,
  details: { field: string; message: string }[] = []
) {
  res.status(status).json({ error: { code, message, details } });
}
