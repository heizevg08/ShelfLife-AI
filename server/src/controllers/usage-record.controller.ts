import type { RequestHandler } from 'express';
import type { UsageRecordService } from '../services/usage-records';
import { objectId } from '../validators/administration';
import { usageInput, usagePagination } from '../validators/usage-record';

export function usageRecordControllers(service: UsageRecordService): Record<'list' | 'detail' | 'summary' | 'create', RequestHandler> {
  return {
    list: async (req, res) => { res.json(await service.list(usagePagination(req.query))); },
    detail: async (req, res) => { const record = await service.detail(objectId(req.params.id)); if (!record) { res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Usage record not found', details: [] } }); return; } res.json({ record }); },
    summary: async (_req, res) => { res.json(await service.summary()); },
    create: async (req, res) => { res.status(201).json({ record: await service.create(res.locals.user, usageInput(req.body)) }); },
  };
}
