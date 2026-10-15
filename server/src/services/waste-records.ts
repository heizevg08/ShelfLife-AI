import type { Actor } from './administration';
import type { AnalyticsQuery } from '../validators/analytics';
import type { WasteCreateInput, WastePageQuery, WasteReason } from '../validators/waste-record';
import { AdministrationError } from '../middleware/administration.middleware';
import { businessDateString, dateOnlyCalendarString } from '../utils/business-day';


export interface WasteRecordView {
  id: string; dateWasted: string; ingredient: { id: string; name: string }; batch: { id: string; batchID: string };
  quantityWasted: number; unit: string; reason: WasteReason; wasteCost: number; recordedBy: { id: string; name: string; firstName?: string; lastName?: string }; createdAt: string;
}
export interface WasteSummary {
  totalWasteToday: { quantity: number; unit: string } | null;
  wasteRecordsToday: number;
  mostWastedIngredient: string | null;
  commonWasteReason: WasteReason | null;
  totalWasteCostToday: number;
}
export interface WasteReasonBreakdown { period: 'Last 30 Days'; counts: Record<WasteReason, number>; total: number }
// Reporting counts are separate from the private ML quantity target.
export interface WasteAnalytics {
  metric: 'record count';
  period: { from: string | null; to: string | null; label: string };
  total: number;
  dailyCounts: { date: string; count: number }[];
  byReason: Record<WasteReason, number>;
  topIngredients: { ingredientId: string; name: string; count: number }[];
  unresolvedIngredientRecords: number;
}
export interface WasteRecordStore {
  ready(): Promise<void>;
  list(query: WastePageQuery, now: Date): Promise<{ items: WasteRecordView[]; page: number; pageSize: number; total: number }>;
  detail(id: string): Promise<WasteRecordView | null>;
  summary(now: Date): Promise<WasteSummary>;
  reasonBreakdown(now: Date): Promise<WasteReasonBreakdown>;
  analytics(query: AnalyticsQuery, now: Date): Promise<WasteAnalytics>;
  create(actor: Actor, input: WasteCreateInput): Promise<WasteRecordView>;
  createMany(actor: Actor, inputs: WasteCreateInput[]): Promise<WasteRecordView[]>;
}
export function createWasteRecords(store: WasteRecordStore, now: () => Date = () => new Date()) {
  return {
    ready: () => store.ready(),
    list: (query: WastePageQuery) => store.list(query, now()),
    detail: (id: string) => store.detail(id),
    summary: () => store.summary(now()),
    reasonBreakdown: () => store.reasonBreakdown(now()),
    analytics: (query: AnalyticsQuery) => store.analytics(query, now()),
    create: (actor: Actor, input: WasteCreateInput) => {
      const current = now();
      if (dateOnlyCalendarString(input.dateWasted) > businessDateString(current)) throw new AdministrationError(400, 'VALIDATION_ERROR', 'Check the supplied fields', [{ field: 'dateWasted', message: 'Date wasted cannot be in the future' }]);
      return store.create(actor, input);
    },
    createMany: (actor: Actor, inputs: WasteCreateInput[]) => {
      const current = now();
      const today = businessDateString(current);
      inputs.forEach((input, index) => {
        if (dateOnlyCalendarString(input.dateWasted) > today) throw new AdministrationError(400, 'VALIDATION_ERROR', 'Check the supplied fields', [{ field: `items.${index}.dateWasted`, message: 'Date wasted cannot be in the future' }]);
      });
      return store.createMany(actor, inputs);
    },
  };
}
export type WasteRecordService = ReturnType<typeof createWasteRecords>;
