import type { InventoryBatchService } from './services/inventory-batches';
import { inventoryBatchRoutes } from './routes/inventory-batch.routes';
import type { SystemConfigService } from './services/system-config';
import { systemConfigRoutes } from './routes/system-config.routes';
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
import { changeRequestRoutes } from './routes/change-request.routes';
import type { ChangeRequestService } from './services/change-requests';
import { ingredientRequestRoutes } from './routes/ingredient-request.routes';
import type { IngredientRequestService } from './services/ingredient-requests';
import type { AccountRequestService } from './services/account-requests';

export function createApp(origins: readonly string[], isReady: () => boolean, auth?: AuthService, extensions?: AuthExtensions, administration?: AdministrationService, ingredients?: IngredientService, systemConfig?: SystemConfigService, batches?: InventoryBatchService, changeRequests?: ChangeRequestService, ingredientRequests?: IngredientRequestService, accountRequests?: AccountRequestService) {
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
    if (/^\/api\/(users|dashboard|audit-records|account-requests|ingredients|system-config|inventory-batches|change-requests|ingredient-requests)(\/|$)/.test(req.path)) { next(); return; }
    json(req, res, next);
  });
  app.use('/api/health', healthRoutes(isReady));
  if (auth) app.use('/api/auth', authRoutes(auth, origins, extensions));
  if (auth && administration) {
    const routes = administrationRoutes(auth, administration, accountRequests);
    app.use('/api', (req, res, next) => {
      if (!/^\/(users|dashboard|audit-records|account-requests)(\/|$)/.test(req.path)) { next(); return; }
      routes(req, res, next);
    });
  }
  if (auth && ingredients) app.use('/api/ingredients', ingredientRoutes(auth, ingredients));
  if (auth && systemConfig) app.use('/api/system-config', systemConfigRoutes(auth, systemConfig));
  if (auth && batches) app.use('/api/inventory-batches', inventoryBatchRoutes(auth, batches));
  if (auth && changeRequests) app.use('/api/change-requests', changeRequestRoutes(auth, changeRequests));
  if (auth && ingredientRequests) app.use('/api/ingredient-requests', ingredientRequestRoutes(auth, ingredientRequests));
  app.use(notFound);
  app.use(requestErrorDiagnostics);
  app.use(errorHandler);
  return app;
}
