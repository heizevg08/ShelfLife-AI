import { test, expect, type Page } from '@playwright/test';

const user = {
  id: '1'.repeat(24), name: 'Test User', firstName: 'Test', lastName: 'User',
  email: 'test@shelflife.com', role: 'Inventory Manager', isActive: true,
};
const ingredient = {
  id: '3'.repeat(24), name: 'Browser Milk', brand: 'Fixture', description: 'Fixture ingredient',
  category: 'Dairy', unitOfMeasure: 'L', minimumStock: '1.000', standardUnitCost: '2.5000',
  defaultShelfLifeDays: 7, isActive: true, version: 0, createdBy: { id: user.id, name: user.name },
  createdAt: '2026-10-01T00:00:00.000Z', updatedAt: '2026-10-01T00:00:00.000Z',
};

async function mockRecordApi(page: Page) {
  await page.route('**/api/**', async route => {
    const request = route.request();
    const pathname = new URL(request.url()).pathname;
    const json = (body: unknown) => route.fulfill({ status: 200, json: body });
    if (request.method() === 'OPTIONS') return route.fulfill({ status: 204 });
    if (pathname === '/api/auth/me') return json({ user });
    if (pathname.startsWith('/api/ingredients')) return json({ items: [ingredient], page: 1, limit: 100, total: 1 });
    if (/^\/api\/(usage|waste)-records\/eligible-batches\//.test(pathname)) {
      return json({ items: [{ id: '4'.repeat(24), ingredientId: ingredient.id, quantity: '2.000', unit: 'L', unitCost: '2.5000' }], page: 1, limit: 100, total: 1 });
    }
    if (pathname === '/api/usage-records' || pathname === '/api/waste-records') return json({ items: [], page: 1, limit: 25, total: 0 });
    return json({ items: [], page: 1, limit: 25, total: 0 });
  });
}

for (const [kind, route] of [['Usage', '/Usage'], ['Waste', '/Waste']] as const) {
  test(`${kind} RecordPage keeps controls aligned and contained`, async ({ page }) => {
    await page.addInitScript(nextUser => {
      sessionStorage.setItem('shelflifeai.accessToken', 'fixture');
      sessionStorage.setItem('shelflifeai.user', JSON.stringify(nextUser));
    }, user);
    await mockRecordApi(page);

    for (const width of [1440, 1024, 390]) {
      await page.setViewportSize({ width, height: 1000 });
      await page.goto(route);
      const form = page.locator('.sl-record-form');
      await expect(form).toBeVisible();
      const main = page.locator('#sl-main');
      const controls = form.locator('input, select, textarea');
      const widths = await controls.evaluateAll(elements => elements.map(element => element.getBoundingClientRect().width));
      expect(widths.length).toBe(kind === 'Usage' ? 5 : 6);
      for (const controlWidth of widths) expect(controlWidth).toBeCloseTo(widths[0], 0);

      const insets = await controls.evaluateAll(elements => {
        const mainBounds = document.querySelector('#sl-main')!.getBoundingClientRect();
        return elements.map(element => element.getBoundingClientRect().left - mainBounds.left);
      });
      for (const inset of insets) expect(inset).toBeGreaterThanOrEqual(16);

      const save = form.getByRole('button', { name: 'Save record', exact: true });
      const saveBox = await save.boundingBox();
      const formBox = await form.boundingBox();
      expect(saveBox).not.toBeNull();
      expect(formBox).not.toBeNull();
      expect(saveBox!.height).toBeLessThanOrEqual(48);
      if (width >= 1024) expect(saveBox!.width).toBeLessThanOrEqual(220);
      if (width === 390) expect(await form.evaluate(element => getComputedStyle(element).gridTemplateColumns.split(' ').length)).toBe(1);
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
    }
  });
}
