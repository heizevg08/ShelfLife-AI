import type { RequestHandler } from 'express';
import type { UsageRecordService } from '../services/usage-records';
import { objectId } from '../validators/administration';
import { usageBulkInput, usageInput, usagePagination } from '../validators/usage-record';
import { calendarDate } from '../validators/date';

export function usageRecordControllers(service: UsageRecordService): Record<'list' | 'detail' | 'summary' | 'create' | 'createMany', RequestHandler> {
  return {
    list: async (req, res) => { res.json(await service.list(usagePagination(req.query))); },
    detail: async (req, res) => { const record = await service.detail(objectId(req.params.id)); if (!record) { res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Usage record not found', details: [] } }); return; } res.json({ record }); },
    summary: async (req, res) => { res.json(await service.summary(req.query.date === undefined ? undefined : calendarDate('date', req.query.date))); },
    create: async (req, res) => { res.status(201).json({ record: await service.create(res.locals.user, usageInput(req.body)) }); },
    createMany: async (req, res) => { const records = await service.createMany(res.locals.user, usageBulkInput(req.body)); res.status(201).json({ count: records.length, records }); },
  };
}
