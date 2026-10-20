import type { RequestHandler } from 'express';
import type { ForecastEvaluationService } from '../services/forecast-evaluation-service';
import { objectId } from '../validators/administration';
import { forecastTrendDays } from '../validators/forecast';
import { sendError } from '../middleware/error-response';

/**
 * Bind the forecast-evaluation handlers to a service instance.
 *
 * @param service - the forecast-evaluation service the handlers call.
 * @returns one request handler per evaluation view.
 */
export function forecastEvaluationControllers(
  service: ForecastEvaluationService,
): Record<'accuracy' | 'overallAccuracy' | 'trend' | 'table', RequestHandler> {
  return {
    overallAccuracy: async (_req, res) => {
      if (service.evaluateOverallAccuracy) {
        const result = await service.evaluateOverallAccuracy();
        res.json(result);
      } else {
        res.json({
          status: 'UNAVAILABLE',
          reason: 'INSUFFICIENT_EVALUATION_DATA',
          evaluatedDays: 0,
          minimumRequiredDays: 7,
        });
      }
    },

    accuracy: async (req, res) => {
      const id = objectId(req.params.id);
      const result = await service.evaluateAccuracy(id);
      if (result.status === 'NOT_FOUND') {
        sendError(res, 404, 'NOT_FOUND', 'Ingredient not found');
        return;
      }
      res.json(result);
    },

    trend: async (req, res) => {
      const id = objectId(req.params.id);
      const days = forecastTrendDays(req.query);
      const result = await service.trendSeries(id, days);
      if (result.status === 'NOT_FOUND') {
        sendError(res, 404, 'NOT_FOUND', 'Ingredient not found');
        return;
      }
      res.json(result);
    },

    table: async (req, res) => {
      const page = typeof req.query.page === 'string' ? parseInt(req.query.page, 10) : 1;
      const pageSize = typeof req.query.pageSize === 'string' ? parseInt(req.query.pageSize, 10) : 10;
      const search = typeof req.query.search === 'string' ? req.query.search : undefined;
      const category = typeof req.query.category === 'string' ? req.query.category : undefined;
      const from = typeof req.query.from === 'string' ? req.query.from : undefined;
      const to = typeof req.query.to === 'string' ? req.query.to : undefined;

      const result = await service.tableOverview({
        page: Number.isFinite(page) ? page : 1,
        pageSize: Number.isFinite(pageSize) ? pageSize : 10,
        search,
        category,
        from,
        to,
      });
      res.json(result);
    },
  };
}
