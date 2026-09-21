import type { IngredientInput, IngredientPageQuery } from '../validators/ingredient';

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
  isActive: boolean;
  version: number;
  createdBy: { id: string; name: string };
  createdAt: string;
  updatedAt: string;
}
export interface IngredientStore {
  list(query: IngredientPageQuery): Promise<{ items: Ingredient[]; page: number; limit: number; total: number }>;
  create(actorId: string, input: IngredientInput): Promise<Ingredient>;
  update(actorId: string, id: string, input: Partial<IngredientInput>, expectedVersion: number): Promise<Ingredient | null>;
  remove(actorId: string, id: string, expectedVersion: number): Promise<boolean>;
}
export function createIngredients(store: IngredientStore) {
  return {
    list: (query: IngredientPageQuery) => store.list(query),
    create: (actorId: string, input: IngredientInput) => store.create(actorId, input),
    update: (actorId: string, id: string, input: Partial<IngredientInput>, expectedVersion: number) => store.update(actorId, id, input, expectedVersion),
    remove: (actorId: string, id: string, expectedVersion: number) => store.remove(actorId, id, expectedVersion),
  };
}
export type IngredientService = ReturnType<typeof createIngredients>;
