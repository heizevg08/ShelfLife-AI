import type { RequestHandler } from 'express';
import { objectId } from '../validators/administration';
import { changeRequestInput, changeRequestPeriodQuery, changeRequestQuery, reviewInput } from '../validators/change-request';
import type { ChangeRequestService } from '../services/change-requests';

export function changeRequestControllers(service: ChangeRequestService): Record<'list' | 'detail' | 'summary' | 'managerSummary' | 'ingredientOptions' | 'create' | 'approve' | 'reject', RequestHandler> {
  return {
    list: async (req, res) => {
      res.json(await service.list(res.locals.user, changeRequestQuery(req.query)));
    },
    detail: async (req, res) => {
      res.json({ request: await service.detail(res.locals.user, objectId(req.params.id)) });
    },
    summary: async (_req, res) => {
      res.json(await service.summary(res.locals.user));
    },
    managerSummary: async (req, res) => {
      res.json(await service.managerSummary(res.locals.user, changeRequestPeriodQuery(req.query)));
    },
    ingredientOptions: async (_req, res) => {
      res.json(await service.ingredientOptions(res.locals.user));
    },
    create: async (req, res) => {
      res.status(201).json({ request: await service.create(res.locals.user, changeRequestInput(req.body)) });
    },
    approve: async (req, res) => {
      const id = objectId(req.params.id);
      const note = reviewInput(req.body, false).reviewNote;
      res.json({ request: await service.review(res.locals.user, id, 'APPROVED', note) });
    },
    reject: async (req, res) => {
      const id = objectId(req.params.id);
      const note = reviewInput(req.body, true).reviewNote;
      res.json({ request: await service.review(res.locals.user, id, 'REJECTED', note) });
    },
  };
}
