import { INGREDIENT_CATEGORIES, type IngredientInput, type IngredientPageQuery } from '../validators/ingredient';
import type { Actor } from './administration';

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
  create(actor: Actor, input: IngredientInput): Promise<Ingredient>;
  update(actor: Actor, id: string, input: IngredientInput): Promise<Ingredient | null>;
  remove(actor: Actor, id: string): Promise<boolean>;
  stockInOptions(): Promise<{ id: string; name: string; unitOfMeasure: string; standardUnitCost?: number; defaultShelfLifeDays?: number }[]>;
}
export function createIngredients(store: IngredientStore) {
  return {
    categories: () => [...INGREDIENT_CATEGORIES],
    list: (query: IngredientPageQuery) => store.list(query),
    summary: () => store.summary(),
    create: (actor: Actor, input: IngredientInput) => store.create(actor, input),
    update: (actor: Actor, id: string, input: IngredientInput) => store.update(actor, id, input),
    remove: (actor: Actor, id: string) => store.remove(actor, id),
    stockInOptions: () => store.stockInOptions(),
  };
}
export type IngredientService = ReturnType<typeof createIngredients>;
