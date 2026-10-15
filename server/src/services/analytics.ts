import { Types, type PipelineStage } from 'mongoose';
import type { AnalyticsQuery } from '../validators/analytics';
import { dateOnlyCalendarString } from '../utils/business-day';
import { WASTE_REASONS } from '../models/waste-record';

export type AnalyticsPeriod = { from: string | null; to: string | null; label: string };
export type AnalyticsRank = { ingredientId: string; name: string; count: number };
export type DailyRecordCount = { date: string; count: number };
export type AnalyticsCounts = {
  period: AnalyticsPeriod;
  total: number;
  dailyCounts: DailyRecordCount[];
  byReason: Record<typeof WASTE_REASONS[number], number>;
  topIngredients: AnalyticsRank[];
  unresolvedIngredientRecords: number;
};

type Group = { _id: unknown; count: number; name?: string | null };
type Facet = { total: { count: number }[]; daily: { _id: string; count: number }[]; reasons: Group[]; ingredients: Group[] };

// These are reporting counts. The private ML contract instead validates one
// ingredient and canonical unit, then sums quantityUsed by dateUsed; count
// series must never be passed off as the forecasting target.
export async function aggregateRecordCounts(
  run: (pipeline: PipelineStage[]) => Promise<unknown>,
  query: AnalyticsQuery,
  dateField: 'dateUsed' | 'dateWasted',
): Promise<AnalyticsCounts> {
  const match: Record<string, unknown> = {};
  const dateBounds: Record<string, Date> = {};
  if (query.from) dateBounds.$gte = query.from;
  if (query.to) dateBounds.$lt = query.to;
  if (Object.keys(dateBounds).length) match[dateField] = dateBounds;
  if (query.ingredientId) match.ingredientId = new Types.ObjectId(query.ingredientId);
  const stages: PipelineStage[] = [
    { $match: match },
    { $lookup: { from: 'ingredients', localField: 'ingredientId', foreignField: '_id', as: 'ingredient' } },
  ];
  // Category means the ingredient's current authoritative master category.
  // A missing ingredient cannot be assigned to a category and is excluded
  // only when a category was explicitly requested.
  if (query.category) stages.push({ $match: { 'ingredient.category': query.category } });
  stages.push({ $facet: {
    total: [{ $count: 'count' }],
    daily: [{ $group: { _id: { $dateToString: { format: '%Y-%m-%d', date: `$${dateField}`, timezone: 'UTC' } }, count: { $sum: 1 } } }, { $sort: { _id: 1 } }],
    reasons: [{ $group: { _id: '$reason', count: { $sum: 1 } } }],
    ingredients: [{ $group: { _id: '$ingredientId', count: { $sum: 1 }, name: { $first: { $arrayElemAt: ['$ingredient.name', 0] } } } }],
  } } as PipelineStage);
  const [result] = await run(stages) as Facet[];
  const groups = result?.ingredients ?? [];
  const ranked = groups.map(row => {
    const ingredientId = String(row._id);
    return { ingredientId, name: row.name?.trim() || 'Unavailable ingredient (' + ingredientId.slice(-6) + ')', count: row.count };
  }).sort((a, b) => b.count - a.count || a.name.localeCompare(b.name) || a.ingredientId.localeCompare(b.ingredientId));
  const byReason = Object.fromEntries(WASTE_REASONS.map(reason => [reason, 0])) as Record<typeof WASTE_REASONS[number], number>;
  for (const row of result?.reasons ?? []) if (typeof row._id === 'string' && row._id in byReason) byReason[row._id as typeof WASTE_REASONS[number]] = row.count;
  const from = query.from ? dateOnlyCalendarString(query.from) : null;
  const to = query.to ? dateOnlyCalendarString(new Date(query.to.getTime() - 1)) : null;
  const label = from && to ? from + ' to ' + to : from ? 'From ' + from : to ? 'Through ' + to : 'All dates';
  return {
    period: { from, to, label },
    total: result?.total[0]?.count ?? 0,
    dailyCounts: (result?.daily ?? []).map(row => ({ date: row._id, count: row.count })),
    byReason,
    topIngredients: ranked.slice(0, 5),
    unresolvedIngredientRecords: groups.filter(row => !row.name?.trim()).reduce((sum, row) => sum + row.count, 0),
  };
}
