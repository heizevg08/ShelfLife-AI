const { test } = require('node:test');
const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const { join } = require('node:path');

test('operational route declarations exclude Super Admin except three read-only dashboard GETs', () => {
  const routes = ['ingredient', 'inventory-batch', 'usage-record', 'waste-record', 'change-request'];
  // Super Admin's Ingredient Overview / Inventory Overview dashboard cards read exactly these routes.
  const readOnlyGrants = new Set([
    "router.get('/categories'",
    "router.get('/', authorizeAdministration(['Super Admin', 'Admin', 'Manager'])",
    "router.get('/summary', authorizeAdministration(['Super Admin', 'Admin', 'Manager'])",
    "router.get('/summary', authorizeAdministration(['Super Admin', 'Admin', 'Manager', 'Inventory Staff'])",
  ]);
  const granted = [];
  for (const name of routes) {
    const source = readFileSync(join(__dirname, `../src/routes/${name}.routes.ts`), 'utf8');
    for (const line of source.split(/\r?\n/).filter(value => /authorizeAdministration\(\[[^\]]*'Super Admin'[^\]]*\]\)/.test(value))) {
      const trimmed = line.trim();
      assert.match(trimmed, /^router\.get\(/, `${name}: Super Admin may never be granted a write route`);
      assert.ok([...readOnlyGrants].some(prefix => trimmed.startsWith(prefix)), `${name}: unexpected Super Admin grant: ${trimmed}`);
      granted.push(`${name}:${trimmed.split(',')[0]}`);
    }
  }
  assert.deepEqual(granted.sort(), ["ingredient:router.get('/'", "ingredient:router.get('/categories'", "ingredient:router.get('/summary'", "inventory-batch:router.get('/summary'"]);
  const inventory = readFileSync(join(__dirname, '../src/routes/inventory-batch.routes.ts'), 'utf8');
  const usage = readFileSync(join(__dirname, '../src/routes/usage-record.routes.ts'), 'utf8');
  const waste = readFileSync(join(__dirname, '../src/routes/waste-record.routes.ts'), 'utf8');
  assert.match(inventory, /authorizeAdministration\(\['Admin', 'Manager', 'Inventory Staff'\]\)/);
  assert.match(usage, /authorizeAdministration\(\['Manager', 'Inventory Staff'\]\)/);
  assert.match(waste, /authorizeAdministration\(\['Manager', 'Inventory Staff'\]\)/);
});
