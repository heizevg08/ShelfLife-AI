const { test } = require('node:test');
const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const { join } = require('node:path');

test('operational route declarations exclude Super Admin while preserving authorized roles', () => {
  const routes = ['ingredient', 'inventory-batch', 'usage-record', 'waste-record', 'change-request'];
  for (const name of routes) {
    const source = readFileSync(join(__dirname, `../src/routes/${name}.routes.ts`), 'utf8');
    assert.doesNotMatch(source, /authorizeAdministration\(\[[^\]]*'Super Admin'[^\]]*\]\)/, name);
  }
  const inventory = readFileSync(join(__dirname, '../src/routes/inventory-batch.routes.ts'), 'utf8');
  const usage = readFileSync(join(__dirname, '../src/routes/usage-record.routes.ts'), 'utf8');
  const waste = readFileSync(join(__dirname, '../src/routes/waste-record.routes.ts'), 'utf8');
  assert.match(inventory, /authorizeAdministration\(\['Admin', 'Manager', 'Inventory Staff'\]\)/);
  assert.match(usage, /authorizeAdministration\(\['Manager', 'Inventory Staff'\]\)/);
  assert.match(waste, /authorizeAdministration\(\['Manager', 'Inventory Staff'\]\)/);
});
