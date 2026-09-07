import express from 'express';
import cors from 'cors';
import { corsOptions } from './config/cors';
import { healthRoutes } from './routes/health.routes';
import { errorHandler, notFound } from './middleware/error.middleware';

export function createApp(origins: readonly string[], isReady: () => boolean) {
  const app = express();
  app.disable('x-powered-by');
  app.use(cors(corsOptions(origins)));
  app.use(express.json({ limit: '100kb' }));
  app.use('/api/health', healthRoutes(isReady));
  app.use(notFound);
  app.use(errorHandler);
  return app;
}
