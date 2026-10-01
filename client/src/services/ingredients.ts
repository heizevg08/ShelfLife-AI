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
  archivedBy?: { id: string; name: string };
  archivedAt?: string;
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
export async function listIngredients(page = 1, pageSize = 25, search = '', category = '', signal?: AbortSignal, includeArchived = false, unit = '') {
  const query = new URLSearchParams({ page: String(page), limit: String(pageSize) });
  if (search) query.set('search', search);
  if (category) query.set('category', category);
  if (unit) query.set('unit', unit);
  if (includeArchived) query.set('includeArchived', 'true');
  const result = await apiClient<{ items: Ingredient[]; page: number; limit: number; total: number }>(`/ingredients?${query}`, { signal });
  return { ...result, pageSize: result.limit } as Page<Ingredient>;
}
export const createIngredient = (input: IngredientInput) => apiClient<{ ingredient: Ingredient }>('/ingredients', { method: 'POST', body: JSON.stringify(input) });

export const updateIngredient = (id: string, input: IngredientInput, expectedVersion: number) => apiClient<{ ingredient: Ingredient }>(`/ingredients/${id}`, { method: 'PATCH', body: JSON.stringify({ ...input, expectedVersion }) });
export const deleteIngredient = (id: string, expectedVersion: number) => apiClient<void>(`/ingredients/${id}`, { method: 'DELETE', body: JSON.stringify({ expectedVersion }) });
