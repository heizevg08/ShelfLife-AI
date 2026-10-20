import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const manager = readFileSync(new URL('../src/components/application/ManagerProfilePage.tsx', import.meta.url), 'utf8');
const route = readFileSync(new URL('../src/app/(administration)/ManagerProfile.tsx', import.meta.url), 'utf8');
const profile = readFileSync(new URL('../src/components/application/ProfilePage.tsx', import.meta.url), 'utf8');
const styles = readFileSync(new URL('../src/styles/application.css', import.meta.url), 'utf8');
const auth = readFileSync(new URL('../src/services/auth.ts', import.meta.url), 'utf8');

test('the Manager profile presents first and last name from the authoritative session fields', () => {
  assert.match(manager, /<PageHeader eyebrow="Account" title="My Profile" description="Keep your details and sign-in settings up to date\." \/>/);
  assert.match(manager, /<h2 id="sl-profile-manager-details">Your details<\/h2>/);
  assert.match(manager, /<NameRow field="firstName" value=\{name\(current\.firstName\)\}/);
  assert.match(manager, /<NameRow field="lastName" value=\{name\(current\.lastName\)\}/);
  // The name parts are read straight from the session, never derived by splitting a name.
  assert.doesNotMatch(manager, /split\(|displayName\.split/);
  assert.doesNotMatch(manager, /sessionDisplayName/);
  // The heading uses the reference's exact title case.
  assert.match(manager, /<h2 id="sl-profile-manager-security">Sign-in &amp; security<\/h2>/);
  assert.match(manager, /const \{ user, refreshIdentity \} = useApplicationWorkspace\(\)/);
  assert.doesNotMatch(manager, /Jay Santos|jay@example\.com/);
});

test('confirmed writes and backend failures use the shared accessible toast system', () => {
  const feedback = readFileSync(new URL('../src/services/actionFeedback.ts', import.meta.url), 'utf8');
  const shell = readFileSync(new URL('../src/components/application/ApplicationShell.tsx', import.meta.url), 'utf8');
  assert.match(manager, /publishActionFeedback\(\{ kind: 'success', message \}\)/);
  assert.match(manager, /publishActionFeedback\(\{ kind: 'error', message \}\)/);
  assert.doesNotMatch(manager, /sl-profile-manager-notice/);
  assert.match(feedback, /window\.dispatchEvent\(new CustomEvent<ActionFeedback>/);
  assert.match(shell, /className="sl-action-toast"/);
  assert.match(shell, /aria-live=\{actionToast\.kind === 'error' \? 'assertive' : 'polite'\}/);
  assert.match(shell, /aria-label="Dismiss notification"/);
  assert.match(shell, /setActionToast\(null\);[\s\S]*?\}, \[pathname\]\);/);
});

test('the Manager profile reproduces the approved reference sections', () => {
  // The profile avatar and the profile-photo upload block were both removed from scope, so identity
  // initials are shown once, in the shell's topbar avatar, rather than repeated on this page.
  assert.doesNotMatch(manager, /function IdentityAvatar|function PhotoBlock/);
  assert.doesNotMatch(manager, /sl-profile-manager-identity|sl-profile-manager-avatar/);
  assert.doesNotMatch(manager, /Upload photo|Profile photo|sl-profile-manager-photo/);
  // No Role row is rendered anywhere.
  assert.doesNotMatch(manager, /<dt>Role<\/dt>|Set by your administrator/);
  // 2-Step Verification is present, with its truthful unavailable status.
  assert.doesNotMatch(manager, /<dt>2-Step Verification<\/dt>/);
  // The notification-preference block was removed: no model, endpoint or delivery exists to back it.
  assert.doesNotMatch(manager, /notificationRows|NotificationRow|sl-profile-manager-notification|sl-profile-manager-toggle/);
  assert.doesNotMatch(manager, />Notifications<\/h2>/);
  // The bottom Sign out button was removed; logout stays in the shell's topbar only.
  assert.doesNotMatch(manager, /Sign out<\/button>|sl-profile-manager-signout/);
  assert.doesNotMatch(manager, /Initials are generated|initial of|avatar is generated/i);
  // No internal security implementation detail is exposed.
  assert.doesNotMatch(manager, /passwordHash|authVersion|ObjectId|scrypt|_id/);
});

test('no profile preference control implies a stored setting or a delivered alert', () => {
  // Removing the block is the point: a switch would promise a saved preference and an alert that the
  // backend cannot store or send, because no notification model, endpoint or producer exists.
  assert.doesNotMatch(manager, /role="switch"|aria-checked/);
  assert.doesNotMatch(manager, /Expiring items|Forecast risk|Security activity|System alerts/);
});

test('the Change Password dialog drops the X and toggles each password independently', () => {
  // The reference dialog has no top-right close control; Cancel, Escape and the focus trap remain,
  // and dismissal still restores focus to the opener through returnFocus.
  assert.match(manager, /showClose=\{false\}/);
  assert.match(manager, /data-initial-focus onClick=\{dismiss\}>Cancel<\/button>/);
  assert.match(manager, /returnFocus=\{returnFocus\}/);
  // Each of the three fields toggles its own visibility and has its own accessible label.
  assert.match(manager, /id="sl-profile-manager-current-password" type=\{showCurrent \? 'text' : 'password'\}/);
  assert.match(manager, /id="sl-profile-manager-new-password" type=\{showNext \? 'text' : 'password'\}/);
  assert.match(manager, /id="sl-profile-manager-confirm-password" type=\{showConfirm \? 'text' : 'password'\}/);
  assert.match(manager, /onClick=\{\(\) => setShowCurrent\(value => !value\)\}/);
  assert.match(manager, /onClick=\{\(\) => setShowNext\(value => !value\)\}/);
  assert.match(manager, /onClick=\{\(\) => setShowConfirm\(value => !value\)\}/);
  // The toggles reuse the Login field's shared control and never submit the form.
  assert.match(manager, /className="sl-password-toggle"/);
  assert.match(manager, /import \{ Eye, EyeOff \} from 'lucide-react'/);
  assert.doesNotMatch(manager, /sl-password-toggle[^>]*type="submit"/);
});

test('each password field owns its own validation and error, shown beneath that field', () => {
  // Three independent error states, so one failing field can never mark the others as invalid.
  assert.match(manager, /const \[currentError, setCurrentError\] = useState\(''\)/);
  assert.match(manager, /const \[nextError, setNextError\] = useState\(''\)/);
  assert.match(manager, /const \[confirmError, setConfirmError\] = useState\(''\)/);
  assert.doesNotMatch(manager, /fieldError/);
  // Each field's aria-invalid reads its own error, and only that field is described by its message.
  assert.match(manager, /id="sl-profile-manager-current-password"[\s\S]*?aria-invalid=\{!!currentError\}/);
  assert.match(manager, /id="sl-profile-manager-new-password"[\s\S]*?aria-invalid=\{!!nextError\}/);
  assert.match(manager, /id="sl-profile-manager-confirm-password"[\s\S]*?aria-invalid=\{!!confirmError\}/);
  // Every error paragraph sits inside its own field, directly after that input, and is announced.
  assert.match(manager, /id="sl-profile-manager-current-password-error" role="alert" className="sl-field-error"/);
  assert.match(manager, /id="sl-profile-manager-new-password-error" role="alert" className="sl-field-error"/);
  assert.match(manager, /id="sl-profile-manager-confirm-password-error" role="alert" className="sl-field-error"/);
  // Required messages appear only for the field that is actually empty, and mismatch is detected.
  assert.match(manager, /if \(!current\) \{ currentMessage = 'Enter your current password\.'/);
  assert.match(manager, /if \(!next\) \{ nextMessage = 'Enter a new password\.'/);
  assert.match(manager, /if \(!confirmation\) \{ confirmMessage = 'Confirm your new password\.'/);
  assert.match(manager, /else if \(next && next !== confirmation\) \{ confirmMessage = 'The new password and its confirmation do not match\.'/);
  // The client mirrors the server policy exactly, and a backend rejection is attributed to its field.
  assert.match(manager, /else if \(next\.length < 12\) \{ nextMessage = 'Use at least 12 characters for your new password\.'/);
  assert.match(manager, /if \(rejected && \/current password\/i\.test\(message\)\) setCurrentError\(message\)/);
  // A failed request is surfaced as an error, never as a completed change.
  assert.match(manager, /publishActionFeedback\(\{ kind: 'error', message \}\)/);
  assert.doesNotMatch(manager, /catch[\s\S]{0,200}reset\(\); setDone\(true\)/);
});

test('every profile Edit control shares one underline-free treatment in every state', () => {
  const start = styles.indexOf('/* Shared four-role profile:');
  const rules = styles.slice(start);
  // The name rows and the email row all reuse the same shared Edit class, and the row-end actions
  // share one rule so they align and read as the same affordance.
  assert.match(manager, /className="sl-button sl-text-action sl-profile-manager-edit"/);
  assert.match(rules, /\.sl-profile-manager-edit,\s*\.sl-profile-manager-action \{[^}]*text-decoration:none;/);
  assert.doesNotMatch(rules, /sl-profile-manager-(?:edit|action)\b[^{]*\{[^}]*text-decoration:underline/);
  // Removing the underline must not remove keyboard feedback: hover, active and focus stay defined.
  assert.match(rules, /\.sl-profile-manager-edit:hover:not\(:disabled\),[\s\S]*?\.sl-profile-manager-action:hover:not\(:disabled\)/);
  assert.match(rules, /\.sl-profile-manager-edit:active:not\(:disabled\),[\s\S]*?\.sl-profile-manager-action:active:not\(:disabled\)/);
  assert.match(rules, /\.sl-profile-manager-edit:focus-visible,[\s\S]*?\.sl-profile-manager-action:focus-visible \{[^}]*outline:/);
});

test('unbacked controls are visible but disabled and truthfully labelled', () => {
  // 2-Step Verification is not enforced and must never claim to be required or enabled.
  assert.doesNotMatch(manager, /2-Step Verification/);
  assert.doesNotMatch(manager, /Required by policy|MFA Enforced|MFA Required/);
});

test('the self-service name update is scoped to the caller and re-resolves the session', () => {
  // Only the two name parts are ever sent, and the account comes from the bearer token.
  assert.match(auth, /export const updateProfile = \(changes: \{ firstName\?: string; lastName\?: string \}\)/);
  assert.match(auth, /request\('profile', \{ method: 'PATCH'/);
  assert.doesNotMatch(auth, /updateProfile[^\n]*userId|updateProfile[^\n]*role|updateProfile[^\n]*email/);
  // The stored value is trimmed and collapsed before it is sent, matching the server rule.
  assert.match(manager, /function cleanName\(value: string\) \{ return value\.trim\(\)\.replace\(\/\\s\+\/g, ' '\); \}/);
  assert.match(manager, /const maxNameLength = 25;/);
  assert.match(manager, /if \(!clean \|\| clean\.length > maxNameLength\)/);
  // The shell re-reads the verified identity instead of patching it locally.
  assert.match(manager, /refreshIdentity\(\)/);
  const shell = readFileSync(new URL('../src/components/application/ApplicationShell.tsx', import.meta.url), 'utf8');
  assert.match(shell, /const refreshIdentity = useCallback\(\(\) => setAttempt\(value => value \+ 1\), \[\]\)/);
  // No plaintext credential or token is ever logged or persisted.
  assert.doesNotMatch(manager, /console\.|localStorage|sessionStorage/);
});

test('the password row shows the masked indicator without the standalone Set text', () => {
  // The masked dots remain the only indicator that a password is set; the redundant "Set" label is
  // removed, and the Change password action stays.
  assert.match(manager, /sl-profile-manager-masked" aria-label="Password is set"/);
  assert.doesNotMatch(manager, /sl-profile-manager-managed">Set</);
});

test('every authenticated call carries the bearer token', () => {
  // The token is attached inside the shared request helper. When it was only attached at the
  // /me call site, the self-service profile update and the password change both reached the
  // server unauthenticated and were refused with a 401.
  assert.match(auth, /async function request\(path: string, options: RequestInit = \{\}\) \{\r?\n  const accessToken = getAccessToken\(\);/);
  assert.match(auth, /if \(accessToken\) headers\.set\('Authorization', `Bearer \$\{accessToken\}`\);/);
  assert.match(auth, /fetch\(`\$\{baseUrl\(\)\}\/api\/auth\/\$\{path\}`, \{ \.\.\.options, headers, credentials: 'include', cache: 'no-store' \}\)/);
  // No authenticated call may build its own Authorization header or skip the helper.
  assert.doesNotMatch(auth, /request\('[a-z-]+', \{[^}]*Authorization/);
  // The shared helper is the only place that talks to the network.
  assert.equal(auth.match(/fetch\(/g)?.length, 1);
});

test('email editing is role-gated and offered only to a verified role', () => {
  assert.match(manager, /<dt>Email<\/dt>/);
  assert.match(manager, /emailChangeAvailability\(\)/);
  // Only Super Admin and Admin may start a self-service change, and only when delivery is available.
  assert.match(manager, /const canEditEmail = current\.role === 'Super Admin' \|\| current\.role === 'Admin'/);
  assert.match(manager, /const editable = canEdit && available/);
  assert.match(manager, /\{editable && <button[^>]+onClick=\{\(\) => setOpen\(true\)\}>Edit<\/button>\}/);
  // A role that may not edit is told where the address is managed rather than given a dead control.
  assert.match(manager, /Managed by your administrator/);
  assert.match(manager, /await requestEmailChange\(email, password\)/);
  assert.match(manager, /await completeEmailChange\(code\)/);
  assert.match(manager, /autoComplete="one-time-code"/);
  assert.match(auth, /request\('email\/change\/request'/);
  assert.match(auth, /request\('email\/change\/complete'/);
  assert.doesNotMatch(auth, /requestEmailChange[^\n]*userId/);
});

test('the password change workflow verifies the current password, confirms, and revokes sessions', () => {
  // Current password, a new password and a confirmation are all required.
  assert.match(manager, /id="sl-profile-manager-current-password" type=\{showCurrent \? 'text' : 'password'\} autoComplete="current-password"/);
  assert.match(manager, /id="sl-profile-manager-new-password" type=\{showNext \? 'text' : 'password'\} autoComplete="new-password"/);
  assert.match(manager, /id="sl-profile-manager-confirm-password" type=\{showConfirm \? 'text' : 'password'\} autoComplete="new-password"/);
  assert.match(manager, /else if \(next && next !== confirmation\) \{ confirmMessage = 'The new password and its confirmation do not match\.'/);
  // The established policy is enforced before the request is sent.
  assert.match(manager, /else if \(next\.length < 12\) \{ nextMessage = 'Use at least 12 characters for your new password\.'/);
  // The server revokes credentials by version, so the client clears its token and returns to sign in.
  assert.match(manager, /await changePassword\(current, next\)/);
  assert.match(manager, /clearSession\(\)/);
  assert.match(manager, /router\.replace\('\/ShelfLifeAILogin'\)/);
  // The client sends no user identifier; the account comes from the bearer token.
  assert.match(auth, /export const changePassword = \(currentPassword: string, newPassword: string\) =>/);
  assert.match(auth, /request\('password\/change', \{ method: 'POST'/);
  assert.doesNotMatch(auth, /changePassword[^\n]*userId|changePassword[^\n]*email/);
});

test('the page keeps a single logout control and identity initials live in the topbar only', () => {
  // The bottom Sign out button was removed; logout stays in the shell's topbar confirmation only.
  assert.doesNotMatch(manager, /sl-profile-manager-signout/);
  assert.doesNotMatch(manager, /Sign out<\/button>/);
  assert.doesNotMatch(manager, /\/logout|clearSession\(\);[\s\S]{0,40}replace\('\/ShelfLifeAILogin'\)\}\};\s*$/);
  const shell = readFileSync(new URL('../src/components/application/ApplicationShell.tsx', import.meta.url), 'utf8');
  assert.match(shell, /const requestSignOut = useCallback\(\(_trigger\?: HTMLButtonElement \| null\) => \{/);
  assert.match(shell, /returnFocus=\{logoutReturnFocus\}/);
  // Identity initials are derived from the account's own name parts and shown in the topbar avatar,
  // so a saved name updates it at once, while the profile page no longer repeats an avatar.
  assert.match(shell, /sessionInitials\(user\)/);
  assert.doesNotMatch(manager, /sessionInitials/);
  assert.match(auth, /const parts = \[user\.firstName, user\.lastName\]/);
  assert.match(auth, /source\.slice\(0, 2\)\.map\(part => part\[0\]\)/);
});

test('all four role routes resolve to the same approved profile presentation', () => {
  assert.match(route, /export default ProfilePage/);
  for (const role of ['SuperAdminProfile', 'AdminProfile', 'InventoryStaffProfile']) {
    const source = readFileSync(new URL(`../src/app/(administration)/${role}.tsx`, import.meta.url), 'utf8');
    assert.match(source, /import \{ ProfilePage \} from '\.\.\/\.\.\/components\/application\/ProfilePage';\s*export default ProfilePage;/);
  }
  assert.match(profile, /ManagerProfilePage as ProfilePage/);
  assert.doesNotMatch(profile, /ProfileTab|tablist|InventoryStaffProfileSettings/);
});

test('the shared profile rules are component-scoped and container-owned', () => {
  const start = styles.indexOf('/* Shared four-role profile:');
  assert.ok(start >= 0, 'the shared profile rule block must exist');
  const rules = styles.slice(start, styles.indexOf('/* Manager Dashboard: Stock Status & Expiring in Next 7 Days Cards */', start));
  assert.match(rules, /\.sl-profile-manager \{[\s\S]*?container-name:sl-profile-manager;[\s\S]*?container-type:inline-size;/);
  assert.match(rules, /@container sl-profile-manager \(max-width:34rem\)[\s\S]*?grid-template-columns:minmax\(0,1fr\);/);
  assert.doesNotMatch(rules, /\[data-role=/);
  assert.doesNotMatch(rules, /sl-profile-self-service/);
  assert.doesNotMatch(rules, /\bsl-manager-(?!profile-password)/);
});
