import type { Mongoose } from 'mongoose';
import { forecastSnapshotModel, type ForecastSnapshotRecord } from '../models/forecast-snapshot';
import { businessDateString } from '../utils/business-day';

export interface ForecastSnapshotItemInput {
  date: string;
  predictedConsumption: number;
}

export interface ForecastSnapshotInput {
  ingredientId: string;
  unit: string;
  createdBy: string;
  modelVersion?: string;
  modelStage?: string;
  predictions: readonly ForecastSnapshotItemInput[];
}

export interface ForecastSnapshotQuery {
  ingredientId: string;
  targetDateFrom?: string;
  targetDateTo?: string;
  status?: 'ACTIVE' | 'SUPERSEDED';
}

export interface ForecastSnapshotStore {
  saveSnapshots(input: ForecastSnapshotInput, generatedAt?: Date): Promise<ForecastSnapshotRecord[]>;
  findSnapshots(query: ForecastSnapshotQuery): Promise<ForecastSnapshotRecord[]>;
  latestSnapshotForTargetDate(ingredientId: string, targetDate: string): Promise<ForecastSnapshotRecord | null>;
}

function calculateHorizonDays(generatedDate: string, targetDate: string, fallbackStep: number): number {
  const generatedTime = new Date(`${generatedDate}T00:00:00.000Z`).getTime();
  const targetTime = new Date(`${targetDate}T00:00:00.000Z`).getTime();
  const diffDays = Math.round((targetTime - generatedTime) / 86_400_000);
  return Math.min(30, Math.max(1, diffDays > 0 ? diffDays : fallbackStep + 1));
}

export function createForecastSnapshotStore(
  snapshots: ReturnType<typeof forecastSnapshotModel>,
): ForecastSnapshotStore {
  return {
    async saveSnapshots(input, generatedAt = new Date()) {
      if (input.predictions.length === 0) return [];

      const generatedDate = businessDateString(generatedAt);
      const targetDates = input.predictions.map(prediction => prediction.date);

      // Rule: When newer predictions are generated for upcoming target dates, earlier
      // snapshots for those same target dates are marked SUPERSEDED so that evaluation
      // cleanly selects the latest active prediction while preserving audit history.
      await snapshots.updateMany(
        {
          ingredientId: input.ingredientId,
          targetDate: { $in: targetDates },
          generatedDate: { $lt: generatedDate },
          status: 'ACTIVE',
        },
        { $set: { status: 'SUPERSEDED' } },
      ).exec();

      const savedRecords: ForecastSnapshotRecord[] = [];

      for (let index = 0; index < input.predictions.length; index += 1) {
        const item = input.predictions[index]!;
        const horizonDays = calculateHorizonDays(generatedDate, item.date, index);

        // Repeated forecast requests on the same business day update the existing record
        // idempotently rather than generating duplicate active entries.
        const record = await snapshots.findOneAndUpdate(
          {
            ingredientId: input.ingredientId,
            generatedDate,
            targetDate: item.date,
          },
          {
            $set: {
              generatedAt,
              horizonDays,
              stepIndex: index,
              predictedQuantity: Math.max(0, item.predictedConsumption),
              unit: input.unit,
              modelVersion: input.modelVersion ?? 'v1.0-frozen-rf',
              modelStage: input.modelStage ?? 'inference-frozen',
              createdBy: input.createdBy,
              status: 'ACTIVE',
            },
          },
          { upsert: true, new: true, setDefaultsOnInsert: true },
        ).lean().exec() as ForecastSnapshotRecord;

        savedRecords.push(record);
      }

      return savedRecords;
    },

    async findSnapshots(query) {
      const filter: Record<string, unknown> = {
        ingredientId: query.ingredientId,
      };

      if (query.status) {
        filter.status = query.status;
      }

      if (query.targetDateFrom || query.targetDateTo) {
        const dateFilter: Record<string, string> = {};
        if (query.targetDateFrom) dateFilter.$gte = query.targetDateFrom;
        if (query.targetDateTo) dateFilter.$lte = query.targetDateTo;
        filter.targetDate = dateFilter;
      }

      return snapshots
        .find(filter)
        .sort({ targetDate: 1, generatedDate: -1 })
        .lean()
        .exec() as Promise<ForecastSnapshotRecord[]>;
    },

    async latestSnapshotForTargetDate(ingredientId, targetDate) {
      return snapshots
        .findOne({
          ingredientId,
          targetDate,
          status: 'ACTIVE',
        })
        .sort({ generatedDate: -1 })
        .lean()
        .exec() as Promise<ForecastSnapshotRecord | null>;
    },
  };
}
