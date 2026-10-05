import { afterEach, expect, test, vi } from 'vitest';
vi.mock('../src/services/auth', () => ({ currentUser: vi.fn().mockResolvedValue({ role: 'Inventory Manager' }) }));
vi.mock('../src/services/session', () => ({ getAccessToken: () => 'test-token' }));
import { inventoryBatchSummary, listInventoryBatches } from '../src/services/inventoryBatches';
import { adaptInventoryBatch, formatPhp } from '../src/services/inventoryManagerAdapter';
import { ingredientCategories, ingredientSummary, stockInIngredientOptions } from '../src/services/ingredients';

afterEach(() => vi.unstubAllGlobals());

test('manager inventory adapters preserve decimal strings and use the stable read endpoints', async () => {
  const fetch = vi.fn()
    .mockResolvedValueOnce(new Response(JSON.stringify({ items: [], page: 1, limit: 25, total: 0 })))
    .mockResolvedValueOnce(new Response(JSON.stringify({ totalIngredients: 0, totalBatches: 0, lowStockItems: 0, lowStockExcludedCount: 0, statusCounts: { Normal: 0, 'Approaching Expiry': 0, Critical: 0, Expired: 0 }, categoryCounts: [], inventoryValue: '0.00' })))
    .mockResolvedValueOnce(new Response(JSON.stringify({ categories: ['Dairy'] })))
    .mockResolvedValueOnce(new Response(JSON.stringify({ total: 1, categories: ['Dairy'], units: ['L'], mostCommonIngredient: null })))
    .mockResolvedValueOnce(new Response(JSON.stringify({ ingredients: [] })));
  vi.stubGlobal('fetch', fetch);
  await listInventoryBatches(); await inventoryBatchSummary(); await ingredientCategories(); await ingredientSummary(); await stockInIngredientOptions();
  expect(fetch.mock.calls.map(call => call[0])).toEqual(expect.arrayContaining([
    expect.stringContaining('/api/inventory-batches?page=1&limit=25'), expect.stringContaining('/api/inventory-batches/summary'),
    expect.stringContaining('/api/ingredients/categories'), expect.stringContaining('/api/ingredients/summary'), expect.stringContaining('/api/ingredients/stock-in-options'),
  ]));
  const batch = adaptInventoryBatch({ id: 'batch', ingredientId: 'ingredient', batchCode: 'B-001', initialQuantity: '2.000', quantity: '1.250', unit: 'kg', unitCost: '3.4000', currency: 'PHP', dateReceived: '2026-09-20', expirationDate: '2026-09-24', isActive: true, version: 0, createdBy: 'user', createdAt: '2026-09-20T00:00:00.000Z', updatedAt: '2026-09-20T00:00:00.000Z', status: 'Approaching Expiry' }, [{ id: 'ingredient', name: 'Milk', category: 'Dairy', unitOfMeasure: 'kg' }]);
  expect(batch.ingredient?.name).toBe('Milk');
  expect(batch.quantity).toBe('1.250');
  expect(formatPhp('0.01')).toBe('\u20b10.01');
});
