import { apiClient } from './apiClient';
import type { Page } from './administration';

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
export const listIngredientCategories = (signal?: AbortSignal) => apiClient<{ categories: string[] }>('/ingredients/categories', { signal });
export const createIngredient = (input: IngredientInput) => apiClient<{ ingredient: Ingredient }>('/ingredients', { method: 'POST', body: JSON.stringify(input) });

export const updateIngredient = (id: string, input: IngredientInput) => apiClient<{ ingredient: Ingredient }>(`/ingredients/${id}`, { method: 'PUT', body: JSON.stringify(input) });
export const deleteIngredient = (id: string) => apiClient<void>(`/ingredients/${id}`, { method: 'DELETE' });
