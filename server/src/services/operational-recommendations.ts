import type { OperationalRiskService } from './operational-risk';
import { deriveRecommendations, type AdvisoryItem } from './recommendations';

// Service composition only: reuses OperationalRiskService, never calls
// HTTP /risk, never reconstructs forecasting/risk logic, never spawns a
// worker, never accepts client-supplied predictions.

export type OperationalRecommendationResult =
  | { status: 'NOT_FOUND' }
  | { status: 'UNAVAILABLE'; reason: string }
  | {
      status: 'ADVISED';
      ingredientId: string;
      unit: string;
      recommendations: AdvisoryItem[];
      notes: AdvisoryItem[];
    };

export interface OperationalRecommendationService {
  assess(ingredientId: string, forecastDates: readonly string[]): Promise<OperationalRecommendationResult>;
}

export function createOperationalRecommendationService(
  risk: OperationalRiskService,
): OperationalRecommendationService {
  return {
    async assess(ingredientId, forecastDates) {
      const result = await risk.assess(ingredientId, forecastDates);
      if (result.status === 'NOT_FOUND') return { status: 'NOT_FOUND' };
      if (result.status === 'UNAVAILABLE') return { status: 'UNAVAILABLE', reason: result.reason };
      const { recommendations, notes } = deriveRecommendations(
        {
          status: 'EVALUATED',
          unit: result.unit,
          consumableStock: result.inventory.consumableStock,
          expiredQuantity: result.inventory.expiredQuantity,
          forecastDemand: result.inventory.forecastDemand,
          coveredDates: result.inventory.coveredDates,
          projectedBalance: result.inventory.projectedBalance,
          shortageQty: result.inventory.shortageQty,
          coverageRatio: result.inventory.coverageRatio,
          meanDailyForecast: result.inventory.meanDailyForecast,
          daysOfSupply: result.inventory.daysOfSupply,
          surplusQty: result.inventory.surplusQty,
          batches: result.batches,
        },
        result.unit,
      );
      return { status: 'ADVISED', ingredientId: result.ingredientId, unit: result.unit, recommendations, notes };
    },
  };
}
