import type { IngredientInput } from '../validators/ingredient';
import type { IngredientRequestReview } from '../validators/ingredient-request';
import type { IngredientRequestStore } from './ingredient-request-store';
import { AdministrationError } from '../middleware/administration.middleware';

const forbidden = () => new AdministrationError(403, 'FORBIDDEN', 'This action is not permitted');
const reviewers = ['Inventory Manager', 'Admin', 'Super Admin'];

export function createIngredientRequests(store: IngredientRequestStore) {
  return {
    async list(actor: { id: string; role: string }) {
      if (actor.role !== 'Inventory Staff' && !reviewers.includes(actor.role)) throw forbidden();
      return store.list(actor.role === 'Inventory Staff' ? actor.id : undefined);
    },
    async create(actor: { id: string; role: string }, input: IngredientInput) {
      if (actor.role !== 'Inventory Staff') throw forbidden();
      return store.create(actor.id, input);
    },
    async update(actor: { id: string; role: string }, id: string, input: IngredientInput, expectedVersion: number) {
      if (actor.role !== 'Inventory Staff') throw forbidden();
      return store.update(actor.id, id, input, expectedVersion);
    },
    async review(actor: { id: string; role: string }, id: string, input: IngredientRequestReview) {
      if (!reviewers.includes(actor.role)) throw forbidden();
      return store.review(actor.id, id, input);
    },
    async remove(actor: { id: string; role: string }, id: string) {
      if (!reviewers.includes(actor.role)) throw forbidden();
      return store.remove(actor.id, id);
    },
  };
}
export type IngredientRequestService = ReturnType<typeof createIngredientRequests>;