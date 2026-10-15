import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { formatHumanReadableText } from '../src/utils/display-text';

test('human-readable values use consistent title-case presentation', () => {
  assert.equal(formatHumanReadableText('egg'), 'Egg');
  assert.equal(formatHumanReadableText('BOMBOCLAT'), 'Bomboclat');
  assert.equal(formatHumanReadableText('cornbeef'), 'Cornbeef');
  assert.equal(formatHumanReadableText('chicken breast'), 'Chicken Breast');
});

test('structured identifiers, units, and narrative fields remain unformatted at call sites', () => {
  const modulePage = readFileSync(new URL('../src/components/application/ModulePage.tsx', import.meta.url), 'utf8');
  const managerRecords = readFileSync(new URL('../src/components/application/ManagerUsageWastePage.tsx', import.meta.url), 'utf8');
  const styles = readFileSync(new URL('../src/styles/application.css', import.meta.url), 'utf8');
  assert.match(modulePage, /\{batch\.batchID\}/);
  assert.match(modulePage, /\{batch\.unit\}/);
  assert.match(modulePage, /\{record\.reason\}/);
  assert.match(managerRecords, /<td>\{record\.notes\}<\/td>/);
  assert.doesNotMatch(managerRecords, /formatHumanReadableText\(record\.notes\)/);
  assert.doesNotMatch(styles, /text-transform:\s*capitalize/);
});
