import type { ingredientModel } from '../models/ingredient';
import type { inventoryBatchModel } from '../models/inventory-batch';
import type { OperationalForecastService } from './operational-forecast';
import { evaluateInventoryRisk, type InventoryRiskEvaluation } from './inventory-risk';

// Thin orchestration owns the trusted data path: forecast demand always
// comes from OperationalForecastService, never from the HTTP caller, so
// FEFO and expiry math cannot be steered by client-supplied predictions.
// Results are computed only; nothing here persists forecast or risk output.

type ForecastUnavailableReason =
  | 'NO_HISTORY'
  | 'MIXED_INGREDIENTS'
  | 'INVALID_DATE'
  | 'INVALID_QUANTITY'
  | 'INCONSISTENT_UNIT'
  | 'INCOMPLETE_DAILY_HISTORY'
  | 'INSUFFICIENT_HISTORY';

export type OperationalRiskResult =
  | { status: 'NOT_FOUND' }
  | { status: 'UNAVAILABLE'; reason: ForecastUnavailableReason }
  | {
      status: 'EVALUATED';
      ingredientId: string;
      unit: string;
      forecast: { status: 'FORECAST'; coveredDates: string[]; forecastDemand: number };
      inventory: Extract<InventoryRiskEvaluation, { status: 'EVALUATED' }> extends infer _E ? {
        consumableStock: number;
        expiredQuantity: number;
        forecastDemand: number;
        coveredDates: string[];
        projectedBalance: number;
        shortageQty: number;
        coverageRatio: { status: 'VALUE'; value: number } | { status: 'NO_DEMAND' };
        meanDailyForecast: number;
        daysOfSupply: { status: 'VALUE'; value: number } | { status: 'NO_DEMAND' };
        surplusQty: { status: 'VALUE'; value: number } | { status: 'MINIMUM_STOCK_NOT_CONFIGURED' };
      } : never;
      batches: Extract<InventoryRiskEvaluation, { status: 'EVALUATED' }>['batches'];
    };

export interface OperationalRiskService {
  assess(ingredientId: string, forecastDates: readonly string[]): Promise<OperationalRiskResult>;
}

type IngredientRow = { _id: { toString(): string }; unitOfMeasure: string; minimumStock?: number };
type BatchRow = { quantity: number; unit: string; expirationDate: Date };

export function createOperationalRiskService(
  forecast: OperationalForecastService,
  ingredients: ReturnType<typeof ingredientModel>,
  batches: ReturnType<typeof inventoryBatchModel>,
): OperationalRiskService {
  return {
    async assess(ingredientId, forecastDates) {
      const result = await forecast.forecast(ingredientId, forecastDates);
      if (result.status === 'NOT_FOUND') return { status: 'NOT_FOUND' };
      // UNAVAILABLE propagates truthfully; the pure calculator must not run
      // because risk cannot invent demand for an ineligible history.
      if (result.status === 'UNAVAILABLE') return { status: 'UNAVAILABLE', reason: result.reason };

      const ingredient = (await ingredients
        .findById(ingredientId)
        .select('_id unitOfMeasure minimumStock')
        .lean()
        .exec()) as IngredientRow | null;
      if (!ingredient) return { status: 'NOT_FOUND' };

      const rows = (await batches
        .find({ ingredientId })
        .select('quantity unit expirationDate')
        .lean()
        .exec()) as BatchRow[];

      const evaluation = evaluateInventoryRisk({
        batches: rows.map(row => ({ quantity: row.quantity, unit: row.unit, expirationDate: row.expirationDate })),
        predictions: result.predictions.map(prediction => ({
          date: prediction.date,
          predictedConsumption: prediction.predictedConsumption,
        })),
        canonicalUnit: ingredient.unitOfMeasure,
        ...(ingredient.minimumStock === undefined ? {} : { minimumStock: ingredient.minimumStock }),
      });

      if (evaluation.status === 'UNAVAILABLE') {
        // Evaluator only reports MISSING_FORECAST when predictions are empty,
        // which cannot happen on a FORECAST path; fail loudly if it does.
        throw new Error('Risk evaluation cannot proceed without forecast demand');
      }

      return {
        status: 'EVALUATED',
        ingredientId: result.ingredientId,
        unit: result.unit,
        forecast: {
          status: 'FORECAST',
          coveredDates: evaluation.coveredDates,
          forecastDemand: evaluation.forecastDemand,
        },
        inventory: {
          consumableStock: evaluation.consumableStock,
          expiredQuantity: evaluation.expiredQuantity,
          forecastDemand: evaluation.forecastDemand,
          coveredDates: evaluation.coveredDates,
          projectedBalance: evaluation.projectedBalance,
          shortageQty: evaluation.shortageQty,
          coverageRatio: evaluation.coverageRatio,
          meanDailyForecast: evaluation.meanDailyForecast,
          daysOfSupply: evaluation.daysOfSupply,
          surplusQty: evaluation.surplusQty,
        },
        batches: evaluation.batches,
      };
    },
  };
}

export type { ForecastUnavailableReason };
