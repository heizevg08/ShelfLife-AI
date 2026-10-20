import type { RequestHandler } from 'express';
import type { InventoryBatchService } from '../services/inventory-batches';
import { inventoryBatchExportQuery, inventoryBatchPagination, stockInBulkInput, stockInInput } from '../validators/inventory-batch';
import { objectId } from '../validators/administration';
import { inventoryBatchWorkbook } from '../services/inventory-batch-workbook';
import { sendError } from '../middleware/error-response';

export function inventoryBatchControllers(service: InventoryBatchService): Record<'list' | 'exportXlsx' | 'detail' | 'summary' | 'stockInSummary' | 'create' | 'createMany', RequestHandler> {
  return {
    list: async (req, res) => { res.json(await service.list(inventoryBatchPagination(req.query))); },
    exportXlsx: async (req, res) => {
      const query = inventoryBatchExportQuery(req.query);
      const result = await inventoryBatchWorkbook(service, query);
      const from = typeof req.query.from === 'string' ? req.query.from : 'all-dates';
      const to = typeof req.query.to === 'string' ? req.query.to : 'all-dates';
      await service.auditExport(res.locals.user, from === 'all-dates' ? null : from, to === 'all-dates' ? null : to, result.dataRows);
      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      res.setHeader('Content-Disposition', `attachment; filename="inventory-period-report-${from}-${to}.xlsx"`);
      res.send(result.buffer);
    },
    detail: async (req, res) => { const batch = await service.detail(objectId(req.params.id)); if (!batch) { sendError(res, 404, 'NOT_FOUND', 'Inventory batch not found'); return; } res.json({ batch }); },
    summary: async (_req, res) => { res.json(await service.summary()); },
    stockInSummary: async (_req, res) => { res.json(await service.stockInSummary()); },
    create: async (req, res) => { const batch = await service.create(res.locals.user, stockInInput(req.body)); if (!batch) { sendError(res, 404, 'NOT_FOUND', 'Ingredient not found'); return; } res.status(201).json({ batch }); },
    createMany: async (req, res) => { const batches = await service.createMany(res.locals.user, stockInBulkInput(req.body)); res.status(201).json({ count: batches.length, batches }); },
  };
}
