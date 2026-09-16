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
  createdBy: { id: string; name: string };
  createdAt: string;
  updatedAt: string;
}
export interface IngredientStore {
  list(query: IngredientPageQuery): Promise<{ items: Ingredient[]; page: number; pageSize: number; total: number }>;
  create(actorId: string, input: IngredientInput): Promise<Ingredient>;
  update(id: string, input: IngredientInput): Promise<Ingredient | null>;
  remove(id: string): Promise<boolean>;
}
export function createIngredients(store: IngredientStore) {
  return {
    list: (query: IngredientPageQuery) => store.list(query),
    create: (actorId: string, input: IngredientInput) => store.create(actorId, input),
    update: (id: string, input: IngredientInput) => store.update(id, input),
    remove: (id: string) => store.remove(id),
  };
}
export type IngredientService = ReturnType<typeof createIngredients>;
