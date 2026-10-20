import { AdministrationError } from '../middleware/administration.middleware';
import { calendarDate } from './date';

export const CORE_REPORT_IDS = ['inventory-summary', 'expiration-waste', 'usage-consumption'] as const;
export const FORECAST_REPORT_IDS = [
  'demand-forecast',
  'forecast-vs-actual',
  'forecast-accuracy',
  'expiration-risk',
  'ai-insights-recommendations',
] as const;

export const REPORT_IDS = [...CORE_REPORT_IDS, ...FORECAST_REPORT_IDS] as const;
export type ReportId = typeof REPORT_IDS[number];
export type ReportQuery = { reportId: ReportId; from?: string; to?: string; start?: Date; end?: Date };

const DATE_REQUIRED_REPORTS = new Set<ReportId>([
  'expiration-waste',
  'usage-consumption',
  'forecast-vs-actual',
]);

export function reportQuery(reportId: string, query: Record<string, unknown>): ReportQuery {
  if (!REPORT_IDS.includes(reportId as ReportId)) {
    throw new AdministrationError(400, 'VALIDATION_ERROR', 'Unknown report type');
  }
  const allowed = reportId === 'inventory-summary' ? [] : ['from', 'to'];
  for (const key of Object.keys(query)) {
    if (!allowed.includes(key)) throw new AdministrationError(400, 'VALIDATION_ERROR', `Unsupported query parameter: ${key}`);
  }
  if (reportId === 'inventory-summary') return { reportId: reportId as ReportId };

  const hasFrom = query.from !== undefined;
  const hasTo = query.to !== undefined;

  if (!hasFrom && !hasTo) {
    if (DATE_REQUIRED_REPORTS.has(reportId as ReportId)) {
      throw new AdministrationError(400, 'VALIDATION_ERROR', 'Date range is required for this report');
    }
    return { reportId: reportId as ReportId };
  }

  const start = calendarDate('from', query.from), last = calendarDate('to', query.to);
  const days = Math.round((last.getTime() - start.getTime()) / 86_400_000) + 1;
  if (days < 1 || days > 90) throw new AdministrationError(400, 'VALIDATION_ERROR', 'Select 1 to 90 inclusive calendar days');
  const philippineOffset = 8 * 3_600_000;
  return {
    reportId: reportId as ReportId,
    from: query.from as string,
    to: query.to as string,
    start: new Date(start.getTime() - philippineOffset),
    end: new Date(last.getTime() + 86_400_000 - philippineOffset),
  };
}
