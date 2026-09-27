import { INGREDIENT_CATEGORIES, type IngredientInput, type IngredientPageQuery } from '../validators/ingredient';

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
  summary(): Promise<{ total: number; categories: string[]; units: string[]; mostCommonIngredient: string | null }>;
  create(actorId: string, input: IngredientInput): Promise<Ingredient>;
  update(id: string, input: IngredientInput): Promise<Ingredient | null>;
  remove(id: string): Promise<boolean>;
  stockInOptions(): Promise<{ id: string; name: string; unitOfMeasure: string; standardUnitCost?: number; defaultShelfLifeDays?: number }[]>;
}
export function createIngredients(store: IngredientStore) {
  return {
    categories: () => [...INGREDIENT_CATEGORIES],
    list: (query: IngredientPageQuery) => store.list(query),
    summary: () => store.summary(),
    create: (actorId: string, input: IngredientInput) => store.create(actorId, input),
    update: (id: string, input: IngredientInput) => store.update(id, input),
    remove: (id: string) => store.remove(id),
    stockInOptions: () => store.stockInOptions(),
  };
}
export type IngredientService = ReturnType<typeof createIngredients>;
