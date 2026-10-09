import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { formatDateTime, formatTopbarDateTime } from '../src/utils/date-time';

test('topbar timestamp prefixes the shared date with the matching weekday', () => {
  assert.equal(formatTopbarDateTime(new Date(2026, 9, 8, 4, 35)), 'Thu, 8 Oct 2026, 4:35 AM');
  assert.equal(formatTopbarDateTime(new Date(2026, 9, 11, 23, 5)), 'Sun, 11 Oct 2026, 11:05 PM');
  assert.equal(formatTopbarDateTime(new Date(2026, 9, 8, 0, 5)), 'Thu, 8 Oct 2026, 12:05 AM');
});

test('topbar weekday always agrees with its calendar date at day boundaries', () => {
  assert.equal(formatTopbarDateTime('2026-10-08'), 'Thu, 8 Oct 2026, 12:00 AM');
  assert.ok(!formatDateTime(new Date(2026, 9, 8, 4, 35)).startsWith('Thu'));
});

test('all roles share one central topbar formatter', () => {
  const shell = readFileSync(new URL('../src/components/application/ApplicationShell.tsx', import.meta.url), 'utf8');
  assert.match(shell, /formatTopbarDateTime\(topbarClock\)/);
  assert.doesNotMatch(shell, /from '..\/..\/utils\/date-time'[^;]*\bformatDateTime\b/);
});
