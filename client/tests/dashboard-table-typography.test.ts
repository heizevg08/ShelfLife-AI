import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

test('Inventory Staff My Pending Requests reuses Dashboard table typography without changing the badge', () => {
  const styles = readFileSync(new URL('../src/styles/application.css', import.meta.url), 'utf8');
  const rulesStart = styles.lastIndexOf('/* Keep My Pending Requests aligned to the Dashboard FEFO table typography tokens. */');
  const scopedRules = styles.slice(rulesStart, styles.indexOf('.sl-detail-enabled-row', rulesStart));

  assert.match(scopedRules, /#inventory-staff-my-pending-requests \.sl-change-request-preview-table thead th \{\s*font:var\(--sl-font-label\);/);
  assert.match(scopedRules, /#inventory-staff-my-pending-requests \.sl-change-request-preview-table tbody td:not\(:last-child\) \{\s*font:var\(--sl-font-body\);\s*font-weight:400;/);
  assert.match(scopedRules, /#inventory-staff-my-pending-requests \.sl-change-request-preview-table tbody td:first-child \.sl-record-identifier-link \{\s*font:var\(--sl-font-body\);\s*font-weight:400;/);
  assert.doesNotMatch(scopedRules, /#inventory-staff-my-pending-requests[^\n]*td:last-child/);
  assert.doesNotMatch(scopedRules, /padding|width|height|grid-template|white-space/);
});
