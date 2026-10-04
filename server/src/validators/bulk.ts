import { invalid } from './administration';
import { AdministrationError } from '../middleware/administration.middleware';

export const MAX_BULK_ITEMS = 25;

export function bulkItems<T>(body: unknown, parse: (value: unknown) => T): T[] {
  if (!body || typeof body !== 'object' || Array.isArray(body)) invalid('body');
  const input = body as Record<string, unknown>;
  for (const key of Object.keys(input)) if (key !== 'items') invalid(key, 'Field is not permitted');
  if (!Array.isArray(input.items) || input.items.length < 1 || input.items.length > MAX_BULK_ITEMS) {
    invalid('items', `Submit between 1 and ${MAX_BULK_ITEMS} items`);
  }
  return input.items.map((item, index) => {
    try { return parse(item); }
    catch (error) {
      if (error instanceof AdministrationError) {
        const details = error.details.length ? error.details.map(detail => ({ ...detail, field: `items.${index}.${detail.field}` })) : [{ field: `items.${index}`, message: error.message }];
        throw new AdministrationError(error.status, error.code, error.message, details);
      }
      throw error;
    }
  });
}
