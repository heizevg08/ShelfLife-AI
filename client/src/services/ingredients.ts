import { apiClient } from './apiClient';
import type { Page } from './administration';

export interface Ingredient {
  id: string;
  name: string;
  brand: string;
  description: string;
  category: string;
  customCategory?: string;
  unitOfMeasure: string;
  minimumStock?: number;
  standardUnitCost?: number;
  defaultShelfLifeDays?: number;
  isActive: boolean;
  version: number;
  createdBy: { id: string; name: string };
  createdAt: string;
  updatedAt: string;
}
export interface IngredientInput {
  name: string;
  brand: string;
  description: string;
  category: string;
  customCategory?: string;
  unitOfMeasure: string;
  minimumStock?: number;
  standardUnitCost?: number;
  defaultShelfLifeDays?: number;
}
export interface StockInIngredientOption {
  id: string;
  name: string;
  category: string;
  unitOfMeasure: string;
  defaultShelfLifeDays?: number;
}
export interface IngredientSummary { total: number; categories: string[]; units: string[]; mostCommonIngredient: string | null }
export async function listIngredients(page = 1, pageSize = 25, search = '', category = '', signal?: AbortSignal, includeArchived = false) {
  const query = new URLSearchParams({ page: String(page), limit: String(pageSize) });
  if (search) query.set('search', search);
  if (category) query.set('category', category);
  if (includeArchived) query.set('includeArchived', 'true');
  const result = await apiClient<{ items: Ingredient[]; page: number; limit: number; total: number }>(`/ingredients?${query}`, { signal });
  return { ...result, pageSize: result.limit } as Page<Ingredient>;
}
export const createIngredient = (input: IngredientInput) => apiClient<{ ingredient: Ingredient }>('/ingredients', { method: 'POST', body: JSON.stringify(input) });

export const updateIngredient = (id: string, input: IngredientInput, expectedVersion: number) => apiClient<{ ingredient: Ingredient }>(`/ingredients/${id}`, { method: 'PATCH', body: JSON.stringify({ ...input, expectedVersion }) });
export const deleteIngredient = (id: string, expectedVersion: number) => apiClient<void>(`/ingredients/${id}`, { method: 'DELETE', body: JSON.stringify({ expectedVersion }) });
export const ingredientCategories = (signal?: AbortSignal) => apiClient<{ categories: string[] }>('/ingredients/categories', { signal });
export const ingredientSummary = (signal?: AbortSignal) => apiClient<IngredientSummary>('/ingredients/summary', { signal });
export const stockInIngredientOptions = (signal?: AbortSignal) => apiClient<{ ingredients: StockInIngredientOption[] }>('/ingredients/stock-in-options', { signal });
