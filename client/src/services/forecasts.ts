import { apiClient } from './apiClient';

export type ForecastUnavailableReason =
  | 'NO_HISTORY'
  | 'MIXED_INGREDIENTS'
  | 'INVALID_DATE'
  | 'INVALID_QUANTITY'
  | 'INCONSISTENT_UNIT'
  | 'INCOMPLETE_DAILY_HISTORY'
  | 'INSUFFICIENT_HISTORY';

export type IngredientForecast = {
  status: 'FORECAST';
  ingredientId: string;
  unit: string;
  predictions: Array<{ date: string; predictedConsumption: number }>;
};

export type UnavailableIngredientForecast = {
  status: 'UNAVAILABLE';
  reason: ForecastUnavailableReason;
};

export type IngredientForecastResult = IngredientForecast | UnavailableIngredientForecast;

// Forecasting is deliberately ingredient-scoped. It avoids summing incompatible
// units and prevents the UI from issuing an uncontrolled request for every item.
export function forecastIngredient(id: string, forecastDates: readonly string[], signal?: AbortSignal) {
  return apiClient<IngredientForecastResult>(`/ingredients/${encodeURIComponent(id)}/forecast`, {
    method: 'POST',
    body: JSON.stringify({ forecastDates }),
    signal,
    successMessage: false,
    errorFeedback: false,
  });
}
