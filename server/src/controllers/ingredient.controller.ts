import type { RequestHandler } from 'express';
import type { IngredientService } from '../services/ingredients';
import { ingredientInput, ingredientPagination } from '../validators/ingredient';
import { objectId } from '../validators/administration';
import { sendError } from '../middleware/error-response';

/**
 * Bind the ingredient handlers to a service instance.
 *
 * @param service - the ingredient service the handlers call.
 * @returns one request handler per ingredient action.
 */
export function ingredientControllers(service: IngredientService): Record<'categories' | 'stockInOptions' | 'summary' | 'list' | 'create' | 'update' | 'remove', RequestHandler> {
  return {
    categories: async (_req, res) => { res.json({ categories: service.categories() }); },
    stockInOptions: async (_req, res) => { res.json({ ingredients: await service.stockInOptions() }); },
    summary: async (_req, res) => { res.json(await service.summary()); },
    list: async (req, res) => { res.json(await service.list(ingredientPagination(req.query))); },
    create: async (req, res) => { res.status(201).json({ ingredient: await service.create(res.locals.user, ingredientInput(req.body)) }); },
    update: async (req, res) => { const ingredient = await service.update(res.locals.user, objectId(req.params.id), ingredientInput(req.body)); if (!ingredient) { sendError(res, 404, 'NOT_FOUND', 'Ingredient not found'); return; } res.json({ ingredient }); },
    remove: async (req, res) => { const removed = await service.remove(res.locals.user, objectId(req.params.id)); if (!removed) { sendError(res, 404, 'NOT_FOUND', 'Ingredient not found'); return; } res.status(204).end(); },
  };
}
