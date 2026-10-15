import { randomUUID } from 'node:crypto';
import type { ErrorRequestHandler, RequestHandler } from 'express';

const knownErrorTypes = new Set(['Error', 'HttpError', 'AdministrationError', 'ValidationError', 'CastError', 'StrictModeError', 'MongoServerError', 'MongoNetworkError', 'MongoServerSelectionError', 'SyntaxError']);

// Logs contain only allowlisted correlation metadata—never URLs, headers, IPs, bodies, credentials, tokens, or raw errors.
export const requestDiagnostics: RequestHandler = (req, res, next) => {
  const requestId = randomUUID();
  const scope = /^\/api\/(auth|health|users|dashboard|audit-records|ingredients|inventory-batches|usage-records|waste-records|change-requests)(?:\/|$)/.exec(req.path)?.[1] ?? 'other';
  res.setHeader('X-Request-ID', requestId);
  res.once('finish', () => {
    if (res.statusCode < 400) return;
    console.warn(JSON.stringify({ event: 'request_rejected', timestamp: new Date().toISOString(), requestId,
      method: req.method, scope, status: res.statusCode, ...res.locals.failureDiagnostic }));
  });
  next();
};

export const requestErrorDiagnostics: ErrorRequestHandler = (error, _req, res, next) => {
  const name = error?.constructor?.name;
  res.locals.failureDiagnostic = {
    errorType: knownErrorTypes.has(name) ? name : 'UnknownError',
    ...(Number.isSafeInteger(error?.code) ? { databaseCode: error.code } : {}),
  };
  next(error);
};
