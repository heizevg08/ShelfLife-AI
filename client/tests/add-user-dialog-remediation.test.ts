import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const accounts = readFileSync(new URL('../src/components/application/AccountsTable.tsx', import.meta.url), 'utf8');
const styles = readFileSync(new URL('../src/styles/application.css', import.meta.url), 'utf8');

test('Add User validation stays hidden until blur or submit and resets for each session', () => {
  assert.match(accounts, /const \[submitted, setSubmitted\] = useState\(false\)/);
  assert.match(accounts, /setMode\('create'\); setAssignedRole\('Admin'\); setFields\(blank\); setErrors\(\{\}\); setTouched\(\{\}\); setSubmitted\(false\)/);
  assert.match(accounts, /onBlur=\{\(\) => \{\s+setTouched/);
  assert.match(accounts, /data-initial-focus=\{key === 'firstName' \? true : undefined\}/);
  assert.match(accounts, /if \(submitted \|\| touched\[key\]\)\s*\{?\s*setErrors/);
  assert.doesNotMatch(accounts, /onChange=\{[^}]*setTouched\(previous => \(\{ \.\.\.previous, \[key\]: true \}\)\)/);
  assert.match(accounts, /setSubmitted\(true\);[\s\S]*?setErrors\(\{ \.\.\.next, form:/);
  assert.match(accounts, /\(submitted \|\| touched\[key\]\) && errors\[key\]/);
  assert.match(accounts, /setTouched\(previous => \(\{ \.\.\.previous, \.\.\.Object\.fromEntries\(Object\.keys\(details\)/);
  assert.match(accounts, /setFields\(blank\);[\s\S]*?setErrors\(\{\}\);[\s\S]*?setTouched\(\{\}\);[\s\S]*?setSubmitted\(false\)/);
});

test('Add User header and footer remain fixed while only its body scrolls', () => {
  assert.match(accounts, /actions=\{<div className="sl-dialog-form-actions">/);
  assert.match(accounts, /type="submit" form="sl-account-form"/);
  assert.match(accounts, /<form id="sl-account-form"/);
  const form = accounts.match(/<form id="sl-account-form"[\s\S]*?<\/form>/)?.[0] ?? '';
  assert.doesNotMatch(form, /<div className="sl-dialog-form-actions">/);
  assert.match(styles, /\.sl-area-dialog\.sl-add-user-dialog:has\(\.sl-account-form\)\[open\] \{[\s\S]*?max-height:calc\(100dvh - 32px\);[\s\S]*?overflow:hidden;[\s\S]*?display:flex;/);
  assert.match(styles, /> \.sl-dialog-content \{[\s\S]*?min-height:0;[\s\S]*?overflow-y:auto;/);
  assert.match(styles, /> :is\(\.sl-popover-header,\.sl-dialog-actions\) \{[\s\S]*?flex:0 0 auto;/);
});

test('Add User form body keeps 24px clearance above the footer at every scroll position', () => {
  // The account dialog must outrank the shared `.sl-add-user-dialog > .sl-dialog-content`
  // rule, which pins the body's bottom padding to 0 for every other dialog reusing
  // that class. Otherwise the final role option and the form-level validation message
  // sit flush against the footer divider.
  const accountBody = styles.match(/\.sl-area-dialog\.sl-add-user-dialog:has\(\.sl-account-form\)\[open\] > \.sl-dialog-content \{[^}]*\}/)?.[0] ?? '';
  assert.ok(accountBody, 'the account dialog owns its scrollable body rule');
  assert.match(accountBody, /padding:24px!important;/);
  assert.match(accountBody, /flex:1 1 auto;/);
  assert.match(accountBody, /min-height:0;/);
  assert.match(accountBody, /overflow-y:auto;/);
  assert.doesNotMatch(accountBody, /padding:24px 24px 0/);
  // The shared rule still carries the zero bottom padding used by the other
  // `.sl-add-user-dialog` consumers; only the account form dialog overrides it.
  assert.match(styles, /\.sl-add-user-dialog>\.sl-dialog-content \{\n  padding: 24px 24px 0!important;\n\}/);
});

test('Super Admin role options and server submission paths remain unchanged', () => {
  assert.match(accounts, /superAdmin \? \['Admin', 'Manager', 'Inventory Staff'\]/);
  assert.match(accounts, /if \(mode === 'create'\) await createAccount\(\{ \.\.\.input, password: fields\.password \}\)/);
  assert.match(accounts, /error instanceof ApiError/);
});
