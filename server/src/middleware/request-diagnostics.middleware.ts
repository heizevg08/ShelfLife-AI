import { randomUUID } from 'node:crypto';
import type { ErrorRequestHandler, RequestHandler } from 'express';

// Never record raw URLs, headers, IPs, bodies, error messages or stacks: any of
// those can contain credentials. Correlate client evidence using a generated ID.
export const requestDiagnostics: RequestHandler = (req, res, next) => {
  const requestId = randomUUID();
  const scope = /^\/api\/(auth|health|users|dashboard|audit-records|account-requests|ingredients|inventory-batches|system-config|change-requests|ingredient-requests)(?:\/|$)/.exec(req.path)?.[1] ?? 'other';
  res.setHeader('X-Request-ID', requestId);
  res.once('finish', () => {
    if (res.statusCode < 400) return;
    console.warn(JSON.stringify({ event: 'request_rejected', timestamp: new Date().toISOString(), requestId,
      method: req.method, scope, status: res.statusCode, ...res.locals.failureDiagnostic }));
  });
  next();
};

export const requestErrorDiagnostics: ErrorRequestHandler = (error, _req, res, next) => {
  const knownNames = ['Error', 'HttpError', 'AdministrationError', 'ValidationError', 'CastError', 'StrictModeError', 'MongoServerError', 'MongoNetworkError', 'MongoServerSelectionError', 'SyntaxError'];
  const name = error?.constructor?.name;
  res.locals.failureDiagnostic = {
    errorType: knownNames.includes(name) ? name : 'UnknownError',
    ...(Number.isSafeInteger(error?.code) ? { databaseCode: error.code } : {}),
  };
  next(error);
};
