import type { RequestHandler } from 'express';
import type { ChangeRequestService } from '../services/change-requests';
import { typedChangeRequestId } from '../validators/change-request';

export function changeRequestControllers(service: ChangeRequestService): Record<'list' | 'detail' | 'summary' | 'managerSummary' | 'ingredientOptions' | 'create' | 'approve' | 'reject', RequestHandler> {
  return {
    list: async (req, res) => { res.json(await service.list(res.locals.user, req.query)); },
    detail: async (req, res) => { res.json({ request: await service.detail(res.locals.user, typedChangeRequestId(req.params.id)) }); },
    summary: async (_req, res) => { res.json(await service.summary(res.locals.user)); },
    managerSummary: async (_req, res) => { res.json(await service.managerSummary(res.locals.user)); },
    ingredientOptions: async (_req, res) => { res.json(await service.ingredientOptions(res.locals.user)); },
    create: async (req, res) => { res.status(201).json({ request: await service.create(res.locals.user, req.body) }); },
    approve: async (req, res) => { res.json({ request: await service.review(res.locals.user, typedChangeRequestId(req.params.id), 'APPROVED', req.body) }); },
    reject: async (req, res) => { res.json({ request: await service.review(res.locals.user, typedChangeRequestId(req.params.id), 'REJECTED', req.body) }); },
  };
}
