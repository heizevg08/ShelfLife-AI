import express from 'express';
import cors from 'cors';
import { corsOptions } from './config/cors';
import { healthRoutes } from './routes/health.routes';
import { errorHandler, notFound } from './middleware/error.middleware';
import { authRoutes } from './routes/auth.routes';
import type { AuthService } from './services/auth';

export function createApp(origins: readonly string[], isReady: () => boolean, auth?: AuthService) {
  const app = express();
  app.disable('x-powered-by');
  app.use(cors(corsOptions(origins)));
  app.use(express.json({ limit: '100kb' }));
  app.use('/api/health', healthRoutes(isReady));
  if (auth) app.use('/api/auth', authRoutes(auth));
  app.use(notFound);
  app.use(errorHandler);
  return app;
}
