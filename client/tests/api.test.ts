import { afterEach, expect, test, vi } from 'vitest';
vi.mock('../src/services/auth', () => ({ currentUser: vi.fn().mockResolvedValue({ role: 'Admin' }) }));
vi.mock('../src/services/session', () => ({ getAccessToken: () => 'test-token' }));
import { apiClient, ApiError } from '../src/services/apiClient';
import { listIngredients, updateIngredient, deleteIngredient } from '../src/services/ingredients';
import { listAccounts, updateAccount } from '../src/services/administration';
afterEach(() => vi.unstubAllGlobals());

test('204 deletion succeeds without parsing a nonexistent body, with no-store authorization', async () => {
  const fetch = vi.fn().mockResolvedValue(new Response(null, { status: 204 }));
  vi.stubGlobal('fetch', fetch);
  await expect(apiClient('/ingredients/id', { method: 'DELETE' })).resolves.toBeUndefined();
  expect(fetch).toHaveBeenCalledWith(expect.stringContaining('/api/ingredients/id'), expect.objectContaining({ cache: 'no-store', method: 'DELETE', headers: expect.objectContaining({ Authorization: 'Bearer test-token' }) }));
});

test('failed writes surface field errors without automatic replay', async () => {
  const fetch = vi.fn().mockResolvedValue(new Response(JSON.stringify({ error: { code: 'CONFLICT', message: 'Duplicate', details: [{ field: 'name', message: 'Use another name' }] } }), { status: 409 }));
  vi.stubGlobal('fetch', fetch);
  await expect(apiClient('/ingredients', { method: 'POST' })).rejects.toBeInstanceOf(ApiError);
  expect(fetch).toHaveBeenCalledTimes(1);
});

test('ingredient adapter uses limit, optional includeArchived, PATCH and expectedVersion without altering account pagination', async () => {
  const fetch = vi.fn().mockResolvedValueOnce(new Response(JSON.stringify({ items: [], page: 2, limit: 10, total: 0 })))
    .mockResolvedValueOnce(new Response(JSON.stringify({ ingredient: { id: 'id', version: 3 } })))
    .mockResolvedValueOnce(new Response(null, { status: 204 }));
  vi.stubGlobal('fetch', fetch);
  const page = await listIngredients(2, 10, '', '', undefined, true);
  expect(page.pageSize).toBe(10);
  expect(fetch.mock.calls[0][0]).toContain('page=2&limit=10&includeArchived=true');
  const input = { name: 'Milk', brand: '', description: '', category: 'Dairy', unitOfMeasure: 'L' };
  await updateIngredient('id', input, 2);
  expect(fetch.mock.calls[1][1]).toMatchObject({ method: 'PATCH', body: JSON.stringify({ ...input, expectedVersion: 2 }) });
  await deleteIngredient('id', 3);
  expect(fetch.mock.calls[2][1]).toMatchObject({ method: 'DELETE', body: JSON.stringify({ expectedVersion: 3 }) });
});

test('account directory sends literal server-side filters and account PATCH can be diff-only', async () => {
  const fetch = vi.fn().mockResolvedValueOnce(new Response(JSON.stringify({ items: [], page: 1, pageSize: 10, total: 0 })))
    .mockResolvedValueOnce(new Response(JSON.stringify({ user: { id: 'id' } })));
  vi.stubGlobal('fetch', fetch);
  await listAccounts(1, 'createdAt', 'desc', undefined, 10, { search: 'Ada.*', role: 'Admin', status: 'active' });
  expect(fetch.mock.calls[0][0]).toContain('search=Ada.*');
  expect(fetch.mock.calls[0][0]).toContain('role=Admin');
  expect(fetch.mock.calls[0][0]).toContain('status=active');
  await updateAccount('id', { role: 'Inventory Staff' });
  expect(fetch.mock.calls[1][1]).toMatchObject({ method: 'PATCH', body: JSON.stringify({ role: 'Inventory Staff' }) });
  expect(JSON.parse(String(fetch.mock.calls[1][1]?.body))).toEqual({ role: 'Inventory Staff' });
});
