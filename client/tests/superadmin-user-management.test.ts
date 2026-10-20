import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const table = readFileSync(new URL('../src/components/application/AccountsTable.tsx', import.meta.url), 'utf8');
const styles = readFileSync(new URL('../src/styles/application.css', import.meta.url), 'utf8');
const store = readFileSync(new URL('../../server/src/services/administration-store.ts', import.meta.url), 'utf8');
const policy = readFileSync(new URL('../../server/src/services/administration.ts', import.meta.url), 'utf8');

test('Super Admin table keeps the compact seven-column order and account timestamps in Details', () => {
  const headStart = table.indexOf('<thead>');
  const headEnd = table.indexOf('</thead>', headStart);
  const head = table.slice(headStart, headEnd);
  assert.match(head, /<th scope="col">#<\/th>[\s\S]*?<th scope="col">Name<\/th>[\s\S]*?<th scope="col">Email<\/th>[\s\S]*?<th scope="col">Role<\/th>[\s\S]*?<th scope="col">Status<\/th>[\s\S]*?<th scope="col">Last Login<\/th>[\s\S]*?<th scope="col">Actions<\/th>/);
  assert.doesNotMatch(head, /Created At/);
  assert.doesNotMatch(table, /formatDate\(account\.createdAt\)/);
  assert.match(table, /<dt>Created<\/dt><dd><time dateTime=\{selected\.createdAt\}>/);
  assert.match(table, /<dt>Last Updated<\/dt><dd><time dateTime=\{selected\.updatedAt\}>/);
  assert.match(table, /account\.lastLoginAt \? <time dateTime=\{account\.lastLoginAt\}>\{formatDateTime\(account\.lastLoginAt\)\}<\/time> : <span[\s\S]*?>—<\/span>/);
  assert.match(table, /title=\{superAdmin \? account\.name : undefined\}/);
  assert.match(table, /title=\{superAdmin \? account\.email : undefined\}/);
});

test('Super Admin account pages request newest successful login first from the server', () => {
  assert.match(table, /useState\(superAdmin \? 'lastLoginAt' : 'createdAt'\)/);
  assert.match(table, /const sortBy = superAdmin \? 'lastLoginAt' : sort;[\s\S]*?const sortOrder = superAdmin \? 'desc'/);
  assert.match(table, /listAccounts\(page, sortBy, sortOrder, abort\.signal, pageSize/);
  assert.match(table, /setDirectorySearch\(event\.target\.value\); setPage\(1\)/);
  assert.match(table, /setRoleFilter\(value\); setPage\(1\)/);
  assert.match(table, /setStatusFilter\(value\); setPage\(1\)/);
});

test('Super Admin account rows reuse the Admin UserManagement role pill styling', () => {
  assert.match(table, /<td><span className="sl-application-role-pill" data-role=\{account\.role\}>\{account\.role\}<\/span><\/td>/);
  assert.doesNotMatch(table, /sl-v56-role-pill/);
  assert.doesNotMatch(styles, /\.sl-superadmin-users-page-v56 \.sl-v56-role-pill/);
  assert.match(styles, /\.sl-application-role-pill \{ white-space: nowrap; \}/);
});

test('Super Admin KPI cards use the authoritative all-account summary, including zero-role counts', () => {
  assert.match(table, /\(superAdmin \? dashboardSummary\(abort\.signal\) : accountSummary\(abort\.signal\)\)/);
  assert.match(table, /<span>Total Users<\/span><strong>\{summary \? totalUsers\.toLocaleString\(\) : '—'\}/);
  assert.match(table, /<span>Admin<\/span><strong>\{summary \? \(summary\.roleCounts\?\.Admin \?\? 0\)\.toLocaleString\(\) : '—'\}[\s\S]*?Admin accounts/);
  assert.match(table, /<span>Managers<\/span><strong>\{summary \? \(summary\.roleCounts\?\.Manager \?\? 0\)\.toLocaleString\(\) : '—'\}[\s\S]*?Manager accounts/);
  assert.match(table, /<span>Inventory Staff<\/span><strong>\{summary \? \(summary\.roleCounts\?\.\['Inventory Staff'\] \?\? 0\)\.toLocaleString\(\) : '—'\}[\s\S]*?Staff accounts/);
  assert.match(store, /totalUsers: totals\?\.totalUsers \?\? 0, activeUsers: totals\?\.activeUsers \?\? 0, inactiveUsers: activeOnly \? 0 : totals\?\.inactiveUsers \?\? 0, roleCounts/);
  assert.match(store, /users\.aggregate\(\[\{ \$match: roleFilter \}, \{ \$group: \{ _id: '\$role', count: \{ \$sum: 1 \} \} \}\]\)/);
  assert.match(policy, /summary: \(actor\?: Actor\) => store\.summary\(actor\?\.role === 'Admin' \? managedRoles\(actor\.role\) : null, actor\?\.role === 'Admin'/);
  assert.match(table, /const totalUsers = summary\?\.totalUsers/);
  const kpiStart = table.indexOf('{superAdmin && <section className="sl-sa-kpis');
  const kpiEnd = table.indexOf('</section>}', kpiStart);
  const superAdminKpis = table.slice(kpiStart, kpiEnd);
  assert.match(superAdminKpis, /className="sl-sa-kpis sl-inventory-staff-kpis sl-admin-user-kpis sl-dashboard-kpis sl-superadmin-kpis sl-user-management-kpis"/);
  assert.equal((superAdminKpis.match(/className="sl-sa-kpi sl-inventory-staff-kpi" data-tone=/g) ?? []).length, 4);
  // Same sequence, tones and icons as the Admin cards: Users (brand), Admin (info), Managers (attention), Inventory Staff (critical).
  assert.deepEqual([...superAdminKpis.matchAll(/data-tone="(\w+)"/g)].map(m => m[1]), ['brand', 'info', 'attention', 'critical']);
  assert.deepEqual([...superAdminKpis.matchAll(/<span>([^<]+)<\/span><strong>/g)].map(m => m[1]), ['Total Users', 'Admin', 'Managers', 'Inventory Staff']);
  assert.doesNotMatch(superAdminKpis, /ShieldCheck|UserX|Deactivated Accounts|Active Accounts|Super Admin Accounts/);
});

test('Super Admin User Accounts table header fills the available table width', () => {
  assert.match(styles, /\.sl-superadmin-users-page-v64 \.sl-superadmin-table-scroll \{ scrollbar-gutter:auto; \}/);
  assert.match(styles, /\.sl-records-table thead th\s*\{\s*background:\s*var\(--sl-surface-subtle\);/);
});

test('Super Admin account filters use the server page contract and supported lifecycle states', () => {
  assert.match(table, /listAccounts\(page,[\s\S]*?\{\s*search: directorySearch\.trim\(\),\s*role:[\s\S]*?status:/);
  assert.match(table, /options=\{\['All Statuses','Active','Deactivated'\]/);
  assert.doesNotMatch(table, /'Idle'|'Suspended'|'Logged Out'/);
  assert.match(table, /setStatusFilter\('All Statuses'\); setPage\(1\)/);
  assert.match(table, /onChange=\{event => \{ setDirectorySearch\(event\.target\.value\); setPage\(1\); \}\}/);
  assert.match(table, /onChange=\{value => \{ setRoleFilter\(value\); setPage\(1\); \}\}/);
  assert.match(table, /onChange=\{value => \{ setStatusFilter\(value\); setPage\(1\); \}\}/);
  assert.match(table, /const visibleAccounts = data\?\.items \?\? \[\]/);
  assert.match(store, /countQuery\.exec\(\)/);
  assert.match(store, /skip\(\(query\.page - 1\) \* query\.pageSize\)\.limit\(query\.pageSize\)/);
  assert.match(store, /const filter = clauses\.length === 0 \? \{\} : clauses\.length === 1 \? clauses\[0\] : \{ \$and: clauses \}/);
});

test('Super Admin can view peer Super Admin accounts but gets no peer mutation controls', () => {
  assert.match(table, /const mayManage = \(account: Account\) => account\.id !== user\.id && \(superAdmin \? \['Admin', 'Manager', 'Inventory Staff'\]/);
  assert.match(table, /aria-label=\{`View \$\{account\.name\}`\}/);
  const guardedActionsStart = table.indexOf('{mayManage(account) && <>');
  const guardedActionsEnd = table.indexOf('</>}', guardedActionsStart);
  assert.ok(guardedActionsStart >= 0 && guardedActionsEnd > guardedActionsStart, 'mutation controls must be wrapped in mayManage');
  const guardedActions = table.slice(guardedActionsStart, guardedActionsEnd);
  assert.doesNotMatch(guardedActions, /Pencil|Trash2|aria-label=\{`Edit \$\{account\.name\}`\}/, 'row actions have no duplicate edit or deletion icon');
  assert.match(guardedActions, /aria-label=\{`\$\{account\.isActive \? 'Deactivate' : 'Reactivate'\} \$\{account\.name\}`\}/);
  assert.match(guardedActions, /account\.isActive \? <UserX size=\{16\} aria-hidden="true" \/> : <UserCheck size=\{16\} aria-hidden="true" \/>/);
  assert.match(guardedActions, /account\.isActive \? ' sl-staff-waste-delete' : ''/);
  assert.match(guardedActions, /color: 'var\(--sl-success\)'/);
  assert.match(guardedActions, /onClick=\{\(\) => open\(account, 'lifecycle'\)\}/);
  const superAdminActionsStart = table.lastIndexOf('{superAdmin ? <>', guardedActionsStart);
  const adminBranchStart = table.indexOf('</> : <>', superAdminActionsStart);
  const superAdminActions = table.slice(superAdminActionsStart, adminBranchStart);
  assert.doesNotMatch(superAdminActions, /Pencil|Trash2|title="Edit"/);
  assert.match(table, /actions=\{selected && mayManage\(selected\) \? <>[\s\S]*?onClick=\{\(\) => void open\(selected, 'edit'\)\}[\s\S]*?Edit account/);
  assert.match(policy, /function assertWrite\(actor: Actor, user: Account\)/);
  assert.match(policy, /if \(actor\.id === user\.id \|\| !managedRoles\(actor\.role\)\.includes\(user\.role\)\) throw forbidden\(\)/);
});
