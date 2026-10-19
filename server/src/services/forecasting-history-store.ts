import type { ingredientModel } from '../models/ingredient';
import type { usageRecordModel } from '../models/usage-record';
import {
  buildForecastingHistory,
  type ForecastingHistoryResult,
  type ForecastingUsageRecord,
} from './forecasting-history';

type Id = { toString(): string };

type UsageHistoryRow = {
  ingredientId: Id;
  quantityUsed: number;
  unit: string;
  dateUsed: Date;
};

type IngredientUnitRow = {
  _id: Id;
  unitOfMeasure: string;
};

export type ForecastingHistoryLookup =
  | {
      found: false;
    }
  | {
      found: true;
      history: ForecastingHistoryResult;
    };

export interface ForecastingHistoryStore {
  forIngredient(ingredientId: string): Promise<ForecastingHistoryLookup>;
}

export function createForecastingHistoryStore(
  records: ReturnType<typeof usageRecordModel>,
  ingredients: ReturnType<typeof ingredientModel>,
): ForecastingHistoryStore {
  return {
    async forIngredient(ingredientId) {
      const ingredient = await ingredients
        .findById(ingredientId)
        .select('_id unitOfMeasure')
        .lean()
        .exec() as IngredientUnitRow | null;

      if (!ingredient) {
        return { found: false };
      }

      const rows = await records
        .find({ ingredientId })
        .select('ingredientId quantityUsed unit dateUsed -_id')
        .sort({ dateUsed: -1 })
        .lean()
        .exec() as UsageHistoryRow[];

      const historyRecords: ForecastingUsageRecord[] = rows.map(row => ({
        ingredientId: row.ingredientId.toString(),
        quantityUsed: row.quantityUsed,
        unit: row.unit,
        dateUsed: row.dateUsed,
      }));

      return {
        found: true,
        history: buildForecastingHistory(
          historyRecords,
          ingredient.unitOfMeasure,
        ),
      };
    },
  };
}
