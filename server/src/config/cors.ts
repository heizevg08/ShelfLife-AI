import type { CorsOptions } from 'cors';
import { HttpError } from '../middleware/error.middleware';

export function corsOptions(origins: readonly string[]): CorsOptions {
  return {
    credentials: false,
    origin(origin, callback) {
      // Requests without Origin (including health probes) need no CORS grant.
      if (!origin) return callback(null, false);
      if (origins.includes(origin)) return callback(null, true);
      callback(new HttpError(403, 'Origin not allowed'));
    },
  };
}
