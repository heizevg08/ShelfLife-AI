import type { RequestHandler } from 'express';
import type { OperationalRiskService } from '../services/operational-risk';
import { objectId } from '../validators/administration';
import { forecastInput } from '../validators/forecast';
import { sendError } from '../middleware/error-response';

// Ingredient-scoped risk action reuses the forecast request shape.
// NOT_FOUND maps to canonical 404; UNAVAILABLE and EVALUATED pass through
// with HTTP 200. Runtime failures throw to the route sanitizer as 500.
export function riskControllers(service: OperationalRiskService): Record<'risk', RequestHandler> {
  return {
    risk: async (req, res) => {
      const id = objectId(req.params.id);
      const input = forecastInput(req.body);
      const result = await service.assess(id, input.forecastDates);
      if (result.status === 'NOT_FOUND') {
        sendError(res, 404, 'NOT_FOUND', 'Ingredient not found');
        return;
      }
      res.json(result);
    },
  };
}
