import { Router, type ErrorRequestHandler } from 'express';
import type { AuthService } from '../services/auth';
import type { IngredientService } from '../services/ingredients';
import { authenticate } from '../middleware/auth.middleware';
import { AdministrationError, authorizeAdministration } from '../middleware/administration.middleware';
import { HttpError } from '../middleware/error.middleware';
import { ingredientControllers } from '../controllers/ingredient.controller';
import { forecastControllers } from '../controllers/forecast.controller';
import { riskControllers } from '../controllers/risk.controller';
import { recommendationControllers } from '../controllers/recommendation.controller';
import type { OperationalForecastService } from '../services/operational-forecast';
import type { OperationalRiskService } from '../services/operational-risk';
import type { OperationalRecommendationService } from '../services/operational-recommendations';
import type { ForecastEvaluationService } from '../services/forecast-evaluation-service';
import { forecastEvaluationControllers } from '../controllers/forecast-evaluation.controller';
import { mongoInputGuard, secureJson } from '../middleware/request-security.middleware';

export function ingredientRoutes(
  auth: AuthService,
  service: IngredientService,
  forecast?: OperationalForecastService,
  risk?: OperationalRiskService,
  recommendations?: OperationalRecommendationService,
  evaluation?: ForecastEvaluationService,
) {
  const router = Router(), actions = ingredientControllers(service);
  const forecastActions = forecast ? forecastControllers(forecast) : undefined;
  const evaluationActions = evaluation ? forecastEvaluationControllers(evaluation) : undefined;
  const riskActions = risk ? riskControllers(risk) : undefined;
  const recommendationActions = recommendations ? recommendationControllers(recommendations) : undefined;
  router.use((_req, res, next) => { res.setHeader('Cache-Control', 'no-store'); next(); });
  router.use(authenticate(auth));
  router.use(mongoInputGuard);
  router.get('/categories', authorizeAdministration(['Super Admin', 'Admin', 'Manager', 'Inventory Staff']), actions.categories);
  router.get('/stock-in-options', authorizeAdministration(['Manager', 'Inventory Staff']), actions.stockInOptions);
  router.get('/summary', authorizeAdministration(['Super Admin', 'Admin', 'Manager']), actions.summary);
  router.get('/', authorizeAdministration(['Super Admin', 'Admin', 'Manager']), actions.list);
  router.post('/', authorizeAdministration(['Admin', 'Manager']), secureJson({ limit: '100kb' }), actions.create);
  router.put('/:id', authorizeAdministration(['Admin']), secureJson({ limit: '100kb' }), actions.update);
  router.delete('/:id', authorizeAdministration(['Admin']), actions.remove);
  if (forecastActions) router.post('/:id/forecast', authorizeAdministration(['Admin', 'Manager']), secureJson({ limit: '100kb' }), forecastActions.forecast);
  if (evaluationActions) {
    router.get('/forecast-accuracy', authorizeAdministration(['Admin', 'Manager']), evaluationActions.overallAccuracy);
    router.get('/forecast-table', authorizeAdministration(['Admin', 'Manager']), evaluationActions.table);
    router.get('/:id/forecast-accuracy', authorizeAdministration(['Admin', 'Manager']), evaluationActions.accuracy);
    router.get('/:id/forecast-vs-actual', authorizeAdministration(['Admin', 'Manager']), evaluationActions.trend);
  }
  if (riskActions) router.post('/:id/risk', authorizeAdministration(['Admin', 'Manager']), secureJson({ limit: '100kb' }), riskActions.risk);
  if (recommendationActions) router.post('/:id/recommendations', authorizeAdministration(['Admin', 'Manager']), secureJson({ limit: '100kb' }), recommendationActions.recommend);
  router.use((_req, res) => { res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Not found', details: [] } }); });
  const error: ErrorRequestHandler = (value, _req, res, next) => {
    if (res.headersSent) { next(value); return; }
    if (value instanceof AdministrationError) { res.status(value.status).json({ error: { code: value.code, message: value.message, details: value.details } }); return; }
    if (value instanceof HttpError) { res.status(value.status).json({ error: { code: value.status === 401 ? 'UNAUTHENTICATED' : 'REQUEST_FAILED', message: value.message, details: [] } }); return; }
    if (value?.code === 11000) { res.status(409).json({ error: { code: 'CONFLICT', message: 'An ingredient with that name already exists', details: [{ field: 'name', message: 'Use a unique ingredient name' }] } }); return; }
    if (value?.type === 'entity.parse.failed' || value?.type === 'entity.too.large') { res.status(value.type === 'entity.too.large' ? 413 : 400).json({ error: { code: 'VALIDATION_ERROR', message: 'Invalid request body', details: [] } }); return; }
    res.status(500).json({ error: { code: 'INTERNAL_ERROR', message: 'Unable to complete the request', details: [] } });
  };
  router.use(error);
  return router;
}
