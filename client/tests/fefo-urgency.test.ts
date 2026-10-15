import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { fefoUrgency } from '../src/utils/fefo-urgency';

const today = new Date('2026-10-10T16:30:00.000Z'); // 11 Oct, 00:30 in Manila

test('Manager FEFO urgency uses approved Philippine calendar-day boundaries', () => {
  for (const [expiration, label, tone, days] of [
    ['2026-10-11', 'High', 'critical', 0],
    ['2026-10-14', 'High', 'critical', 3],
    ['2026-10-15', 'Medium', 'attention', 4],
    ['2026-10-18', 'Medium', 'attention', 7],
    ['2026-10-19', 'Low', 'success', 8],
  ] as const) {
    assert.deepEqual(fefoUrgency(`${expiration}T00:00:00.000Z`, today), { label, tone, daysRemaining: days });
  }
  assert.equal(fefoUrgency('2026-10-10T00:00:00.000Z', today), null);
});

test('a today-expiring batch changes urgency only at Philippine midnight', () => {
  const expiration = '2026-10-11T00:00:00.000Z';
  assert.equal(fefoUrgency(expiration, new Date('2026-10-10T15:59:59.999Z'))?.daysRemaining, 1);
  assert.deepEqual(fefoUrgency(expiration, new Date('2026-10-10T16:00:00.000Z')), { label: 'High', tone: 'critical', daysRemaining: 0 });
  assert.equal(fefoUrgency(expiration, new Date('2026-10-11T16:00:00.000Z')), null);
});

test('FEFO urgency does not depend on the host timezone', () => {
  const moduleUrl = new URL('../src/utils/fefo-urgency.ts', import.meta.url).href;
  const clientDir = fileURLToPath(new URL('..', import.meta.url));
  const script = `import(${JSON.stringify(moduleUrl)}).then(m => process.stdout.write(JSON.stringify(['2026-10-11','2026-10-14','2026-10-15','2026-10-18','2026-10-19'].map(x => m.fefoUrgency(x+'T00:00:00.000Z',new Date('2026-10-10T16:30:00.000Z'))))))`;
  const results = ['UTC', 'Asia/Manila', 'America/New_York', 'Pacific/Kiritimati'].map(zone => execFileSync(process.execPath, ['--import', 'tsx', '--eval', script], { cwd: clientDir, env: { ...process.env, TZ: zone }, encoding: 'utf8' }));
  for (const result of results) assert.equal(result, results[0]);
});
