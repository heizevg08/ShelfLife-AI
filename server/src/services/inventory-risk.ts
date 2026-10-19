// Phase 1 deterministic risk math lives apart from ML forecasting so a
// prediction-contract change cannot silently alter risk semantics.
// Phase 1 assumes no future receiving and no future waste adjustment
// inside the evaluation window; only current batch facts plus forecast
// consumption enter the calculation.

export interface InventoryRiskBatchInput {
  quantity: number;
  unit: string;
  expirationDate: Date | string;
}

export interface InventoryRiskPredictionInput {
  date: string;
  predictedConsumption: number;
}

export interface InventoryRiskInput {
  batches: readonly InventoryRiskBatchInput[];
  predictions: readonly InventoryRiskPredictionInput[];
  canonicalUnit: string;
  minimumStock?: number;
  referenceDate?: Date | string;
}

export type InventoryRiskUnavailableReason =
  | 'MISSING_FORECAST'
  | 'MINIMUM_STOCK_NOT_CONFIGURED'
  | 'INCOMPLETE_FORECAST_HORIZON';

export interface InventoryRiskBatchEvaluation {
  index: number;
  quantity: number;
  expirationDate: string;
  expired: boolean;
  expiryEvaluation:
    | { status: 'EVALUATED'; projectedLeftoverAtExpiry: number }
    | { status: 'EXPIRED' }
    | { status: 'INCOMPLETE_FORECAST_HORIZON' };
}

export type InventoryRiskEvaluation =
  | { status: 'UNAVAILABLE'; reason: Extract<InventoryRiskUnavailableReason, 'MISSING_FORECAST'> }
  | {
      status: 'EVALUATED';
      unit: string;
      consumableStock: number;
      expiredQuantity: number;
      forecastDemand: number;
      coveredDates: string[];
      projectedBalance: number;
      shortageQty: number;
      coverageRatio: { status: 'VALUE'; value: number } | { status: 'NO_DEMAND' };
      meanDailyForecast: number;
      daysOfSupply: { status: 'VALUE'; value: number } | { status: 'NO_DEMAND' };
      surplusQty:
        | { status: 'VALUE'; value: number }
        | { status: 'MINIMUM_STOCK_NOT_CONFIGURED' };
      batches: InventoryRiskBatchEvaluation[];
    };

const DAY_MS = 86_400_000;

function utcDayKey(value: Date | string): { key: string; time: number } {
  const parsed = value instanceof Date ? new Date(value.getTime()) : new Date(value);
  if (!Number.isFinite(parsed.getTime())) {
    throw new Error('Inventory risk requires a valid date');
  }
  const time = Date.UTC(parsed.getUTCFullYear(), parsed.getUTCMonth(), parsed.getUTCDate());
  return { key: new Date(time).toISOString().slice(0, 10), time };
}

function assertQuantity(value: number, field: string): void {
  if (!Number.isFinite(value) || value < 0) {
    throw new Error(`Inventory risk requires ${field} to be a finite number >= 0`);
  }
}

export function evaluateInventoryRisk(input: InventoryRiskInput): InventoryRiskEvaluation {
  if (!input.canonicalUnit || typeof input.canonicalUnit !== 'string') {
    throw new Error('Inventory risk requires a canonical unit');
  }

  // Unit mismatches fail loudly because silent g/kg-style conversion
  // would corrupt every downstream quantity comparison.
  input.batches.forEach((batch, index) => {
    assertQuantity(batch.quantity, `batches[${index}].quantity`);
    if (batch.unit !== input.canonicalUnit) {
      throw new Error(`Inventory risk unit mismatch at batches[${index}]: expected ${input.canonicalUnit}`);
    }
    utcDayKey(batch.expirationDate);
  });

  if (input.predictions.length === 0) {
    // A missing forecast is a data-readiness state, never zero demand.
    return { status: 'UNAVAILABLE', reason: 'MISSING_FORECAST' };
  }
  const dailyDemand = new Map<number, number>();
  for (let index = 0; index < input.predictions.length; index += 1) {
    const prediction = input.predictions[index]!;
    assertQuantity(prediction.predictedConsumption, `predictions[${index}].predictedConsumption`);
    const day = utcDayKey(prediction.date);
    dailyDemand.set(day.time, (dailyDemand.get(day.time) ?? 0) + prediction.predictedConsumption);
  }
  const days = [...dailyDemand.entries()].sort(([left], [right]) => left - right);
  const windowStart = days[0]![0];

  const reference = input.referenceDate === undefined
    ? { key: new Date(windowStart).toISOString().slice(0, 10), time: windowStart }
    : utcDayKey(input.referenceDate);

  const parsedBatches = input.batches.map((batch, index) => {
    const expiry = utcDayKey(batch.expirationDate);
    return { index, quantity: batch.quantity, expiry, expired: expiry.time < reference.time };
  });

  // Already-expired stock can never satisfy future consumption, so it is
  // excluded from S0 and reported separately instead of being dropped silently.
  const consumableStock = parsedBatches
    .filter(batch => !batch.expired)
    .reduce((total, batch) => total + batch.quantity, 0);
  const expiredQuantity = parsedBatches
    .filter(batch => batch.expired)
    .reduce((total, batch) => total + batch.quantity, 0);

  const forecastDemand = days.reduce((total, [, demand]) => total + demand, 0);
  const projectedBalance = consumableStock - forecastDemand;
  const shortageQty = Math.max(0, -projectedBalance);
  const meanDailyForecast = forecastDemand / days.length;

  // Zero-demand windows stay truthful: ratios report NO_DEMAND instead of
  // silently producing Infinity or an unbounded division result.
  const coverageRatio = forecastDemand > 0
    ? { status: 'VALUE' as const, value: consumableStock / forecastDemand }
    : { status: 'NO_DEMAND' as const };
  const daysOfSupply = meanDailyForecast > 0
    ? { status: 'VALUE' as const, value: consumableStock / meanDailyForecast }
    : { status: 'NO_DEMAND' as const };

  // A missing safety-stock threshold is a configuration gap, not a zero
  // buffer, so only the surplus metric reports not-configured.
  const surplusQty = input.minimumStock === undefined
    ? { status: 'MINIMUM_STOCK_NOT_CONFIGURED' as const }
    : (() => {
      assertQuantity(input.minimumStock, 'minimumStock');
      return { status: 'VALUE' as const, value: Math.max(0, projectedBalance - input.minimumStock) };
    })();

  // Strict FEFO mirrors Inventory Staff consumption: the earliest-expiring
  // eligible batch absorbs each day's forecast demand first.
  const fefoOrder = parsedBatches
    .filter(batch => !batch.expired)
    .sort((left, right) => left.expiry.time - right.expiry.time || left.index - right.index);
  const remaining = new Map<number, number>(fefoOrder.map(batch => [batch.index, batch.quantity]));
  for (const [dayTime, demand] of days) {
    let outstanding = demand;
    for (const batch of fefoOrder) {
      if (outstanding <= 0) break;
      // A batch stops satisfying demand once its expiry day has passed;
      // the expiry day itself remains eligible (same-day boundary).
      if (batch.expiry.time < dayTime) continue;
      const available = remaining.get(batch.index) ?? 0;
      const consumed = Math.min(available, outstanding);
      remaining.set(batch.index, available - consumed);
      outstanding -= consumed;
    }
  }

  const covered = new Set(days.map(([time]) => time));
  const batches: InventoryRiskBatchEvaluation[] = parsedBatches.map(batch => {
    if (batch.expired) {
      return {
        index: batch.index,
        quantity: batch.quantity,
        expirationDate: batch.expiry.key,
        expired: true,
        expiryEvaluation: { status: 'EXPIRED' as const },
      };
    }
    // Expiry evaluation needs every calendar day from the window start
    // through the expiry date; partial coverage stays unavailable rather
    // than assuming zero demand past the last forecast date.
    let complete = true;
    for (let time = windowStart; time <= batch.expiry.time; time += DAY_MS) {
      if (!covered.has(time)) {
        complete = false;
        break;
      }
    }
    return {
      index: batch.index,
      quantity: batch.quantity,
      expirationDate: batch.expiry.key,
      expired: false,
      expiryEvaluation: complete
        ? { status: 'EVALUATED' as const, projectedLeftoverAtExpiry: remaining.get(batch.index) ?? 0 }
        : { status: 'INCOMPLETE_FORECAST_HORIZON' as const },
    };
  });

  return {
    status: 'EVALUATED',
    unit: input.canonicalUnit,
    consumableStock,
    expiredQuantity,
    forecastDemand,
    coveredDates: days.map(([time]) => new Date(time).toISOString().slice(0, 10)),
    projectedBalance,
    shortageQty,
    coverageRatio,
    meanDailyForecast,
    daysOfSupply,
    surplusQty,
    batches,
  };
}
