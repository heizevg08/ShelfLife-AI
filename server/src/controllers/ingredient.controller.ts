import { archiveInput } from '../validators/inventory-contract';
import type { RequestHandler } from 'express';
import type { IngredientService } from '../services/ingredients';
import { ingredientInput, ingredientPagination, ingredientPatch } from '../validators/ingredient';
import { objectId } from '../validators/administration';

export function ingredientControllers(service: IngredientService): Record<'list' | 'create' | 'update' | 'remove', RequestHandler> {
  return {
    list: async (req, res) => { res.json(await service.list(ingredientPagination(req.query))); },
    create: async (req, res) => { res.status(201).json({ ingredient: await service.create(res.locals.user.id, ingredientInput(req.body)) }); },
    update: async (req, res) => { const input = ingredientPatch(req.body); const ingredient = await service.update(res.locals.user.id, objectId(req.params.id), input.patch, input.expectedVersion); if (!ingredient) { res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Ingredient not found', details: [] } }); return; } res.json({ ingredient }); },
    remove: async (req, res) => { const removed = await service.remove(res.locals.user.id, objectId(req.params.id), archiveInput(req.body)); if (!removed) { res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Ingredient not found', details: [] } }); return; } res.status(204).end(); },
  };
}
