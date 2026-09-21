import { test, expect, type Page } from '@playwright/test';
import { canonicalWorkspaceAccess, dashboardPaths, type WorkspaceRole } from '../src/components/application/workspace';

const roles: WorkspaceRole[] = ['Super Admin', 'Admin', 'Inventory Manager', 'Inventory Staff'];
async function mockApi(page: Page, role: WorkspaceRole, loggedIn = true) {
  const writes: { path: string; body: any }[] = [];
  const forbiddenCalls: string[] = [];
  const user = { id: '1'.repeat(24), name: 'Test User', firstName: 'Test', lastName: 'User', email: 'test@shelflife.com', role, isActive: true };
  let accounts: any[] = [];
  await page.route('**/api/**', async route => {
    const request = route.request(), path = new URL(request.url()).pathname;
    const json = (body: unknown, status = 200) => route.fulfill({ status, json: body, headers: { 'Access-Control-Allow-Origin': 'http://localhost:8081', 'Access-Control-Allow-Credentials': 'true' } });
    if (request.method() === 'OPTIONS') return route.fulfill({ status: 204, headers: { 'Access-Control-Allow-Origin': 'http://localhost:8081', 'Access-Control-Allow-Credentials': 'true', 'Access-Control-Allow-Headers': 'authorization,content-type', 'Access-Control-Allow-Methods': 'GET,POST,PATCH,PUT,DELETE' } });
    if (path.startsWith('/api/health/')) return json({ status: path.endsWith('ready') ? 'ready' : 'alive' });
    if (request.method() !== 'GET') writes.push({ path, body: request.postDataJSON() });
    if (path === '/api/auth/login') { loggedIn = true; return json({ accessToken: 'test-token', user }); }
    if (path === '/api/auth/logout') { loggedIn = false; return route.fulfill({ status: 204 }); }
    if (path.endsWith('/password-reset/availability')) return json({ available: true });
    if (path.endsWith('/password-reset/request')) return json({ message: 'If eligible, a reset link has been sent.' });
    if (path.endsWith('/password-reset/complete')) return json({ message: 'Password updated' });
    if (path === '/api/auth/me') return json(loggedIn ? { user } : { error: { message: 'Authentication required' } }, loggedIn ? 200 : 401);
    if (path === '/api/auth/refresh') return json(loggedIn ? { accessToken: 'test-token', user } : { error: { message: 'Authentication required' } }, loggedIn ? 200 : 401);
    const allowed = path.startsWith('/api/ingredients') ? request.method() === 'GET' || role === 'Inventory Manager' || (request.method() === 'POST' && role === 'Inventory Staff')
      : path.startsWith('/api/dashboard') ? role === 'Super Admin'
      : path.startsWith('/api/users') || path.startsWith('/api/audit-records') ? ['Super Admin', 'Admin'].includes(role) : false;
    if (!allowed) { forbiddenCalls.push(path); return json({ error: { message: 'Forbidden' } }, 403); }
    if (path.endsWith('/summary')) return json({ totalUsers: accounts.length, activeUsers: accounts.length, inactiveUsers: 0, roleCounts: {} });
    if (path === '/api/users' && request.method() === 'POST') {
      const body = request.postDataJSON();
      const account = { ...body, id: '2'.repeat(24), name: `${body.firstName} ${body.lastName}`, isActive: true, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() };
      delete account.password; accounts.push(account); return json({ user: account }, 201);
    }
    if (path.startsWith('/api/users/') && !path.endsWith('summary')) {
      if (request.method() === 'PATCH') { Object.assign(accounts[0], request.postDataJSON()); accounts[0].name = `${accounts[0].firstName} ${accounts[0].lastName}`; }
      if (path.endsWith('/deactivate')) accounts[0].isActive = false;
      if (path.endsWith('/reactivate')) accounts[0].isActive = true;
      return json({ user: accounts[0] });
    }
    if (path === '/api/ingredients') return json({ items: [], total: 0, page: 1, limit: 10 });
    return json({ items: path === '/api/users' ? accounts : [], total: path === '/api/users' ? accounts.length : 0, page: 1, pageSize: 10 });
  });
  return { writes, forbiddenCalls };
}

for (const role of roles) {
  test(`${role}: ingredient controls match read/create/update/remove permissions`, async ({ page }) => {
    await mockApi(page, role);
    const ingredient = { id: '3'.repeat(24), name: 'Permission Milk', version: 0, brand: '', description: '', category: 'Dairy', unitOfMeasure: 'L', createdBy: { id: '1'.repeat(24), name: 'Test' }, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() };
    await page.route('**/api/ingredients?*', route => route.fulfill({ json: { items: [ingredient], total: 1, page: 1, limit: 10 } }));
    await page.goto('/Ingredients');
    await expect(page.getByRole('button', { name: 'View Permission Milk', exact: true })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Add Ingredient', exact: true })).toHaveCount(['Inventory Manager', 'Inventory Staff'].includes(role) ? 1 : 0);
    await expect(page.getByRole('button', { name: 'Edit Permission Milk', exact: true })).toHaveCount(role === 'Inventory Manager' ? 1 : 0);
    await expect(page.getByRole('button', { name: 'Archive Permission Milk', exact: true })).toHaveCount(role === 'Inventory Manager' ? 1 : 0);
    await page.getByRole('button', { name: 'View Permission Milk', exact: true }).click();
    await expect(page.locator('dialog[open]').getByRole('button', { name: 'Edit', exact: true })).toHaveCount(role === 'Inventory Manager' ? 1 : 0);
  });

  test(`${role}: all 22 deep links and visible navigation respect permissions`, async ({ page }) => {
    const errors: string[] = [];
    page.on('pageerror', error => errors.push(error.message));
    const api = await mockApi(page, role);
    for (const [path, permitted] of Object.entries(canonicalWorkspaceAccess)) {
      await page.goto(path);
      if ((permitted as readonly string[]).includes(role)) {
        await expect(page.locator('#sl-main')).toBeVisible();
        const links = await page.locator('a[href^="/"]').evaluateAll(nodes => nodes.map(node => node.getAttribute('href')!));
        for (const href of links) {
          const allowed = canonicalWorkspaceAccess[href as keyof typeof canonicalWorkspaceAccess] as readonly string[] | undefined;
          expect(allowed?.includes(role), `${role} sees ${href} at ${path}`).toBe(true);
        }
      } else {
        await expect(page.getByRole('heading', { name: 'This page is restricted' })).toBeVisible();
        await expect(page.locator('#sl-main')).toHaveCount(0);
      }
    }
    expect(api.forbiddenCalls).toEqual([]);
    expect(errors).toEqual([]);
  });

  test(`${role}: login uses the canonical role and logout clears the session`, async ({ page }) => {
    const api = await mockApi(page, role, false);
    await page.goto('/ShelfLifeAILogin');
    await page.getByLabel('Email', { exact: true }).fill('test@shelflife.com');
    await page.getByLabel('Password', { exact: true }).fill('test-password');
    await page.getByRole('checkbox', { name: 'Remember me' }).check();
    await page.getByRole('button', { name: 'Log in', exact: true }).click();
    await expect(page).toHaveURL(dashboardPaths[role]);
    await expect(page.locator('#sl-main')).toBeVisible();
    expect(api.writes.find(write => write.path.endsWith('/login'))?.body.rememberMe).toBe(true);
    await page.getByRole('button', { name: 'Account profile' }).click();
    await page.getByRole('button', { name: 'Log out', exact: true }).click();
    await page.getByRole('dialog').getByRole('button', { name: 'Log out', exact: true }).click();
    await expect(page).toHaveURL('/ShelfLifeAILogin');
    expect(await page.evaluate(() => sessionStorage.getItem('shelflifeai.accessToken'))).toBeNull();
  });
}

test('password recovery and fragment reset links preserve API contracts without retaining the token URL', async ({ page }) => {
  const api = await mockApi(page, 'Admin', false);
  await page.goto('/forgot-password');
  await page.getByRole('dialog').getByLabel('Email', { exact: true }).fill('test@shelflife.com');
  await page.getByRole('button', { name: 'Request recovery' }).click();
  await expect(page.getByText('If eligible, a reset link has been sent.')).toBeVisible();
  const token = 'a'.repeat(64);
  await page.goto(`/ShelfLifeAILogin#reset=${token}`);
  await page.getByLabel('New password', { exact: true }).fill('new-test-password');
  await expect(page).toHaveURL('/ShelfLifeAILogin');
  await page.getByRole('button', { name: 'Reset password', exact: true }).click();
  await expect(page.getByText('Password updated. Close this dialog and log in with your new password.')).toBeVisible();
  expect(api.writes.find(write => write.path.endsWith('/complete'))?.body.token).toBe(token);
});

for (const role of ['Super Admin', 'Admin'] as const) {
  test(`${role}: account creation submits canonical roles from HTML forms`, async ({ page }) => {
    const api = await mockApi(page, role);
    await page.goto('/UserManagement');
    await page.getByRole('button', { name: 'Add User', exact: true }).click();
    const dialog = page.locator('dialog[open]');
    await dialog.getByLabel('First name', { exact: true }).fill('New');
    await dialog.getByLabel('Last name', { exact: true }).fill('Teammate');
    await dialog.getByLabel('Email', { exact: true }).fill('new@shelflife.com');
    await dialog.getByLabel('Temporary Password', { exact: true }).fill('temporary-password');
    await dialog.getByRole('radio', { name: 'Inventory Manager', exact: true }).check();
    await dialog.getByRole('button', { name: 'Create account' }).click();
    await expect(dialog).not.toBeVisible();
    expect(api.writes.find(write => write.path === '/api/users')?.body.role).toBe('Inventory Manager');
    await expect(page.getByText('new@shelflife.com', { exact: true })).toBeVisible();
    await page.getByRole('button', { name: 'View actions for New Teammate' }).click();
    await dialog.getByRole('button', { name: 'Edit account', exact: true }).click();
    await dialog.getByLabel('First name', { exact: true }).fill('Updated');
    await dialog.getByRole('button', { name: 'Save changes' }).click();
    await expect(dialog).not.toBeVisible();
    await page.getByRole('button', { name: 'View actions for Updated Teammate' }).click();
    await dialog.getByRole('button', { name: 'Deactivate account', exact: true }).click();
    await expect(dialog.getByRole('heading', { name: 'Deactivate account?' })).toBeVisible();
    await dialog.getByRole('button', { name: 'Deactivate account', exact: true }).click();
    await expect(dialog).not.toBeVisible();
    await page.getByRole('button', { name: 'View actions for Updated Teammate' }).click();
    await dialog.getByRole('button', { name: 'Reactivate account', exact: true }).click();
    await expect(dialog.getByRole('heading', { name: 'Reactivate account?' })).toBeVisible();
    await dialog.getByRole('button', { name: 'Reactivate account', exact: true }).click();
    await expect(dialog).not.toBeVisible();
    expect(api.writes.some(write => write.path.endsWith('/deactivate'))).toBe(true);
    expect(api.writes.some(write => write.path.endsWith('/reactivate'))).toBe(true);
  });
}

test('mobile login and navigation remain usable', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await mockApi(page, 'Inventory Staff');
  await page.goto('/InventoryStaffDashboard');
  await page.getByRole('button', { name: 'Open navigation menu' }).click();
  await expect(page.getByRole('dialog', { name: 'Inventory Staff navigation' })).toBeVisible();
  await expect(page.getByRole('dialog').getByRole('link', { name: 'Alerts', exact: true })).toHaveCount(0);
  await page.getByRole('dialog').getByRole('link', { name: 'Stock-In', exact: true }).click();
  await expect(page).toHaveURL('/StockIn');
});

test('anonymous deep links redirect to login and lockout has useful feedback', async ({ page }) => {
  await mockApi(page, 'Admin', false);
  await page.goto('/Ingredients');
  await expect(page).toHaveURL('/ShelfLifeAILogin');
  await page.route('**/api/auth/login', route => route.fulfill({ status: 429, json: { error: { message: 'Too many attempts' } } }));
  await page.getByLabel('Email', { exact: true }).fill('test@shelflife.com');
  await page.getByLabel('Password', { exact: true }).fill('wrong-password');
  await page.getByRole('button', { name: 'Log in', exact: true }).click();
  await expect(page.getByRole('alert')).toContainText('Too many failed attempts');
});
