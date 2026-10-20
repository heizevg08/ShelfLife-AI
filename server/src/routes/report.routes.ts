import { Router, type ErrorRequestHandler } from 'express';
import type { AuthService } from '../services/auth';
import { authenticate } from '../middleware/auth.middleware';
import { AdministrationError, authorizeAdministration } from '../middleware/administration.middleware';
import { HttpError } from '../middleware/error.middleware';
import { mongoInputGuard } from '../middleware/request-security.middleware';
import { reportQuery, type ReportId, FORECAST_REPORT_IDS } from '../validators/report';
import type { ReportExportService } from '../services/report-export';
import { reportWorkbook } from '../services/report-workbook';

const MANAGER_ONLY_REPORTS: ReadonlySet<string> = new Set(FORECAST_REPORT_IDS);

/**
 * Register the report and export routes on a new router.
 *
 * @param auth - the auth service used to guard every route.
 * @param service - the report service behind the handlers.
 * @returns the configured router.
 */
export function reportRoutes(auth: AuthService, service: ReportExportService) {
  const router = Router();
  router.use((_req, res, next) => { res.setHeader('Cache-Control', 'no-store'); next(); });
  router.use(authenticate(auth));
  router.use(authorizeAdministration(['Manager', 'Admin']));
  // Reject MongoDB operators and dotted keys in query input before any handler reads it.
  router.use(mongoInputGuard);
  router.get('/my-exports', async (req, res, next) => {
    try {
      if (Object.keys(req.query).length) throw new AdministrationError(400, 'INVALID_QUERY', 'Export history does not accept query parameters');
      res.json({ items: await service.recentExports(res.locals.user.id as string) });
    } catch (error) { next(error); }
  });
  router.get('/operational/:reportId/preview', async (req, res, next) => {
    try {
      const query = reportQuery(req.params.reportId!, req.query);
      const role = res.locals.user.role as string;
      if (MANAGER_ONLY_REPORTS.has(query.reportId) && role !== 'Manager' && role !== 'Super Admin') {
        throw new AdministrationError(403, 'FORBIDDEN', 'This report is restricted to Manager accounts');
      }
      const table = await service.table(query);
      res.json({ columns: table.columns, rows: table.rows.slice(0, 25), totalRows: table.dataRows, empty: table.empty });
    } catch (error) { next(error); }
  });
  const exportWorkbook = async (req: import('express').Request, res: import('express').Response, next: import('express').NextFunction, selectedReport?: string) => {
    let query;
    try { query = reportQuery(selectedReport ?? 'usage-consumption', req.query); }
    catch (error) { next(error); return; }
    const role = res.locals.user.role as string;
    if (MANAGER_ONLY_REPORTS.has(query.reportId) && role !== 'Manager' && role !== 'Super Admin') {
      next(new AdministrationError(403, 'FORBIDDEN', 'This report is restricted to Manager accounts'));
      return;
    }
    const actor = { id: res.locals.user.id as string, name: `${res.locals.user.firstName ?? ''} ${res.locals.user.lastName ?? ''}`.trim(), role: (res.locals.user.role === 'Admin' ? 'Admin' : 'Manager') as 'Admin' | 'Manager' };
    const requestedReports = selectedReport
      ? [{ reportId: query.reportId, dataRows: 0 }]
      : ['inventory-summary', 'usage-consumption', 'expiration-waste'].map(reportId => ({ reportId: reportId as ReportId, dataRows: 0 }));
    try {
      const result = await reportWorkbook(service, query, new Date(), selectedReport ? query.reportId : undefined);
      await service.auditWorkbook(actor, query, result.reports, 'Success');
      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      const filename = selectedReport
        ? `${query.reportId}${query.from ? `-${query.from}-${query.to}` : ''}.xlsx`
        : `management-report-${query.from}-${query.to}.xlsx`;
      res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
      res.setHeader('Access-Control-Expose-Headers', 'Content-Disposition');
      res.send(Buffer.from(result.buffer));
    } catch (error) {
      try { await service.auditWorkbook(actor, query, requestedReports, 'Failed'); } catch { /* Preserve the original failure. */ }
      next(error);
    }
  };
  router.get('/operational/export.xlsx', (req, res, next) => exportWorkbook(req, res, next));
  router.get('/operational/:reportId/export.xlsx', (req, res, next) => exportWorkbook(req, res, next, req.params.reportId));
  // Answer an unknown report sub-path with a coded 404, and translate handler errors
  // into the same error envelope every other administration router returns. Without
  // this the request falls through to the app-level not-found handler, which answers a
  // bare { message: 'Not found' } that the client cannot tell apart from a missing route.
  router.use((_req, res) => { res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Not found', details: [] } }); });
  const error: ErrorRequestHandler = (value, _req, res, next) => {
    if (res.headersSent) { next(value); return; }
    if (value instanceof AdministrationError) { res.status(value.status).json({ error: { code: value.code, message: value.message, details: value.details } }); return; }
    if (value instanceof HttpError) { res.status(value.status).json({ error: { code: value.status === 401 ? 'UNAUTHENTICATED' : 'REQUEST_FAILED', message: value.message, details: [] } }); return; }
    res.status(500).json({ error: { code: 'INTERNAL_ERROR', message: 'Unable to complete the request', details: [] } });
  };
  router.use(error);
  return router;
}
