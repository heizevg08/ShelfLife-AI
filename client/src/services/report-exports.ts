import { apiBaseUrl } from './config';
import { currentUser } from './auth';
import { getAccessToken } from './session';
import { ApiError, apiClient } from './apiClient';

export type OperationalReportId =
  | 'inventory-summary'
  | 'expiration-waste'
  | 'usage-consumption'
  | 'demand-forecast'
  | 'forecast-vs-actual'
  | 'forecast-accuracy'
  | 'expiration-risk'
  | 'ai-insights-recommendations';
export type ReportPreview = { columns: string[]; rows: Array<Array<string | number | null>>; totalRows: number; empty: boolean };
export type ReportRange = { from: string; to: string } | null;
export type RecentExport = { reportId: OperationalReportId | 'management-workbook'; format: 'xlsx'; exportedAt: string; periodFrom?: string | null; periodTo?: string | null };

/**
 * The current user's most recent report downloads.
 *
 * @returns the recent export entries.
 */
export function getMyRecentExports(signal?: AbortSignal) {
  return apiClient<{ items: RecentExport[] }>('/reports/my-exports', { signal });
}
const path = (id: OperationalReportId, range: ReportRange, action: 'preview') => {
  const params = range ? `?${new URLSearchParams(range)}` : '';
  return `/reports/operational/${id}/${action}${params}`;
};

/**
 * Preview one operational report before downloading it.
 *
 * @param id - which report to preview.
 * @param range - the date range to summarise.
 * @returns the preview rows and totals.
 */
export function getReportPreview(id: OperationalReportId, range: ReportRange, signal?: AbortSignal) {
  return apiClient<ReportPreview>(path(id, range, 'preview'), { signal });
}

/**
 * Download a single operational report as XLSX.
 *
 * @param id - which report to export.
 * @param range - the date range to export; null exports every date.
 */
export async function downloadReportXlsx(id: OperationalReportId, range: ReportRange) {
  const params = range ? `?${new URLSearchParams(range)}` : '';
  await downloadFile(`/reports/operational/${id}/export.xlsx${params}`, `${id}.xlsx`, /filename="([a-z0-9-]+\.xlsx)"/i);
}

/**
 * Download every operational report in one workbook.
 *
 * @param range - a concrete date range; a null range is not accepted here.
 */
export async function downloadCombinedReport(range: Exclude<ReportRange, null>) {
  await downloadFile(`/reports/operational/export.xlsx?${new URLSearchParams(range)}`, `management-report-${range.from}-${range.to}.xlsx`, /filename="([a-z0-9-]+\.xlsx)"/i);
}

/**
 * Receive a generated file from the API and hand it to the browser.
 *
 * @param reportPath - API path of the download endpoint.
 * @param fallbackName - file name used when the server sends no usable one.
 * @param filenamePattern - matches the Content-Disposition name, so the real
 * server-side name wins over the fallback.
 */
export async function downloadFile(reportPath: string, fallbackName: string, filenamePattern: RegExp) {
  await currentUser();
  const response = await fetch(`${apiBaseUrl}/api${reportPath}`, {
    credentials: 'include', cache: 'no-store', headers: { Authorization: `Bearer ${getAccessToken()}` },
  });
  if (!response.ok) {
    const body = await response.json().catch(() => undefined);
    throw new ApiError(response.status, body?.error?.code ?? 'REQUEST_FAILED', body?.error?.message ?? 'The report could not be exported');
  }
  const blob = await response.blob();
  const disposition = response.headers.get('Content-Disposition') ?? '';
  const filename = filenamePattern.exec(disposition)?.[1] ?? fallbackName;
  const url = URL.createObjectURL(blob);
  try {
    const link = document.createElement('a');
    link.href = url; link.download = filename; document.body.append(link); link.click(); link.remove();
  } finally { URL.revokeObjectURL(url); }
}
