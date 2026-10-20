import type { Actor } from './administration';
import type { AnalyticsQuery } from '../validators/analytics';
import type { UsageCreateInput, UsagePageQuery } from '../validators/usage-record';
import { AdministrationError } from '../middleware/administration.middleware';
import { businessDateString, dateOnlyCalendarString } from '../utils/business-day';

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
  usageTotalsByUnitToday: Array<{ quantity: number; unit: string }>;
  usageRecordsToday: number;
  mostUsedIngredient: string | null;
  ingredientsUsedThisWeek: number;
}
// Reporting counts are separate from the private ML quantity target.
export interface UsageAnalytics {
  metric: 'record count';
  period: { from: string | null; to: string | null; label: string };
  total: number;
  dailyCounts: { date: string; count: number }[];
  unresolvedIngredientRecords: number;
}
export interface UsageRecordStore {
  ready(): Promise<void>;
  list(query: UsagePageQuery, now: Date): Promise<{ items: UsageRecordView[]; page: number; pageSize: number; total: number }>;
  detail(id: string): Promise<UsageRecordView | null>;
  summary(businessDate: Date): Promise<UsageSummary>;
  analytics(query: AnalyticsQuery, now: Date): Promise<UsageAnalytics>;
  create(actor: Actor, input: UsageCreateInput): Promise<UsageRecordView>;
  createMany(actor: Actor, inputs: UsageCreateInput[]): Promise<UsageRecordView[]>;
}
/**
 * Usage records for stock consumed against a batch.
 *
 * The clock is injected so a test can pin "today" and so every future-date guard in this
 * module reads the same instant instead of calling `new Date()` at slightly different times.
 */
export function createUsageRecords(store: UsageRecordStore, now: () => Date = () => new Date()) {
  return {
    ready: () => store.ready(),
    list: (query: UsagePageQuery) => store.list(query, now()),
    detail: (id: string) => store.detail(id),
    summary: (businessDate?: Date) => store.summary(businessDate ?? now()),
    analytics: (query: AnalyticsQuery) => store.analytics(query, now()),
    create: (actor: Actor, input: UsageCreateInput) => {
      const current = now();
      if (dateOnlyCalendarString(input.dateUsed) > businessDateString(current)) throw new AdministrationError(400, 'VALIDATION_ERROR', 'Check the supplied fields', [{ field: 'dateUsed', message: 'Date used cannot be in the future' }]);
      return store.create(actor, input);
    },
    createMany: (actor: Actor, inputs: UsageCreateInput[]) => {
      const current = now();
      const today = businessDateString(current);
      inputs.forEach((input, index) => {
        if (dateOnlyCalendarString(input.dateUsed) > today) throw new AdministrationError(400, 'VALIDATION_ERROR', 'Check the supplied fields', [{ field: `items.${index}.dateUsed`, message: 'Date used cannot be in the future' }]);
      });
      return store.createMany(actor, inputs);
    },
  };
}
export type UsageRecordService = ReturnType<typeof createUsageRecords>;
