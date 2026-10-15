import { invalid, objectId } from './administration';
import { INGREDIENT_CATEGORIES } from './ingredient';
import { calendarDate } from './date';

// Operational date-only values are stored at UTC midnight. The selected end
// date is inclusive in the UI and exclusive in database comparisons.
export type AnalyticsQuery = { from?: Date; to?: Date; ingredientId?: string; category?: typeof INGREDIENT_CATEGORIES[number] };

export function analyticsQuery(query: Record<string, unknown>): AnalyticsQuery {
  for (const key of Object.keys(query)) if (!['from', 'to', 'ingredientId', 'category'].includes(key)) invalid(key);
  const result: AnalyticsQuery = {};
  if (query.ingredientId !== undefined) result.ingredientId = objectId(query.ingredientId);
  if (query.category !== undefined) {
    if (typeof query.category !== 'string' || !INGREDIENT_CATEGORIES.includes(query.category as typeof INGREDIENT_CATEGORIES[number])) invalid('category');
    result.category = query.category as typeof INGREDIENT_CATEGORIES[number];
  }
  if (query.from !== undefined) result.from = calendarDate('from', query.from);
  if (query.to !== undefined) result.to = new Date(calendarDate('to', query.to).getTime() + 86_400_000);
  if (result.from && result.to && result.from >= result.to) invalid('to', 'End date must be on or after start date');
  return result;
}
