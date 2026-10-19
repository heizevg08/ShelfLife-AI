import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const read = (rel: string) => readFileSync(new URL(`../src/${rel}`, import.meta.url), 'utf8');
const AUDIT = read('components/application/AuditTable.tsx');
const ADMIN = read('services/administration.ts');

const effectBlock = (source: string, startToken: string, endToken: string) => {
  const start = source.indexOf(startToken);
  assert.ok(start > -1, `marker "${startToken}" exists`);
  const end = source.indexOf(endToken, start);
  assert.ok(end > start, `block "${startToken}" has a bounded end`);
  return source.slice(start, end);
};

test('the 15-second polling fallback stays mounted with cleanup', () => {
  assert.match(AUDIT, /const AUTO_REFRESH_MS = 15000;/);
  const poll = effectBlock(AUDIT, 'const interval = window.setInterval(() => setRefresh(value => value + 1), AUTO_REFRESH_MS);', '}, []);');
  assert.match(poll, /window\.clearInterval\(interval\)/);
});

test('the SSE wake-up effect is scoped to the Audit Logs workspace and bumps only the refresh counter', () => {
  const stream = effectBlock(AUDIT, 'if (!adminOverview) return;', '}, [adminOverview]);');
  assert.match(stream, /streamAuditRecorded\(/);
  // The wake-up must re-run the existing query — never reset page, filters or search.
  assert.match(stream, /setRefresh\(value => value \+ 1\)/);
  assert.doesNotMatch(stream, /setPage\(/);
  assert.doesNotMatch(stream, /setSearchTerm\(/);
  assert.doesNotMatch(stream, /setActorFilter\(/);
  assert.doesNotMatch(stream, /setActionFilter\(/);
  assert.doesNotMatch(stream, /setStatusFilter\(/);
  assert.doesNotMatch(stream, /setPeriodFilter\(/);
});

test('SSE pings are debounced so a burst of writes cannot cause duplicate refetches', () => {
  const stream = effectBlock(AUDIT, 'if (!adminOverview) return;', '}, [adminOverview]);');
  assert.match(stream, /if \(pingTimer !== undefined\) return;/);
  assert.match(stream, /pingTimer = window\.setTimeout\(\(\) => \{ pingTimer = undefined; setRefresh\(value => value \+ 1\); \}, 750\);/);
});

test('the stream aborts and clears every timer on unmount and reconnects through a single chain', () => {
  const stream = effectBlock(AUDIT, 'if (!adminOverview) return;', '}, [adminOverview]);');
  assert.match(stream, /currentAbort\?\.abort\(\)/);
  assert.match(stream, /if \(retryTimer !== undefined\) window\.clearTimeout\(retryTimer\);/);
  assert.match(stream, /if \(pingTimer !== undefined\) window\.clearTimeout\(pingTimer\);/);
  // One connect() call starts one chain; the only follow-up is the guarded retry in finally,
  // so a reconnect can never stack a second listener beside a live stream.
  assert.equal((stream.match(/connect\(\);/g) || []).length, 1);
  assert.match(stream, /if \(disposed \|\| abort\.signal\.aborted\) return;/);
  assert.match(stream, /retryTimer = window\.setTimeout\(connect, retryDelay\);/);
  assert.match(stream, /retryDelay = Math\.min\(retryDelay \* 2, 30000\);/);
  assert.match(stream, /retryDelay = 1000;/);
});

test('streamAuditRecorded authenticates with the bearer header and ignores heartbeat comments', () => {
  assert.match(ADMIN, /export async function streamAuditRecorded\(/);
  assert.match(ADMIN, /Authorization: `Bearer \$\{getAccessToken\(\)\}`/);
  assert.match(ADMIN, /await currentUser\(\);/);
  assert.match(ADMIN, /if \(line\.startsWith\('data:'\)\) onRecorded\(\);/);
});

test('the existing fetch effect still re-queries with every filter, page and refresh dependency', () => {
  const fetch = effectBlock(AUDIT, 'listAuditRecords(page, recent ? 5 : pageSize', '}, [page, pageSize, refresh,');
  assert.ok(fetch.length > 0);
  assert.match(AUDIT, /\}, \[page, pageSize, refresh, recent, actorFilter, actionFilter, periodFilter, specificFrom, specificTo, statusFilter, searchTerm\]\);/);
});

test('authentication audit actions render naturally and remain filterable through the typed contract', () => {
  assert.match(AUDIT, /LOGIN: 'Signed in', LOGOUT: 'Signed out'/);
  assert.match(ADMIN, /'EXPORT' \| 'LOGIN' \| 'LOGOUT'/);
});
