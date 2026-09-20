import { test, expect } from '@playwright/test';
test.use({ serviceWorkers: 'allow' });

test('PWA caches static shell only, supports offline launch, and excludes API URLs', async ({ page, context }) => {
  await page.goto('/ShelfLifeAILogin');
  await page.evaluate(async () => { await navigator.serviceWorker.ready; });
  await page.reload();
  await expect.poll(() => page.evaluate(() => !!navigator.serviceWorker.controller)).toBe(true);
  const manifest = await (await page.request.get('/manifest.webmanifest')).json();
  expect(manifest.display).toBe('standalone');
  for (const icon of manifest.icons) expect((await page.request.get(icon.src)).ok()).toBe(true);
  await page.evaluate(async () => { await fetch('/api/cache-probe').catch(() => {}); });
  const urls = await page.evaluate(async () => (await Promise.all((await caches.keys()).map(async key => (await (await caches.open(key)).keys()).map(request => request.url)))).flat());
  expect(urls.length).toBeGreaterThan(3);
  expect(urls.some(url => new URL(url).pathname.startsWith('/api'))).toBe(false);
  expect(urls.some(url => new URL(url).pathname === '/index.html')).toBe(true);
  await context.setOffline(true);
  await page.reload();
  await expect(page.getByRole('heading', { name: 'Welcome Back!' })).toBeVisible();
  const apiUnavailable = await page.evaluate(async () => {
    try { await fetch('/api/auth/me'); return false; } catch { return true; }
  });
  expect(apiUnavailable).toBe(true);
  await context.setOffline(false);
});
