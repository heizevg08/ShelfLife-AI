import { afterEach, expect, test, vi } from 'vitest';
vi.mock('../src/services/auth', () => ({ currentUser: vi.fn().mockResolvedValue({ role: 'Admin' }) }));
vi.mock('../src/services/session', () => ({ getAccessToken: () => 'test-token' }));
import { apiClient, ApiError } from '../src/services/apiClient';
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
