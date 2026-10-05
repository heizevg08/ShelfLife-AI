import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { secureJson } from './middleware/request-security.middleware';
import { requestDiagnostics, requestErrorDiagnostics } from './middleware/request-diagnostics.middleware';
import { corsOptions } from './config/cors';
import { healthRoutes } from './routes/health.routes';
import { errorHandler, notFound } from './middleware/error.middleware';
import { authRoutes, type AuthExtensions } from './routes/auth.routes';
import type { AuthService } from './services/auth';
import { administrationRoutes } from './routes/administration.routes';
import type { AdministrationService } from './services/administration';
import { ingredientRoutes } from './routes/ingredient.routes';
import type { IngredientService } from './services/ingredients';
import { inventoryBatchRoutes } from './routes/inventory-batch.routes';
import type { InventoryBatchService } from './services/inventory-batches';
import { usageRecordRoutes } from './routes/usage-record.routes';
import type { UsageRecordService } from './services/usage-records';
import { wasteRecordRoutes } from './routes/waste-record.routes';
import type { WasteRecordService } from './services/waste-records';
import { changeRequestRoutes } from './routes/change-request.routes';

export function createApp(origins: readonly string[], isReady: () => boolean, auth?: AuthService, extensions?: AuthExtensions, administration?: AdministrationService, ingredients?: IngredientService, inventoryBatches?: InventoryBatchService, usageRecords?: UsageRecordService, wasteRecords?: WasteRecordService, changeRequests?: any) {
  const app = express();
  app.disable('x-powered-by');
  app.use(requestDiagnostics);
  app.use(helmet({
    strictTransportSecurity: { maxAge: 31536000, includeSubDomains: true },
    xFrameOptions: { action: 'deny' },
    contentSecurityPolicy: {
      useDefaults: false,
      directives: { defaultSrc: ["'none'"], baseUri: ["'none'"], frameAncestors: ["'none'"], formAction: ["'none'"] },
    },
  }));
  app.use(cors(corsOptions(origins)));
  const json = secureJson({ limit: '100kb' });
  app.use((req, res, next) => {
    // New administration APIs parse only after their authentication/authorization gates.
    if ((administration || ingredients || inventoryBatches || usageRecords || wasteRecords || changeRequests) && /^\/api\/(users|dashboard|audit-records|ingredients|inventory-batches|usage-records|waste-records|change-requests)(\/|$)/.test(req.path)) { next(); return; }
    json(req, res, next);
  });
  app.use('/api/health', healthRoutes(isReady));
  if (auth) app.use('/api/auth', authRoutes(auth, origins, extensions));
  if (auth && administration) {
    const routes = administrationRoutes(auth, administration);
    app.use('/api', (req, res, next) => {
      if (!/^\/(users|dashboard|audit-records)(\/|$)/.test(req.path)) { next(); return; }
      routes(req, res, next);
    });
  }
  if (auth && ingredients) app.use('/api/ingredients', ingredientRoutes(auth, ingredients));
  if (auth && inventoryBatches) app.use('/api/inventory-batches', inventoryBatchRoutes(auth, inventoryBatches));
  if (auth && usageRecords) app.use('/api/usage-records', usageRecordRoutes(auth, usageRecords));
  if (auth && wasteRecords) app.use('/api/waste-records', wasteRecordRoutes(auth, wasteRecords));
  if (auth && changeRequests) app.use('/api/change-requests', changeRequestRoutes(auth, changeRequests));
  app.use(notFound);
  app.use(requestErrorDiagnostics);
  app.use(errorHandler);
  return app;
}
