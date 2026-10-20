import { test } from 'node:test';
import assert from 'node:assert/strict';
import { inventoryAlertRecords } from '../src/utils/inventory-alert-records';
import type { InventoryBatch } from '../src/services/inventory-batches';

test('keeps separate batches of the same ingredient and uses each batch status and quantity', () => {
  const ingredient = { id: 'beef', name: 'Beef Shank', category: 'Meat', unitOfMeasure: 'kg' };
  const batch = (id: string, displayStatus: InventoryBatch['displayStatus'], quantity: number, daysLeft: number): InventoryBatch => ({
    id, batchID: `SL-${id}`, ingredient, displayStatus, quantity, daysLeft, unit: 'kg',
    dateReceived: '2026-10-01', expirationDate: '2026-10-25',
    createdAt: '2026-10-01T00:00:00Z', updatedAt: '2026-10-20T00:00:00Z',
    createdBy: { id: 'staff', name: 'Staff' },
  });
  const alerts = inventoryAlertRecords([
    batch('expired', 'Expired', 103, -1),
    batch('near', 'Near Expiry', 0, 5),
    batch('healthy', 'In Stock', 20, 30),
  ]);

  assert.equal(alerts.length, 2);
  assert.deepEqual(alerts.map(alert => alert.id), ['Expired:expired', 'Near Expiry:near']);
  assert.match(alerts[0].details, /103 kg remaining \(SL-expired\)/);
  assert.match(alerts[1].details, /0 kg \(SL-near\)/);
  assert.equal(alerts[0].priority, 'High');
  assert.equal(alerts[1].priority, 'Medium');
});
