import type { ModuleId } from './workspace';

export type SummaryTone = 'neutral' | 'success' | 'attention' | 'critical' | 'brand';

interface ModuleSummaryItem {
  label: string;
  tone?: SummaryTone;
}

interface ModuleContent {
  description: string;
  title: string;
  columns: string[];
  missing: string;
  guide: { title: string; text: string }[];
  summaryItems?: ModuleSummaryItem[];
}

export const moduleContent: Partial<Record<ModuleId, ModuleContent>> = {
  Ingredients: {
    description: 'The ingredient catalogue behind every inventory batch.', title: 'Ingredient catalogue',
    columns: ['Ingredient', 'Category', 'Unit', 'Minimum stock', 'Standard unit cost'],
    missing: 'The ingredient catalogue is not connected yet.',
    guide: [{ title: 'Master data', text: 'Names, units and minimum-stock levels are managed by Admin.' }, { title: 'Separate from stock', text: 'Received quantities and actual expiration dates belong to inventory batches.' }],
  },
  InventoryBatches: {
    description: 'Track received stock, remaining quantities and batch expiration.', title: 'Batch inventory',
    columns: ['Ingredient', 'Batch Code', 'Remaining quantity', 'Received', 'Expiration', 'Status'],
    missing: 'Inventory records are not connected yet. Stock levels and expiration status cannot be confirmed.',
    guide: [{ title: 'Use first · FEFO', text: 'The earliest-expiring eligible batch is prioritised by the inventory service.' }, { title: 'Keep a transaction trail', text: 'Usage and waste are recorded separately. Quantities are not rewritten directly.' }],
  },
  Usage: {
    description: 'Trace ingredient consumption back to its inventory batch.', title: 'Usage history',
    columns: ['Date used', 'Ingredient', 'Batch', 'Quantity used', 'Recorded by'],
    missing: 'Usage records are not connected yet.',
    guide: [{ title: 'From batch to usage', text: 'A usage transaction validates the available quantity and preserves its batch reference.' }, { title: 'Forecasting input', text: 'Historical ingredient usage is the primary signal for demand forecasting.' }],
  },
  Waste: {
    description: 'Track discarded stock and the reasons behind inventory loss.', title: 'Waste history',
    columns: ['Date', 'Ingredient', 'Batch', 'Quantity wasted', 'Reason', 'Waste cost'],
    missing: 'Waste records are not connected yet. No waste totals can be confirmed.',
    guide: [{ title: 'Record the reason', text: 'Waste is a transaction with a quantity and reason, not an arbitrary stock adjustment.' }, { title: 'Learn from loss', text: 'Waste history supports analysis of expiration risk and prevention opportunities.' }],
  },
  ExpirationMonitoring: {
    description: 'Review approaching expiration and FEFO priority.', title: 'Expiration review',
    columns: ['Ingredient', 'Batch Code', 'Remaining quantity', 'Expiration', 'Status', 'FEFO priority'],
    missing: 'Batch expiration data is not connected yet.',
    guide: [{ title: 'Deterministic status', text: 'Expiration status and FEFO ordering come from inventory rules, not AI predictions.' }, { title: 'Act on the batch', text: 'Review the batch before recording usage, waste or a controlled change request.' }],
  },
  ChangeRequests: {
    description: 'Keep inventory corrections reviewable and traceable.', title: 'Request queue',
    columns: ['Request', 'Target', 'Type', 'Submitted', 'Status'],
    missing: 'Change requests are not connected yet.',
    summaryItems: [
      { label: 'Total requests', tone: 'brand' },
      { label: 'Pending review', tone: 'attention' },
      { label: 'Approved requests', tone: 'success' },
      { label: 'Rejected requests', tone: 'critical' },
    ],
    guide: [{ title: 'Submit', text: 'Inventory Staff describe the requested correction and its reason.' }, { title: 'Review', text: 'Inventory Manager reviews the request before an approved correction changes inventory.' }, { title: 'Preserve history', text: 'The decision and resulting change remain traceable.' }],
  },
  Forecasting: {
    description: 'Connect historical usage with inventory context to support decisions.', title: 'Forecast history & output',
    columns: ['Ingredient', 'Forecast period', 'Predicted consumption', 'Expiration risk', 'Generated'],
    missing: 'No forecasting service is connected. Predictions, confidence and recommendations are unavailable.',
    summaryItems: [
      { label: 'Forecast coverage', tone: 'brand' },
      { label: 'Forecast accuracy', tone: 'success' },
      { label: 'High expiration risk', tone: 'critical' },
      { label: 'Recommended actions', tone: 'attention' },
    ],
    guide: [{ title: 'Recommended actions', text: 'Suggestions will accompany forecast output when supported by sufficient operational data.' }, { title: 'Human review', text: 'Forecasts support Inventory Manager decisions. They do not automatically deduct or rewrite stock.' }],
  },
  Reports: {
    description: 'Review inventory, usage and waste through traceable operational records.', title: 'Report workspace',
    columns: ['Report', 'Period', 'Source records', 'Generated'],
    missing: 'Reporting is not connected yet. Charts, trends and export files are unavailable.',
    summaryItems: [
      { label: 'Inventory value', tone: 'brand' },
      { label: 'Waste value', tone: 'attention' },
      { label: 'Forecast accuracy', tone: 'success' },
      { label: 'High-risk ingredients', tone: 'critical' },
    ],
    guide: [{ title: 'Inventory & expiration', text: 'Review stock and expiration information for the selected reporting period.' }, { title: 'Usage & waste', text: 'Compare recorded consumption and loss without replacing the underlying transactions.' }, { title: 'Permission-controlled export', text: 'CSV, XLSX and PDF export will be available when reporting and export permissions are connected.' }],
  },
  Alerts: {
    description: 'Review inventory conditions that require attention.', title: 'Alert feed',
    columns: ['Alert', 'Ingredient / batch', 'Severity', 'Raised', 'Status'],
    missing: 'The alert feed is not connected yet. Unread counts and alert records are unavailable.',
    summaryItems: [
      { label: 'Total alerts', tone: 'brand' },
      { label: 'Critical alerts', tone: 'critical' },
      { label: 'Low-stock alerts', tone: 'attention' },
      { label: 'Expiring soon', tone: 'attention' },
    ],
    guide: [{ title: 'Expiration', text: 'Approaching-expiry and expired batches need different responses.' }, { title: 'Low stock', text: 'Low-stock alerts depend on real stock and configured ingredient thresholds.' }],
  },
  AdministrativeAudit: {
    description: 'Review administrative changes within your authorized scope.', title: 'Administrative records',
    columns: ['Time', 'Action', 'Actor', 'Target'],
    missing: 'Admin-scoped audit access is not connected yet. Protected system audit records remain restricted.',
    guide: [{ title: 'Read-only history', text: 'Audit records explain who changed what and when.' }, { title: 'Scoped access', text: 'This view will show only records authorized for Admin oversight.' }],
  },
};

// Preview fields explain the approved workflow without accepting unsaveable transactions.
export const previewFields = {
  Ingredients: ['Name', 'Brand', 'Category', 'Unit of measure', 'Minimum stock', 'Standard unit cost', 'Default shelf life (days)', 'Description'],
  StockIn: ['Ingredient', 'Batch code', 'Quantity received', 'Unit', 'Date received', 'Expiration date', 'Unit cost'],
  Usage: ['Inventory batch', 'Quantity used', 'Unit', 'Date used'],
  Waste: ['Inventory batch', 'Quantity wasted', 'Unit', 'Date wasted', 'Reason'],
  ChangeRequests: ['Target batch / ingredient', 'Change type', 'Proposed correction', 'Reason'],
};
export type PreviewId = keyof typeof previewFields;

// UI choices are configured here so route components do not hardcode export formats.
// TODO: Replace availability with permissions/capabilities returned by the reporting backend.
export const reportExportFormats = [
  { id: 'csv', label: 'CSV' },
  { id: 'xlsx', label: 'XLSX' },
  { id: 'pdf', label: 'PDF' },
] as const;

// Alert and change-request filter facets are intentionally backend-derived; no route-level values are hardcoded.