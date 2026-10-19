import type { ForecastInferenceWorker, ForecastPrediction } from './forecast-inference-worker';
import type { ForecastingHistoryResult } from './forecasting-history';
import type { ForecastingHistoryStore } from './forecasting-history-store';
import type { ForecastSnapshotStore } from './forecast-snapshot-store';

type ForecastUnavailableReason = Extract<
  ForecastingHistoryResult,
  { eligible: false }
>['reason'];

export type OperationalForecastResult =
  | {
      status: 'NOT_FOUND';
    }
  | {
      status: 'UNAVAILABLE';
      reason: ForecastUnavailableReason;
    }
  | {
      status: 'FORECAST';
      ingredientId: string;
      unit: string;
      predictions: ForecastPrediction[];
    };

export interface OperationalForecastService {
  forecast(
    ingredientId: string,
    forecastDates: readonly string[],
    actorId?: string,
  ): Promise<OperationalForecastResult>;
}

export function createOperationalForecastService(
  histories: ForecastingHistoryStore,
  worker: ForecastInferenceWorker,
  snapshots?: ForecastSnapshotStore,
): OperationalForecastService {
  return {
    async forecast(ingredientId, forecastDates, actorId) {
      const lookup = await histories.forIngredient(ingredientId);

      if (!lookup.found) {
        return { status: 'NOT_FOUND' };
      }

      if (!lookup.history.eligible) {
        return {
          status: 'UNAVAILABLE',
          reason: lookup.history.reason,
        };
      }

      const history = lookup.history.observations.map(observation => ({
        dt: observation.date,
        sale_amount: observation.quantityUsed,
      }));

      const predictions = await worker.infer({
        history,
        forecastDates: [...forecastDates],
      });

      if (snapshots && actorId) {
        await snapshots.saveSnapshots({
          ingredientId: lookup.history.ingredientId,
          unit: lookup.history.unit,
          createdBy: actorId,
          predictions,
        });
      }

      return {
        status: 'FORECAST',
        ingredientId: lookup.history.ingredientId,
        unit: lookup.history.unit,
        predictions,
      };
    },
  };
}
