import type { ErrorRequestHandler, RequestHandler } from 'express';

export class HttpError extends Error {
  constructor(public readonly status: number, message: string) { super(message); }
}

export const notFound: RequestHandler = (_req, res) => {
  res.status(404).json({ error: { message: 'Not found' } });
};

export const errorHandler: ErrorRequestHandler = (error: unknown, _req, res, next) => {
  if (res.headersSent) { next(error); return; }
  let status = 500;
  let message = 'Internal server error';
  if (error instanceof HttpError) {
    status = error.status;
    message = error.message;
  } else if (error && typeof error === 'object' && 'type' in error) {
    if (error.type === 'entity.parse.failed') { status = 400; message = 'Invalid JSON'; }
    if (error.type === 'entity.too.large') { status = 413; message = 'Request body too large'; }
    if (error.type === 'encoding.unsupported' || error.type === 'charset.unsupported') { status = 415; message = 'Unsupported encoding'; }
  }
  res.status(status).json({ error: { message } });
};
