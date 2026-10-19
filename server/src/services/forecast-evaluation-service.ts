import type { ingredientModel } from '../models/ingredient';
import type { usageRecordModel } from '../models/usage-record';
import type { ForecastSnapshotStore } from './forecast-snapshot-store';
import {
  businessDateString,
  businessDayBounds,
  recentBusinessCalendarBounds,
  previousBusinessDayBounds,
} from '../utils/business-day';

export const EVALUATION_MINIMUM_REQUIRED_DAYS = 7;

export interface ForecastVsActualPoint {
  date: string;
  forecast: number | null;
  actual: number | null;
}

export interface ForecastAccuracyMetrics {
  evaluatedDays: number;
  minimumRequiredDays: number;
  mae: number;
  rmse: number;
  wape: number | null;
  accuracyScore: number | null;
}

export type ForecastAccuracyResult =
  | { status: 'NOT_FOUND' }
  | {
      status: 'UNAVAILABLE';
      reason: 'INSUFFICIENT_EVALUATION_DATA' | 'NO_FORECASTS' | 'NO_USAGE';
      evaluatedDays: number;
      minimumRequiredDays: number;
      ingredientId: string;
      unit?: string;
    }
  | {
      status: 'AVAILABLE';
      ingredientId: string;
      unit: string;
      metrics: ForecastAccuracyMetrics;
    };

export interface ForecastVsActualTrendResult {
  status: 'FOUND' | 'NOT_FOUND';
  ingredientId?: string;
  unit?: string;
  points: ForecastVsActualPoint[];
  meta?: {
    ingredient: string;
    unit: string;
    asOf: string;
    horizonDays: number;
  };
}

export interface ForecastEvaluationService {
  evaluateAccuracy(ingredientId: string, referenceDate?: Date): Promise<ForecastAccuracyResult>;
  trendSeries(ingredientId: string, days?: number, referenceDate?: Date): Promise<ForecastVsActualTrendResult>;
}

function roundNumber(value: number, decimals: number): number {
  const factor = Math.pow(10, decimals);
  return Math.round(value * factor) / factor;
}

export function createForecastEvaluationService(
  ingredients: ReturnType<typeof ingredientModel>,
  usageRecords: ReturnType<typeof usageRecordModel>,
  snapshotStore: ForecastSnapshotStore,
): ForecastEvaluationService {
  return {
    async evaluateAccuracy(ingredientId, referenceDate = new Date()) {
      const ingredient = await ingredients
        .findById(ingredientId)
        .select('_id name unitOfMeasure')
        .lean()
        .exec() as { _id: { toString(): string }; name: string; unitOfMeasure: string } | null;

      if (!ingredient) {
        return { status: 'NOT_FOUND' };
      }

      // Rule: Evaluation evaluates only completed calendar days (up to yesterday).
      // Evaluating today's in-progress consumption against full-day demand produces artificial under-consumption errors.
      const yesterdayBounds = previousBusinessDayBounds(referenceDate);
      const yesterdayDateStr = businessDateString(yesterdayBounds.start);

      // Query active historical snapshots up to yesterday
      const snapshots = await snapshotStore.findSnapshots({
        ingredientId,
        status: 'ACTIVE',
        targetDateTo: yesterdayDateStr,
      });

      if (snapshots.length === 0) {
        return {
          status: 'UNAVAILABLE',
          reason: 'NO_FORECASTS',
          evaluatedDays: 0,
          minimumRequiredDays: EVALUATION_MINIMUM_REQUIRED_DAYS,
          ingredientId,
          unit: ingredient.unitOfMeasure,
        };
      }

      // Read usage records up to the end of yesterday
      const usageRows = await usageRecords
        .find({
          ingredientId,
          dateUsed: { $lt: yesterdayBounds.end },
        })
        .select('quantityUsed unit dateUsed')
        .lean()
        .exec() as { quantityUsed: number; unit: string; dateUsed: Date }[];

      if (usageRows.length === 0) {
        return {
          status: 'UNAVAILABLE',
          reason: 'NO_USAGE',
          evaluatedDays: 0,
          minimumRequiredDays: EVALUATION_MINIMUM_REQUIRED_DAYS,
          ingredientId,
          unit: ingredient.unitOfMeasure,
        };
      }

      // Aggregate actual consumption by Philippine calendar day
      const actualByDate = new Map<string, number>();
      for (const row of usageRows) {
        const dStr = businessDateString(row.dateUsed);
        actualByDate.set(dStr, (actualByDate.get(dStr) ?? 0) + row.quantityUsed);
      }

      // Match snapshots with actual consumption
      const matchedPairs: { date: string; predicted: number; actual: number }[] = [];

      for (const snapshot of snapshots) {
        if (actualByDate.has(snapshot.targetDate)) {
          matchedPairs.push({
            date: snapshot.targetDate,
            predicted: snapshot.predictedQuantity,
            actual: actualByDate.get(snapshot.targetDate)!,
          });
        }
      }

      const k = matchedPairs.length;
      if (k < EVALUATION_MINIMUM_REQUIRED_DAYS) {
        return {
          status: 'UNAVAILABLE',
          reason: 'INSUFFICIENT_EVALUATION_DATA',
          evaluatedDays: k,
          minimumRequiredDays: EVALUATION_MINIMUM_REQUIRED_DAYS,
          ingredientId,
          unit: ingredient.unitOfMeasure,
        };
      }

      let sumAbsError = 0;
      let sumSqError = 0;
      let sumActual = 0;

      for (const pair of matchedPairs) {
        const absDiff = Math.abs(pair.actual - pair.predicted);
        sumAbsError += absDiff;
        sumSqError += Math.pow(absDiff, 2);
        sumActual += pair.actual;
      }

      const mae = roundNumber(sumAbsError / k, 2);
      const rmse = roundNumber(Math.sqrt(sumSqError / k), 2);
      const wape = sumActual > 0 ? roundNumber(sumAbsError / sumActual, 4) : null;
      const accuracyScore = wape !== null ? Math.max(0, Math.min(100, roundNumber((1 - wape) * 100, 1))) : null;

      return {
        status: 'AVAILABLE',
        ingredientId,
        unit: ingredient.unitOfMeasure,
        metrics: {
          evaluatedDays: k,
          minimumRequiredDays: EVALUATION_MINIMUM_REQUIRED_DAYS,
          mae,
          rmse,
          wape,
          accuracyScore,
        },
      };
    },

    async trendSeries(ingredientId, days = 30, referenceDate = new Date()) {
      const ingredient = await ingredients
        .findById(ingredientId)
        .select('_id name unitOfMeasure')
        .lean()
        .exec() as { _id: { toString(): string }; name: string; unitOfMeasure: string } | null;

      if (!ingredient) {
        return { status: 'NOT_FOUND', points: [] };
      }

      const bounds = recentBusinessCalendarBounds(referenceDate, days);
      const startDateStr = businessDateString(bounds.start);
      const endDateStr = businessDateString(referenceDate);

      const [snapshots, usageRows] = await Promise.all([
        snapshotStore.findSnapshots({
          ingredientId,
          status: 'ACTIVE',
          targetDateFrom: startDateStr,
          targetDateTo: endDateStr,
        }),
        usageRecords
          .find({
            ingredientId,
            dateUsed: { $gte: bounds.start, $lt: bounds.end },
          })
          .select('quantityUsed unit dateUsed')
          .lean()
          .exec() as Promise<{ quantityUsed: number; unit: string; dateUsed: Date }[]>,
      ]);

      const forecastByDate = new Map<string, number>();
      for (const s of snapshots) {
        forecastByDate.set(s.targetDate, s.predictedQuantity);
      }

      const actualByDate = new Map<string, number>();
      for (const u of usageRows) {
        const dStr = businessDateString(u.dateUsed);
        actualByDate.set(dStr, (actualByDate.get(dStr) ?? 0) + u.quantityUsed);
      }

      // Generate continuous daily calendar range
      const points: ForecastVsActualPoint[] = [];
      const cursor = new Date(bounds.start.getTime());

      while (cursor < bounds.end) {
        const dStr = businessDateString(cursor);
        points.push({
          date: dStr,
          forecast: forecastByDate.has(dStr) ? forecastByDate.get(dStr)! : null,
          actual: actualByDate.has(dStr) ? actualByDate.get(dStr)! : null,
        });
        cursor.setUTCDate(cursor.getUTCDate() + 1);
      }

      return {
        status: 'FOUND',
        ingredientId,
        unit: ingredient.unitOfMeasure,
        points,
        meta: {
          ingredient: ingredient.name,
          unit: ingredient.unitOfMeasure,
          asOf: endDateStr,
          horizonDays: days,
        },
      };
    },
  };
}
