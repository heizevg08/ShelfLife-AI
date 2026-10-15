import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const profile = readFileSync(new URL('../src/components/application/ProfilePage.tsx', import.meta.url), 'utf8');
const styles = readFileSync(new URL('../src/styles/application.css', import.meta.url), 'utf8');

test('Inventory Staff receives the real read-only Profile Settings presentation', () => {
  assert.match(profile, /if \(user\.role === 'Inventory Staff'\) return <InventoryStaffProfileSettings user=\{user\} \/>/);
  assert.match(profile, /<PageHeader eyebrow="Account" title="Profile Settings" description="View your profile information and account access details\." \/>/);
  assert.match(profile, /title="Profile Information" description="View your account identity and contact information\."/);
  assert.match(profile, /<dt>Full Name<\/dt><dd>\{displayName \|\| 'Unavailable'\}<\/dd>/);
  assert.match(profile, /<dt>Email Address<\/dt><dd>\{user\.email \|\| 'Unavailable'\}<\/dd>/);
  assert.match(profile, /Account information is managed by an administrator\./);
  assert.match(profile, /title="Account & Access" description="Review your account status and access information\."/);
  for (const label of ['Role', 'Account Status', 'Last Login', 'Created', 'Last Updated']) assert.ok(profile.includes(`label: '${label}'`), label);
  assert.match(profile, /'No recorded login'/);
  assert.match(profile, /: '—'/);
});

test('unsupported settings remain absent from the Inventory Staff presentation while other roles keep the shared page', () => {
  const staffStart = profile.indexOf('function InventoryStaffProfileSettings');
  const staffEnd = profile.indexOf('export function ProfilePage');
  const staff = profile.slice(staffStart, staffEnd);
  assert.doesNotMatch(staff, /input|textarea|ProfileTab|PendingCapability|PendingPanel|Change Password|Notification Preferences|Appearance|Active Sessions|Two-Factor|phone/i);
  assert.match(profile, /const \[activeTab, setActiveTab\] = useState<ProfileTab>\('profile'\)/);
  assert.match(profile, /<div className="sl-profile-tabs" role="tablist"/);
  assert.match(profile, /<PendingCapability icon=\{<KeyRound \/>\} title="Change Password"/);
});

test('Inventory Staff profile responsiveness is role-scoped and container-owned', () => {
  const profileRulesStart = styles.indexOf('/* Inventory Staff profile is read-only');
  const profileRulesEnd = styles.indexOf('@media (width<=600px)', profileRulesStart);
  const profileRules = styles.slice(profileRulesStart, profileRulesEnd);

  assert.ok(profileRulesStart >= 0 && profileRulesEnd > profileRulesStart);
  assert.match(profileRules, /\.sl-shell\[data-role="Inventory Staff"\] \.sl-inventory-staff-profile-settings \{[\s\S]*?container-name:sl-inventory-staff-profile;[\s\S]*?container-type:inline-size;[\s\S]*?min-width:0;/);
  assert.match(profileRules, /\.sl-inventory-staff-profile-information-grid \{ grid-template-columns:repeat\(2,minmax\(0,1fr\)\); \}/);
  assert.match(profileRules, /\.sl-inventory-staff-profile-access-grid \{ grid-template-columns:repeat\(3,minmax\(0,1fr\)\); \}/);
  assert.match(profileRules, /@container sl-inventory-staff-profile \(max-width:52rem\)[\s\S]*?grid-template-columns:repeat\(2,minmax\(0,1fr\)\);/);
  assert.match(profileRules, /@container sl-inventory-staff-profile \(max-width:36rem\)[\s\S]*?grid-template-columns:minmax\(0,1fr\);/);
  assert.doesNotMatch(profileRules, /@media[^{}]+(?:125|150|resolution)/);
});
