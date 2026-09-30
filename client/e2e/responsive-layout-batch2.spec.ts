import { expect, test, type Page } from '@playwright/test';

const widths = [700, 704, 720, 900, 1024, 1200, 1440, 1920];

async function mockRecordApi(page: Page) {
  const user = { id: '1'.repeat(24), name: 'Layout Tester', firstName: 'Layout', lastName: 'Tester', email: 'layout@shelflife.com', role: 'Inventory Manager', isActive: true };
  const ingredient = { id: '2'.repeat(24), name: 'Layout test ingredient', category: 'Dairy', unitOfMeasure: 'L', isActive: true, version: 0, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() };
  const batch = { id: '3'.repeat(24), ingredientId: ingredient.id, quantity: '12.000', unit: 'L', unitCost: '45.0000', version: 0 };
  await page.route('**/*', async route => {
    const request = route.request();
    const url = new URL(request.url());
    if (!url.pathname.startsWith('/api/')) return route.continue();
    const cors = { 'Access-Control-Allow-Origin': 'http://localhost:8081', 'Access-Control-Allow-Credentials': 'true', 'Access-Control-Allow-Headers': 'authorization,content-type', 'Access-Control-Allow-Methods': 'GET,POST,PATCH,DELETE,OPTIONS' };
    const json = (body: unknown, status = 200) => route.fulfill({ status, json: body, headers: cors });
    if (request.method() === 'OPTIONS') return route.fulfill({ status: 204, headers: cors });
    if (url.pathname.startsWith('/api/health/')) return json({ status: 'ready' });
    if (url.pathname === '/api/auth/refresh') return json({ accessToken: 'responsive-layout-test-token', user });
    if (url.pathname === '/api/auth/me') return json({ user });
    if (url.pathname === '/api/ingredients') return json({ items: [ingredient], page: 1, limit: 100, total: 1 });
    if (/^\/api\/(usage-records|waste-records)\/eligible-batches\//.test(url.pathname)) return json({ items: [batch], page: 1, limit: 100, total: 1 });
    if (/^\/api\/(usage-records|waste-records)$/.test(url.pathname)) return json({ items: [], page: 1, limit: 25, total: 0 });
    return json({ items: [], page: 1, limit: 25, total: 0 });
  });
}

async function expectUniformGrid(page: Page, path: '/Usage' | '/Waste', width: number, collapsed: boolean) {
  await page.setViewportSize({ width, height: 900 });
  await page.goto(path);
  await page.evaluate(next => localStorage.setItem('shelflifeai.sidebar.collapsed', String(next)), collapsed);
  await page.reload();
  await expect(page.locator('.sl-app')).toHaveAttribute('data-collapsed', String(collapsed));
  await page.locator('.sl-record-form label:nth-of-type(1) select').selectOption('2'.repeat(24));
  await page.locator('.sl-record-form label:nth-of-type(2) select').selectOption('3'.repeat(24));
  const layout = await page.locator('.sl-record-form').evaluate(form => {
    const rect = (element: Element) => { const { x, width } = element.getBoundingClientRect(); return { x, width }; };
    return { columns: getComputedStyle(form).gridTemplateColumns.split(' ').length, form: rect(form), fields: [...form.querySelectorAll(':scope > label')].map(rect), action: rect(form.querySelector(':scope > div')!) };
  });
  const same = (actual: number, expected: number) => expect(Math.abs(actual - expected), `${path} ${width}px collapsed=${collapsed}`).toBeLessThanOrEqual(1);
  for (const field of layout.fields) same(field.width, layout.fields[0].width);
  same(layout.action.width, layout.fields[0].width);
  if (layout.columns === 1) {
    for (const field of layout.fields) same(field.x, layout.form.x);
    same(layout.action.x, layout.form.x);
  } else {
    expect(layout.columns).toBe(2);
    expect(layout.action.width).toBeLessThan(layout.form.width);
  }
}

for (const path of ['/Usage', '/Waste'] as const) {
  for (const collapsed of [false, true]) {
    test(`${path} keeps all RecordPage controls in the same grid mode with sidebar ${collapsed ? 'collapsed' : 'expanded'}`, async ({ page }) => {
      await mockRecordApi(page);
      for (const width of widths) await expectUniformGrid(page, path, width, collapsed);
    });
  }
}

test('Waste Records uses uniform two-column field spans at 1440px', async ({ page }) => {
  await mockRecordApi(page);
  await expectUniformGrid(page, '/Waste', 1440, false);
});
