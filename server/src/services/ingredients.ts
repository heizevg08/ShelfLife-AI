import { INGREDIENT_CATEGORIES } from '../models/ingredient-options';
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
export interface IngredientSummary {
  total: number;
  categories: string[];
  units: string[];
  mostCommonIngredient: string | null;
}
export interface StockInIngredientOption {
  id: string;
  name: string;
  category: string;
  unitOfMeasure: string;
  defaultShelfLifeDays?: number;
}
export interface IngredientStore {
  list(query: IngredientPageQuery): Promise<{ items: Ingredient[]; page: number; limit: number; total: number }>;
  summary(): Promise<IngredientSummary>;
  stockInOptions(): Promise<StockInIngredientOption[]>;
  create(actorId: string, input: IngredientInput): Promise<Ingredient>;
  update(actorId: string, id: string, input: Partial<IngredientInput>, expectedVersion: number): Promise<Ingredient | null>;
  remove(actorId: string, id: string, expectedVersion: number): Promise<boolean>;
}
export function createIngredients(store: IngredientStore) {
  return {
    categories: () => [...INGREDIENT_CATEGORIES],
    list: (query: IngredientPageQuery) => store.list(query),
    summary: () => store.summary(),
    stockInOptions: () => store.stockInOptions(),
    create: (actorId: string, input: IngredientInput) => store.create(actorId, input),
    update: (actorId: string, id: string, input: Partial<IngredientInput>, expectedVersion: number) => store.update(actorId, id, input, expectedVersion),
    remove: (actorId: string, id: string, expectedVersion: number) => store.remove(actorId, id, expectedVersion),
  };
}
export type IngredientService = ReturnType<typeof createIngredients>;
