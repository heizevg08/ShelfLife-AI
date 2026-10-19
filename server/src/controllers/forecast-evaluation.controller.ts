import type { RequestHandler } from 'express';
import type { ForecastEvaluationService } from '../services/forecast-evaluation-service';
import { objectId } from '../validators/administration';
import { forecastTrendDays } from '../validators/forecast';

export function forecastEvaluationControllers(
  service: ForecastEvaluationService,
): Record<'accuracy' | 'trend', RequestHandler> {
  return {
    accuracy: async (req, res) => {
      const id = objectId(req.params.id);
      const result = await service.evaluateAccuracy(id);
      if (result.status === 'NOT_FOUND') {
        res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Ingredient not found', details: [] } });
        return;
      }
      res.json(result);
    },

    trend: async (req, res) => {
      const id = objectId(req.params.id);
      const days = forecastTrendDays(req.query);
      const result = await service.trendSeries(id, days);
      if (result.status === 'NOT_FOUND') {
        res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Ingredient not found', details: [] } });
        return;
      }
      res.json(result);
    },
  };
}
