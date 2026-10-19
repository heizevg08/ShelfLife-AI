import { invalid } from './administration';
import { calendarDate } from './date';

// API/runtime safety bound on the number of forecast dates accepted per
// request. This protects the recursive inference runtime from unbounded
// fan-out. It is not the finalized production forecasting horizon, which
// remains open.
export const FORECAST_MAX_DATES = 30;

export type ForecastRequestInput = { forecastDates: string[] };

export function forecastInput(body: unknown): ForecastRequestInput {
  if (!body || typeof body !== 'object' || Array.isArray(body)) invalid('body');
  const input = body as Record<string, unknown>;
  for (const key of Object.keys(input)) if (key !== 'forecastDates') invalid(key, 'Field is not permitted');
  if (!Array.isArray(input.forecastDates)) invalid('forecastDates', 'Provide forecast dates as an array');
  if (input.forecastDates.length === 0) invalid('forecastDates', 'Provide at least one forecast date');
  if (input.forecastDates.length > FORECAST_MAX_DATES) invalid('forecastDates', `Provide at most ${FORECAST_MAX_DATES} forecast dates`);
  const dates = input.forecastDates.map((value, index) => {
    calendarDate(`forecastDates.${index}`, value);
    return value as string;
  });
  if (new Set(dates).size !== dates.length) invalid('forecastDates', 'Remove duplicate forecast dates');
  return { forecastDates: dates };
}
