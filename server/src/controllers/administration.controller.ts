import type { RequestHandler } from 'express';
import type { AdministrationService } from '../services/administration';
import { onAuditRecorded } from '../services/audit-events';
import { accountInput, accountPagination, auditPagination, objectId, invalid } from '../validators/administration';

export function administrationControllers(service: AdministrationService): Record<'list' | 'get' | 'create' | 'update' | 'deactivate' | 'reactivate' | 'delete' | 'summary' | 'audit' | 'exportAudit' | 'stream', RequestHandler> {
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
    delete: async (req, res) => {
      if (req.body && Object.keys(req.body).length) invalid('body', 'No fields are accepted');
      await service.delete(res.locals.user, objectId(req.params.id));
      res.status(204).end();
    },
    summary: async (_req, res) => { res.json(await service.summary(res.locals.user)); },
    audit: async (req, res) => { res.json(await service.audits(res.locals.user, auditPagination(req.query))); },
    exportAudit: async (req, res) => {
      const workbook = await service.exportAudits(res.locals.user, auditPagination(req.query));
      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      res.setHeader('Content-Disposition', 'attachment; filename="shelflife-audit-records.xlsx"');
      res.setHeader('Access-Control-Expose-Headers', 'Content-Disposition');
      res.setHeader('Cache-Control', 'no-store');
      res.send(Buffer.from(workbook));
    },
    stream: (req, res) => {
      res.status(200).set({ 'Content-Type': 'text/event-stream; charset=utf-8', 'Connection': 'keep-alive', 'X-Accel-Buffering': 'no' });
      res.flushHeaders();
      res.write('retry: 5000\n: connected\n\n');
      const heartbeat = setInterval(() => { res.write(': ping\n\n'); }, 25000);
      const unsubscribe = onAuditRecorded(() => { res.write('data: {}\n\n'); });
      const close = () => { clearInterval(heartbeat); unsubscribe(); };
      req.on('close', close); res.on('close', close); res.on('error', close);
    },
  };
}
