// Deterministic advisory mapping over an EVALUATED risk result.
// Pure: no DB, no Python, no HTTP, no input mutation.
// No confidence scores, no LOW/MEDIUM/HIGH labels, no auto-actions.

import type { InventoryRiskEvaluation } from './inventory-risk';

export type RecommendationCode =
  | 'SHORTAGE'
  | 'EXPIRY_EXPOSURE'
  | 'SURPLUS'
  | 'EXPIRED_STOCK'
  | 'INCOMPLETE_HORIZON'
  | 'NO_ACTION';

export interface AdvisoryItem {
  code: RecommendationCode;
  level: 'ingredient' | 'batch' | 'note';
  message: string;
  quantity?: number;
  unit?: string;
  batchIndex?: number;
  expirationDate?: string;
}

export interface RecommendationResult {
  recommendations: AdvisoryItem[];
  notes: AdvisoryItem[];
}

type Evaluated = Extract<InventoryRiskEvaluation, { status: 'EVALUATED' }>;

export function deriveRecommendations(evaluation: Evaluated, unit: string): RecommendationResult {
  const recommendations: AdvisoryItem[] = [];
  const notes: AdvisoryItem[] = [];
  // Snapshot inputs so callers can verify no mutation occurred.
  const snapshot = JSON.stringify(evaluation);

  const hasExpiryExposure = evaluation.batches.some(
    (batch) => batch.expiryEvaluation.status === 'EVALUATED' && batch.expiryEvaluation.projectedLeftoverAtExpiry > 0,
  );
  const hasIncomplete = evaluation.batches.some(
    (batch) => batch.expiryEvaluation.status === 'INCOMPLETE_FORECAST_HORIZON',
  );

  if (evaluation.expiredQuantity > 0) {
    recommendations.push({
      code: 'EXPIRED_STOCK',
      level: 'ingredient',
      message: `Measured expired stock of ${evaluation.expiredQuantity} ${unit} found. Isolate/remove per establishment procedure. This is measured inventory fact, not an ML prediction.`,
      quantity: evaluation.expiredQuantity,
      unit,
    });
  }

  const shortageFired = evaluation.shortageQty > 0;
  if (shortageFired) {
    recommendations.push({
      code: 'SHORTAGE',
      level: 'ingredient',
      message: `Projected shortage of ${evaluation.shortageQty} ${unit} over the evaluated forecast window. Review restocking.`,
      quantity: evaluation.shortageQty,
      unit,
    });
  }

  // Earliest-expiring affected batch first (FEFO order preserved by input).
  const affected = evaluation.batches
    .filter(
      (batch) =>
        batch.expiryEvaluation.status === 'EVALUATED' && batch.expiryEvaluation.projectedLeftoverAtExpiry > 0,
    )
    .sort((a, b) => (a.expirationDate < b.expirationDate ? -1 : a.expirationDate > b.expirationDate ? 1 : 0));
  for (const batch of affected) {
    const leftover =
      batch.expiryEvaluation.status === 'EVALUATED' ? batch.expiryEvaluation.projectedLeftoverAtExpiry : 0;
    recommendations.push({
      code: 'EXPIRY_EXPOSURE',
      level: 'batch',
      message: `Prioritize use of batch expiring ${batch.expirationDate}; ${leftover} ${unit} projected leftover at expiry.`,
      quantity: leftover,
      unit,
      batchIndex: batch.index,
      expirationDate: batch.expirationDate,
    });
  }

  // SHORTAGE and SURPLUS are mutually exclusive by construction
  // (surplus derives from a non-negative projected balance minus stock).
  // If both somehow emerge, fail loudly via invariant rather than both.
  const surplus = evaluation.surplusQty;
  if (surplus.status === 'VALUE' && surplus.value > 0) {
    if (shortageFired) {
      throw new Error('Recommendation invariant violated: SHORTAGE and SURPLUS both fired');
    }
    recommendations.push({
      code: 'SURPLUS',
      level: 'ingredient',
      message: `Projected surplus of ${surplus.value} ${unit} above minimum stock. Review or delay additional stock-in.`,
      quantity: surplus.value,
      unit,
    });
  } else if (surplus.status === 'MINIMUM_STOCK_NOT_CONFIGURED') {
    notes.push({
      code: 'SURPLUS',
      level: 'note',
      message: 'minimumStock is not configured; surplus could not be evaluated.',
    });
  }

  if (hasIncomplete) {
    notes.push({
      code: 'INCOMPLETE_HORIZON',
      level: 'note',
      message:
        'Expiry exposure cannot yet be fully evaluated for at least one batch because forecast coverage does not reach its expiration date.',
    });
  }

  const actionable = recommendations.length > 0 || hasIncomplete;
  const surplusMissing = surplus.status === 'MINIMUM_STOCK_NOT_CONFIGURED';
  if (!actionable && !surplusMissing && surplus.status === 'VALUE' && surplus.value === 0 && !hasExpiryExposure) {
    recommendations.push({
      code: 'NO_ACTION',
      level: 'note',
      message: 'No immediate action indicated by the current evaluated data.',
    });
  }

  if (JSON.stringify(evaluation) !== snapshot) {
    throw new Error('deriveRecommendations must not mutate its input');
  }

  return { recommendations, notes };
}
