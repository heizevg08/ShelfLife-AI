import type { RequestHandler } from 'express';
import type { OperationalForecastService } from '../services/operational-forecast';
import { objectId } from '../validators/administration';
import { forecastInput } from '../validators/forecast';

// Ingredient-scoped forecast action. The service result is returned
// truthfully: FORECAST and UNAVAILABLE pass through with HTTP 200, while a
// missing ingredient maps to the canonical 404 envelope. Worker/model
// failures throw and reach the route sanitizer as 500, never UNAVAILABLE.
export function forecastControllers(service: OperationalForecastService): Record<'forecast', RequestHandler> {
  return {
    forecast: async (req, res) => {
      const id = objectId(req.params.id);
      const input = forecastInput(req.body);
      const actorId = res.locals.user?.id;
      const result = await service.forecast(id, input.forecastDates, actorId);
      if (result.status === 'NOT_FOUND') {
        res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Ingredient not found', details: [] } });
        return;
      }
      res.json(result);
    },
  };
}
