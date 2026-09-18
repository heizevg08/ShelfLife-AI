import type { RequestHandler } from 'express';
import type { IngredientService } from '../services/ingredients';
import { objectId } from '../validators/administration';
import { ingredientInput, ingredientPagination } from '../validators/ingredient';

export function ingredientControllers(service: IngredientService): Record<'list' | 'create' | 'update' | 'remove', RequestHandler> {
  return {
    list: async (req, res) => { res.json(await service.list(ingredientPagination(req.query))); },
    create: async (req, res) => { res.status(201).json({ ingredient: await service.create(res.locals.user.id, ingredientInput(req.body)) }); },
    update: async (req, res) => { const ingredient = await service.update(objectId(req.params.id), ingredientInput(req.body)); if (!ingredient) { res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Ingredient not found', details: [] } }); return; } res.json({ ingredient }); },
    remove: async (req, res) => { const removed = await service.remove(objectId(req.params.id)); if (!removed) { res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Ingredient not found', details: [] } }); return; } res.status(204).end(); },
  };
}
