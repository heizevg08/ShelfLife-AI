import type { RequestHandler } from 'express';
import type { AdministrationService } from '../services/administration';
import { accountInput, auditPagination, objectId, pagination, invalid } from '../validators/administration';

export function administrationControllers(service: AdministrationService): Record<'list' | 'get' | 'create' | 'update' | 'deactivate' | 'reactivate' | 'summary' | 'audit', RequestHandler> {
  const lifecycle = (active: boolean): RequestHandler => async (req, res) => {
    if (req.body !== undefined && (req.body === null || typeof req.body !== 'object' || Array.isArray(req.body)
      || Object.getPrototypeOf(req.body) !== Object.prototype || Object.keys(req.body).length)) invalid('body', 'No fields are accepted');
    res.json({ user: await service.setActive(res.locals.user, objectId(req.params.id), active) });
  };
  return {
    list: async (req, res) => { res.json(await service.list(res.locals.user, pagination(req.query, ['createdAt', 'updatedAt', 'email', 'firstName', 'lastName', 'role', 'isActive'], 'createdAt'))); },
    get: async (req, res) => { res.json({ user: await service.get(res.locals.user, objectId(req.params.id)) }); },
    create: async (req, res) => { res.status(201).json({ user: await service.create(res.locals.user, accountInput(req.body, true)) }); },
    update: async (req, res) => { res.json({ user: await service.update(res.locals.user, objectId(req.params.id), accountInput(req.body, false)) }); },
    deactivate: lifecycle(false), reactivate: lifecycle(true),
    summary: async (_req, res) => { res.json(await service.summary(res.locals.user)); },
    audit: async (req, res) => { res.json(await service.audits(auditPagination(req.query))); },
  };
}
