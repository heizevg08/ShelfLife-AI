import { apiClient } from './apiClient';
import type { Page } from './administration';

export const INGREDIENT_CATEGORIES = ['Dairy', 'Produce', 'Bakery', 'Pantry', 'Meat', 'Seafood', 'Frozen', 'Beverages', 'Other'] as const;

export interface Ingredient {
  id: string;
  name: string;
  brand: string;
  description: string;
  category: string;
  unitOfMeasure: string;
  minimumStock?: number;
  standardUnitCost?: number;
  defaultShelfLifeDays?: number;
  createdBy: { id: string; name: string };
  createdAt: string;
  updatedAt: string;
}
export interface IngredientInput {
  name: string;
  brand: string;
  description: string;
  category: string;
  unitOfMeasure: string;
  minimumStock?: number;
  standardUnitCost?: number;
  defaultShelfLifeDays?: number;
}
export function listIngredients(page = 1, pageSize = 25, search = '', category = '', signal?: AbortSignal, unit = '') {
  const query = new URLSearchParams({ page: String(page), pageSize: String(pageSize) });
  if (search) query.set('search', search);
  if (category) query.set('category', category);
  if (unit) query.set('unit', unit);
  return apiClient<Page<Ingredient>>(`/ingredients?${query}`, { signal });
}
export const getIngredientSummary = (signal?: AbortSignal) => apiClient<{ total: number; categories: string[]; units: string[]; mostCommonIngredient: string | null }>('/ingredients/summary', { signal });
export const listIngredientCategories = (signal?: AbortSignal) => apiClient<{ categories: string[] }>('/ingredients/categories', { signal });
export type StockInIngredient = Pick<Ingredient, 'id' | 'name' | 'category' | 'unitOfMeasure' | 'standardUnitCost' | 'defaultShelfLifeDays'>;
export const listStockInIngredients = (signal?: AbortSignal) => apiClient<{ ingredients: StockInIngredient[] }>('/ingredients/stock-in-options', { signal });
export const createIngredient = (input: IngredientInput) => apiClient<{ ingredient: Ingredient }>('/ingredients', { method: 'POST', body: JSON.stringify(input), successMessage: 'Ingredient added successfully.' });

export const updateIngredient = (id: string, input: IngredientInput) => apiClient<{ ingredient: Ingredient }>(`/ingredients/${id}`, { method: 'PUT', body: JSON.stringify(input), successMessage: 'Ingredient updated successfully.' });
export const deleteIngredient = (id: string) => apiClient<void>(`/ingredients/${id}`, { method: 'DELETE', successMessage: 'Ingredient removed successfully.' });

export interface ForecastAccuracyMetrics {
  evaluatedDays: number;
  minimumRequiredDays: number;
  mae: number;
  rmse: number;
  wape: number | null;
  accuracyScore: number | null;
}

export type ForecastAccuracyResponse =
  | {
      status: 'UNAVAILABLE';
      reason: string;
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

export interface ForecastVsActualPoint {
  date: string;
  forecast: number | null;
  actual: number | null;
}

export interface ForecastVsActualResponse {
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

export const getForecastAccuracy = (id: string, signal?: AbortSignal) =>
  apiClient<ForecastAccuracyResponse>(`/ingredients/${id}/forecast-accuracy`, { signal });

export const getForecastVsActual = (id: string, days = 30, signal?: AbortSignal) =>
  apiClient<ForecastVsActualResponse>(`/ingredients/${id}/forecast-vs-actual?days=${days}`, { signal });

export interface AdvisoryItem {
  code: 'SHORTAGE' | 'EXPIRY_EXPOSURE' | 'SURPLUS' | 'EXPIRED_STOCK' | 'INCOMPLETE_HORIZON' | 'NO_ACTION';
  level: 'ingredient' | 'batch' | 'note';
  message: string;
  quantity?: number;
  unit?: string;
  batchIndex?: number;
  expirationDate?: string;
}

export type RecommendationResponse =
  | { status: 'NOT_FOUND' }
  | { status: 'UNAVAILABLE'; reason: string }
  | {
      status: 'ADVISED';
      ingredientId: string;
      unit: string;
      recommendations: AdvisoryItem[];
      notes: AdvisoryItem[];
    };

export const getIngredientRecommendations = (id: string, forecastDates: string[], signal?: AbortSignal) =>
  apiClient<RecommendationResponse>(`/ingredients/${id}/recommendations`, {
    method: 'POST',
    body: JSON.stringify({ forecastDates }),
    signal,
    errorFeedback: false,
  });

export interface ForecastTableRow {
  id: string;
  name: string;
  category: string;
  unit: string;
  currentStock: number;
  avgDailyUsage: number;
  forecastedDemand: number;
  recommendedAction: string;
  riskLevel: 'Low' | 'Medium' | 'High' | 'Critical';
}

export interface ForecastTableResponse {
  items: ForecastTableRow[];
  total: number;
  page: number;
  pageSize: number;
}

export const getForecastTable = (
  page = 1,
  pageSize = 10,
  search = '',
  category = '',
  from = '',
  to = '',
  signal?: AbortSignal,
) => {
  const query = new URLSearchParams({ page: String(page), pageSize: String(pageSize) });
  if (search) query.set('search', search);
  if (category) query.set('category', category);
  if (from) query.set('from', from);
  if (to) query.set('to', to);
  return apiClient<ForecastTableResponse>(`/ingredients/forecast-table?${query}`, { signal });
};
