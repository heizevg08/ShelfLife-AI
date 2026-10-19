export const FORECAST_TECHNICAL_MINIMUM_DAYS = 14;

export interface ForecastingUsageRecord {
  ingredientId: string;
  quantityUsed: number;
  unit: string;
  dateUsed: Date | string;
}

export interface ForecastingDailyObservation {
  date: string;
  quantityUsed: number;
}

export type ForecastingHistoryResult =
  | {
      eligible: true;
      ingredientId: string;
      unit: string;
      observations: ForecastingDailyObservation[];
    }
  | {
      eligible: false;
      reason:
        | 'NO_HISTORY'
        | 'MIXED_INGREDIENTS'
        | 'INVALID_DATE'
        | 'INVALID_QUANTITY'
        | 'INCONSISTENT_UNIT'
        | 'INCOMPLETE_DAILY_HISTORY'
        | 'INSUFFICIENT_HISTORY';
    };

const DAY_MS = 86_400_000;

function utcDay(date: Date | string): { key: string; time: number } | null {
  const parsed = date instanceof Date ? new Date(date.getTime()) : new Date(date);

  if (!Number.isFinite(parsed.getTime())) return null;

  const time = Date.UTC(
    parsed.getUTCFullYear(),
    parsed.getUTCMonth(),
    parsed.getUTCDate(),
  );

  return {
    key: new Date(time).toISOString().slice(0, 10),
    time,
  };
}

export function buildForecastingHistory(
  records: readonly ForecastingUsageRecord[],
  canonicalUnit: string,
): ForecastingHistoryResult {
  if (records.length === 0) {
    return { eligible: false, reason: 'NO_HISTORY' };
  }

  const ingredientId = records[0]!.ingredientId;

  if (records.some(record => record.ingredientId !== ingredientId)) {
    return { eligible: false, reason: 'MIXED_INGREDIENTS' };
  }

  if (
    !canonicalUnit ||
    records.some(record => record.unit !== canonicalUnit)
  ) {
    return { eligible: false, reason: 'INCONSISTENT_UNIT' };
  }

  const daily = new Map<number, number>();

  for (const record of records) {
    if (!Number.isFinite(record.quantityUsed) || record.quantityUsed <= 0) {
      return { eligible: false, reason: 'INVALID_QUANTITY' };
    }

    const day = utcDay(record.dateUsed);
    if (!day) {
      return { eligible: false, reason: 'INVALID_DATE' };
    }

    daily.set(day.time, (daily.get(day.time) ?? 0) + record.quantityUsed);
  }

  const days = [...daily.entries()].sort(([left], [right]) => left - right);

  let latestSegmentStart = 0;

  for (let index = days.length - 1; index > 0; index -= 1) {
    if (days[index]![0] - days[index - 1]![0] !== DAY_MS) {
      latestSegmentStart = index;
      break;
    }
  }

  const latestConsecutiveDays = days.slice(latestSegmentStart);

  if (latestConsecutiveDays.length < FORECAST_TECHNICAL_MINIMUM_DAYS) {
    return { eligible: false, reason: 'INSUFFICIENT_HISTORY' };
  }

  return {
    eligible: true,
    ingredientId,
    unit: canonicalUnit,
    observations: latestConsecutiveDays.map(([time, quantityUsed]) => ({
      date: new Date(time).toISOString().slice(0, 10),
      quantityUsed,
    })),
  };
}
