import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

// Source guard for the shell scroll reset. This test protects the shape the
// behaviour depends on, so an unrelated edit cannot quietly remove the reset or
// make it fire on something other than navigation.
const shell = readFileSync(new URL('../src/components/application/ApplicationShell.tsx', import.meta.url), 'utf8');

test('opening a module resets both scroll containers, on navigation only', () => {
  const effect = shell.match(/useEffect\(\(\) => \{[\s\S]*?\}, \[pathname\]\);/g) ?? [];
  const reset = effect.find(block => block.includes('scrollTo({ top: 0 })'));
  assert.ok(reset, 'the shell must reset scroll in an effect keyed on the pathname');
  // Both containers are reset: the shell owns the scroll on most routes, while the
  // Manager Dashboard deliberately scrolls the document instead.
  assert.match(reset!, /appRef\.current\?\.scrollTo\(\{ top: 0 \}\)/);
  assert.match(reset!, /window\.scrollTo\(\{ top: 0 \}\)/);
  // Keyed on the pathname, so a filter, pagination or dialog change cannot jump the page.
  assert.match(reset!, /\}, \[pathname\]\);\s*$/);
  assert.doesNotMatch(reset!, /behavior: 'smooth'/);
  // The back-to-top affordance is state, not scroll position: it must be cleared too.
  assert.match(reset!, /setShowBackToTop\(false\)/);
});
