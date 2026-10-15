import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { formatDateTime, formatTopbarDateTime } from '../src/utils/date-time';

test('topbar uses the Philippine date and clock across midnight', () => {
  assert.equal(formatTopbarDateTime('2026-10-10T15:59:59.000Z'), 'Saturday, 10 Oct 2026, 11:59 PM');
  assert.equal(formatTopbarDateTime('2026-10-10T16:00:00.000Z'), 'Sunday, 11 Oct 2026, 12:00 AM');
  assert.equal(formatTopbarDateTime('2026-10-10T20:35:00.000Z'), 'Sunday, 11 Oct 2026, 4:35 AM');
});

test('topbar spells every weekday in full and preserves date-only calendar inputs', () => {
  assert.equal(formatTopbarDateTime('2026-10-08'), 'Thursday, 8 Oct 2026, 12:00 AM');
  const names = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  for (const [offset, name] of names.entries()) {
    assert.match(formatTopbarDateTime(new Date(Date.UTC(2026, 9, 11 + offset, 4))), new RegExp(`^${name}, `));
  }
  assert.ok(!formatDateTime(new Date(2026, 9, 8, 4, 35)).startsWith('Thursday'));
});

test('topbar result does not depend on browser or host timezone', () => {
  const moduleUrl = new URL('../src/utils/date-time.ts', import.meta.url).href;
  const clientDir = fileURLToPath(new URL('..', import.meta.url));
  const script = `import(${JSON.stringify(moduleUrl)}).then(m => process.stdout.write(JSON.stringify([
    m.formatTopbarDateTime('2026-10-10T15:59:59.000Z'),
    m.formatTopbarDateTime('2026-10-10T16:00:00.000Z'),
    m.formatTopbarDateTime('2026-10-08')
  ])))`;
  for (const zone of ['UTC', 'America/New_York', 'Asia/Tokyo', 'Pacific/Kiritimati', 'Asia/Manila']) {
    const actual = JSON.parse(execFileSync(process.execPath, ['--import', 'tsx', '--eval', script], {
      cwd: clientDir, env: { ...process.env, TZ: zone }, encoding: 'utf8',
    }));
    assert.deepEqual(actual, [
      'Saturday, 10 Oct 2026, 11:59 PM',
      'Sunday, 11 Oct 2026, 12:00 AM',
      'Thursday, 8 Oct 2026, 12:00 AM',
    ]);
  }
});

test('all roles share one central topbar formatter', () => {
  const shell = readFileSync(new URL('../src/components/application/ApplicationShell.tsx', import.meta.url), 'utf8');
  assert.match(shell, /formatTopbarDateTime\(topbarClock\)/);
  assert.match(shell, /dateTime=\{topbarClock\.toISOString\(\)\}/);
  assert.doesNotMatch(shell, /from '..\/..\/utils\/date-time'[^;]*\bformatDateTime\b/);
});
