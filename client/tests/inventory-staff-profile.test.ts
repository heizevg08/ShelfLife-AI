import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const profile = readFileSync(new URL('../src/components/application/ProfilePage.tsx', import.meta.url), 'utf8');
const accountProfile = readFileSync(new URL('../src/components/application/ManagerProfilePage.tsx', import.meta.url), 'utf8');
const styles = readFileSync(new URL('../src/styles/application.css', import.meta.url), 'utf8');

test('Inventory Staff resolves to the shared editable Profile presentation', () => {
  assert.match(profile, /ManagerProfilePage as ProfilePage/);
  assert.match(accountProfile, /<PageHeader eyebrow="Account" title="My Profile"/);
  assert.match(accountProfile, /<NameRow field="firstName"/);
  assert.match(accountProfile, /<NameRow field="lastName"/);
  assert.match(accountProfile, /<EmailRow/);
  assert.match(accountProfile, /Change password/);
});

test('the approved reference sections are present for the shared four-role profile', () => {
  // The profile avatar and the profile-photo upload block were both removed from scope; identity
  // initials are shown once, in the shell's topbar avatar.
  assert.doesNotMatch(accountProfile, /function IdentityAvatar|function PhotoBlock/);
  assert.doesNotMatch(accountProfile, /sl-profile-manager-identity|sl-profile-manager-avatar/);
  assert.doesNotMatch(accountProfile, /Upload photo|Profile photo/);
  assert.match(accountProfile, /<dt>2-Step Verification<\/dt>/);
  // The notification-preference block was removed for every role: no model, endpoint or delivery
  // exists to back a saved preference or an alert.
  assert.doesNotMatch(accountProfile, /notificationRows|NotificationRow|sl-profile-manager-notification|sl-profile-manager-toggle/);
  // The Role row stays absent and the bottom Sign out button was removed.
  assert.doesNotMatch(accountProfile, /<dt>Role<\/dt>/);
  assert.doesNotMatch(accountProfile, /sl-profile-manager-notice/);
  assert.doesNotMatch(accountProfile, /Sign out<\/button>|sl-profile-manager-signout/);
});

test('unsupported backend features are shown disabled rather than faked', () => {
  // Nothing may claim an enforced second factor, and the enrolment action is disabled because no
  // second factor is enforced by the server.
  assert.doesNotMatch(accountProfile, /Required by policy|MFA Enforced|MFA Required/);
  assert.match(accountProfile, /2-Step Verification is not enforced yet/);
  assert.match(accountProfile, /disabled aria-describedby="sl-profile-manager-twostep-note">Set up<\/button>/);
  // No switch exists, so no preference can falsely read as stored.
  assert.doesNotMatch(accountProfile, /role="switch"|aria-checked/);
});

test('the Change Password dialog validates each field independently for every role', () => {
  // The shared component serves all four roles, so a Manager, Super Admin, Admin and Inventory
  // Staff account all get one error per field, placed beneath the field it describes.
  assert.match(accountProfile, /const \[currentError, setCurrentError\] = useState\(''\)/);
  assert.match(accountProfile, /const \[nextError, setNextError\] = useState\(''\)/);
  assert.match(accountProfile, /const \[confirmError, setConfirmError\] = useState\(''\)/);
  assert.match(accountProfile, /id="sl-profile-manager-current-password-error"/);
  assert.match(accountProfile, /id="sl-profile-manager-new-password-error"/);
  assert.match(accountProfile, /id="sl-profile-manager-confirm-password-error"/);
  // The policy the client checks is the same policy the server enforces.
  assert.match(accountProfile, /next\.length < 12/);
  // The redundant standalone "Set" text is gone; the masked indicator remains.
  assert.doesNotMatch(accountProfile, /sl-profile-manager-managed">Set</);
  assert.match(accountProfile, /sl-profile-manager-masked/);
});

test('shared profile responsiveness is component-scoped rather than role-scoped', () => {
  const start = styles.indexOf('/* Shared four-role profile:');
  const rules = styles.slice(start);
  assert.ok(start >= 0);
  assert.match(rules, /\.sl-profile-manager \{[\s\S]*?container-name:sl-profile-manager;/);
  assert.match(rules, /@container sl-profile-manager \(max-width:34rem\)/);
  assert.doesNotMatch(rules, /\[data-role=/);
  // The removed avatar, notification and photo blocks leave no dead styles behind.
  assert.doesNotMatch(rules, /sl-profile-manager-photo|sl-profile-manager-signout|sl-profile-manager-identity|sl-profile-manager-avatar|sl-profile-manager-notification|sl-profile-manager-toggle/);
});
