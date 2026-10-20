import type { RequestHandler } from 'express';
import type { OperationalRecommendationService } from '../services/operational-recommendations';
import { objectId } from '../validators/administration';
import { forecastInput } from '../validators/forecast';
import { sendError } from '../middleware/error-response';

// Ingredient-scoped recommendation action reuses the forecast request shape.
// NOT_FOUND maps to canonical 404; UNAVAILABLE and ADVISED pass through
// with HTTP 200. Runtime failures throw to the route sanitizer as 500.
export function recommendationControllers(
  service: OperationalRecommendationService,
): Record<'recommend', RequestHandler> {
  return {
    recommend: async (req, res) => {
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
