import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const source = readFileSync(new URL('../src/components/application/FilterSelect.tsx', import.meta.url), 'utf8');

test('FilterSelect exposes the shared controlled filter interface', () => {
  for (const property of ['value: string', 'options: FilterSelectOption[]', 'onChange: (value: string) => void', 'ariaLabel: string', 'disabled?: boolean', 'id?: string', 'className?: string', 'title?: string']) {
    assert.ok(source.includes(property), property);
  }
  assert.match(source, /className=\{rootClassName\}/);
  assert.match(source, /title=\{title\}/);
});

test('FilterSelect reconciles dynamic options and skips disabled choices', () => {
  assert.match(source, /useMemo\(\(\) => options\.flatMap/);
  assert.match(source, /\[initialActiveIndex, open\]/);
  assert.match(source, /if \(!option \|\| option\.disabled\) return/);
  assert.match(source, /aria-disabled=\{option\.disabled \|\| undefined\}/);
  assert.match(source, /disabled=\{option\.disabled\}/);
});

test('FilterSelect owns accessible keyboard and dismissal behavior', () => {
  for (const key of ['ArrowDown', 'ArrowUp', 'Home', 'End', 'Enter', 'Escape']) assert.ok(source.includes(`'${key}'`), key);
  assert.match(source, /event\.key === ' '/);
  assert.match(source, /document\.addEventListener\('mousedown', close\)/);
  assert.match(source, /aria-activedescendant=/);
  assert.match(source, /aria-selected=/);
  assert.match(source, /generatedId\.replace/);
});

test('FilterSelect portals its viewport-safe overlay outside clipping ancestors', () => {
  assert.match(source, /createPortal\(/);
  assert.match(source, /root\.current\?\.closest<HTMLElement>\('\.sl-app'\) \?\? document\.body/);
  assert.match(source, /portalHost,/);
  assert.match(source, /getBoundingClientRect\(\)/);
  assert.match(source, /window\.addEventListener\('resize', updatePosition\)/);
  assert.match(source, /window\.addEventListener\('scroll', updatePosition, true\)/);
  assert.match(source, /placement === 'below' \? rect\.bottom \+ MENU_GAP/);
  assert.match(source, /ref=\{menu\}/);
});
