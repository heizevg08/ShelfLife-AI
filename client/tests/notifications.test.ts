import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseNotifications } from '../src/components/application/Notifications';

const valid = { id: 'notice-1', title: 'Account updated', message: 'An account changed.', timestamp: '2026-09-16T00:00:00.000Z', read: false };

test('notification storage accepts only complete notification arrays', () => {
  assert.deepEqual(parseNotifications(JSON.stringify([valid])), [valid]);
  for (const value of [null, '', '{', '{}', 'null', JSON.stringify([{ ...valid, read: 'no' }]), JSON.stringify([{ ...valid, timestamp: 'invalid' }])]) {
    assert.deepEqual(parseNotifications(value), []);
  }
});
