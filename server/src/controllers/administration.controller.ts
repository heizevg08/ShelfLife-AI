import type { RequestHandler } from 'express';
import type { AdministrationService } from '../services/administration';
import { accountInput, accountPagination, auditPagination, objectId, invalid } from '../validators/administration';

export function administrationControllers(service: AdministrationService): Record<'list' | 'get' | 'create' | 'update' | 'deactivate' | 'reactivate' | 'summary' | 'audit' | 'exportAudit', RequestHandler> {
  const lifecycle = (active: boolean): RequestHandler => async (req, res) => {
    if (req.body && Object.keys(req.body).length) invalid('body', 'No fields are accepted');
    res.json({ user: await service.setActive(res.locals.user, objectId(req.params.id), active) });
  };
  return {
    list: async (req, res) => { res.json(await service.list(res.locals.user, accountPagination(req.query))); },
    get: async (req, res) => { res.json({ user: await service.get(res.locals.user, objectId(req.params.id)) }); },
    create: async (req, res) => { res.status(201).json({ user: await service.create(res.locals.user, accountInput(req.body, true)) }); },
    update: async (req, res) => { res.json({ user: await service.update(res.locals.user, objectId(req.params.id), accountInput(req.body, false)) }); },
    deactivate: lifecycle(false), reactivate: lifecycle(true),
    summary: async (_req, res) => { res.json(await service.summary(res.locals.user)); },
    audit: async (req, res) => { res.json(await service.audits(res.locals.user, auditPagination(req.query))); },
    exportAudit: async (req, res) => {
      const csv = await service.exportAudits(res.locals.user, auditPagination(req.query));
      res.setHeader('Content-Type', 'text/csv; charset=utf-8');
      res.setHeader('Content-Disposition', 'attachment; filename="shelflife-audit-records.csv"');
      res.setHeader('Cache-Control', 'no-store');
      res.send(csv);
    },
  };
}
