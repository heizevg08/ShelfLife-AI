import type { RequestHandler } from 'express';
import type { WasteRecordService } from '../services/waste-records';
import { objectId } from '../validators/administration';
import { wasteBulkInput, wasteInput, wastePagination } from '../validators/waste-record';

export function wasteRecordControllers(service: WasteRecordService): Record<'list' | 'detail' | 'summary' | 'reasonBreakdown' | 'create' | 'createMany', RequestHandler> {
  return {
    list: async (req, res) => { res.json(await service.list(wastePagination(req.query))); },
    detail: async (req, res) => { const record = await service.detail(objectId(req.params.id)); if (!record) { res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Waste record not found', details: [] } }); return; } res.json({ record }); },
    summary: async (_req, res) => { res.json(await service.summary()); },
    reasonBreakdown: async (_req, res) => { res.json(await service.reasonBreakdown()); },
    create: async (req, res) => { res.status(201).json({ record: await service.create(res.locals.user, wasteInput(req.body)) }); },
    createMany: async (req, res) => { const records = await service.createMany(res.locals.user, wasteBulkInput(req.body)); res.status(201).json({ count: records.length, records }); },
  };
}
