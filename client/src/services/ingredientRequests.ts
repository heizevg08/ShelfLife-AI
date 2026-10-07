import { apiClient } from './apiClient';
import type { IngredientInput, IngredientPatch } from './ingredients';

export interface IngredientRequest extends IngredientInput {
  id: string;
  status: 'Pending' | 'Approved' | 'Rejected';
  version: number;
  createdBy: { id: string; name: string };
  reviewedBy: { id: string; name: string } | null;
  reviewNote: string;
  ingredientId: string | null;
  createdAt: string;
  updatedAt: string;
}

export const listIngredientRequests = (signal?: AbortSignal) => apiClient<{ items: IngredientRequest[]; total: number }>('/ingredient-requests', { signal });
export const createIngredientRequest = (input: IngredientInput) => apiClient<{ request: IngredientRequest }>('/ingredient-requests', { method: 'POST', body: JSON.stringify(input) });
export const updateIngredientRequest = (id: string, input: IngredientPatch, expectedVersion: number) => apiClient<{ request: IngredientRequest }>(`/ingredient-requests/${id}`, { method: 'PATCH', body: JSON.stringify({ ...input, expectedVersion }) });
export const reviewIngredientRequest = (id: string, decision: 'Approved' | 'Rejected', expectedVersion: number) => apiClient<{ request: IngredientRequest; ingredientId: string | null }>(`/ingredient-requests/${id}/review`, { method: 'PATCH', body: JSON.stringify({ decision, expectedVersion }) });
export const deleteIngredientRequest = (id: string) => apiClient<void>(`/ingredient-requests/${id}`, { method: 'DELETE' });
