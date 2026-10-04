import type { Actor } from './administration';
import type { UsageCreateInput, UsagePageQuery } from '../validators/usage-record';
import { AdministrationError } from '../middleware/administration.middleware';

export interface UsageRecordView {
  id: string;
  dateUsed: string;
  ingredient: { id: string; name: string };
  batch: { id: string; batchID: string };
  quantityUsed: number;
  unit: string;
  recordedBy: { id: string; name: string; firstName?: string; lastName?: string };
  createdAt: string;
}
export interface UsageSummary {
  totalUsageToday: { quantity: number; unit: string } | null;
  usageRecordsToday: number;
  mostUsedIngredient: string | null;
  ingredientsUsedThisWeek: number;
}
export interface UsageRecordStore {
  ready(): Promise<void>;
  list(query: UsagePageQuery, now: Date): Promise<{ items: UsageRecordView[]; page: number; pageSize: number; total: number }>;
  detail(id: string): Promise<UsageRecordView | null>;
  summary(now: Date): Promise<UsageSummary>;
  create(actor: Actor, input: UsageCreateInput): Promise<UsageRecordView>;
  createMany(actor: Actor, inputs: UsageCreateInput[]): Promise<UsageRecordView[]>;
}
export function createUsageRecords(store: UsageRecordStore, now: () => Date = () => new Date()) {
  return {
    ready: () => store.ready(),
    list: (query: UsagePageQuery) => store.list(query, now()),
    detail: (id: string) => store.detail(id),
    summary: () => store.summary(now()),
    create: (actor: Actor, input: UsageCreateInput) => {
      const current = now();
      if (input.dateUsed >= new Date(Date.UTC(current.getUTCFullYear(), current.getUTCMonth(), current.getUTCDate() + 1))) throw new AdministrationError(400, 'VALIDATION_ERROR', 'Check the supplied fields', [{ field: 'dateUsed', message: 'Date used cannot be in the future' }]);
      return store.create(actor, input);
    },
    createMany: (actor: Actor, inputs: UsageCreateInput[]) => {
      const current = now();
      const tomorrow = new Date(Date.UTC(current.getUTCFullYear(), current.getUTCMonth(), current.getUTCDate() + 1));
      inputs.forEach((input, index) => {
        if (input.dateUsed >= tomorrow) throw new AdministrationError(400, 'VALIDATION_ERROR', 'Check the supplied fields', [{ field: `items.${index}.dateUsed`, message: 'Date used cannot be in the future' }]);
      });
      return store.createMany(actor, inputs);
    },
  };
}
export type UsageRecordService = ReturnType<typeof createUsageRecords>;
