const { test } = require('node:test');
const assert = require('node:assert/strict');
const { presentAuditDetails } = require('../dist/services/audit-presentation');
const { auditWorkbook } = require('../dist/services/audit-workbook');

const present = record => presentAuditDetails({ targetType: 'User', status: 'Success', ...record });

test('authentication and account-lifecycle records read as approved sentences', () => {
  const cases = [
    [{ action: 'LOGIN', module: 'Authentication' }, 'Signed in.'],
    [{ action: 'LOGIN', module: 'Authentication', status: 'Failed' }, 'Sign-in attempt failed.'],
    [{ action: 'LOGOUT', module: 'Authentication' }, 'Signed out.'],
    [{ action: 'LOGOUT', module: 'Authentication', status: 'Failed' }, 'Sign-out did not complete.'],
    [{ action: 'CREATE', targetType: 'User', module: 'User Management', details: '' }, 'User account created.'],
    [{ action: 'UPDATE', targetType: 'User', module: 'User Management' }, 'User account updated.'],
    [{ action: 'DEACTIVATE', targetType: 'User', module: 'User Management' }, 'User account deactivated.'],
    [{ action: 'REACTIVATE', targetType: 'User', module: 'User Management' }, 'User account reactivated.'],
    // Concise self-service wording: the changed part is the whole message.
    [{ action: 'UPDATE', module: 'Account Profile', details: 'Self-service account update: first name, last name' }, 'Updated first name, last name.'],
    [{ action: 'UPDATE', module: 'Account Profile', details: 'Self-service account update: first name' }, 'Updated first name.'],
    [{ action: 'UPDATE', module: 'Account Profile', details: 'Self-service account update: last name' }, 'Updated last name.'],
    [{ action: 'UPDATE', module: 'Account Profile', details: 'Self-service email address changed after ownership verification' }, 'Updated email address.'],
    [{ action: 'UPDATE', module: 'Account Profile' }, 'Updated account information.'],
  ];
  for (const [input, expected] of cases) assert.equal(present(input), expected, JSON.stringify(input));
});

test('inventory workflow records describe the operational outcome', () => {
  const cases = [
    [{ action: 'CREATE', targetType: 'Ingredient', module: 'Ingredients', details: 'Ingredient master-data record created' }, 'Ingredient added to the inventory catalog.'],
    [{ action: 'UPDATE', targetType: 'Ingredient', module: 'Ingredients', details: 'Ingredient master-data record updated' }, 'Ingredient information updated.'],
    [{ action: 'UPDATE', targetType: 'Ingredient', module: 'Ingredients', details: 'Applied approved Minimum Stock Change' }, 'Ingredient updated by an approved change request (Minimum Stock Change).'],
    [{ action: 'DELETE', targetType: 'Ingredient', module: 'Ingredients', details: 'Ingredient master-data record removed' }, 'Ingredient removed from the inventory catalog.'],
    [{ action: 'CREATE', targetType: 'InventoryBatch', module: 'Stock-In', details: 'Inventory batch received through Stock-In' }, 'New ingredient stock received and recorded.'],
    [{ action: 'CREATE', targetType: 'UsageRecord', module: 'Usage Recording', details: 'Inventory usage recorded and batch quantity deducted' }, 'Ingredient usage recorded and available stock reduced.'],
    [{ action: 'CREATE', targetType: 'WasteRecord', module: 'Waste Recording', details: 'Inventory waste recorded and batch quantity deducted using unit-cost' }, 'Ingredient waste recorded and available stock reduced.'],
  ];
  for (const [input, expected] of cases) assert.equal(present(input), expected, JSON.stringify(input));
});

test('change-request records state the actual submission, approval or rejection decision', () => {
  const cases = [
    [{ action: 'CREATE', targetType: 'ChangeRequest', module: 'Change Requests', details: 'Minimum Stock Change submitted' }, 'Submitted an ingredient change request: Minimum Stock Change.'],
    [{ action: 'CREATE', targetType: 'ChangeRequest', module: 'Change Requests' }, 'Submitted an ingredient change request.'],
    [{ action: 'UPDATE', targetType: 'ChangeRequest', module: 'Change Requests', details: 'Approved and applied Unit Cost Change' }, 'Change request approved and applied: Unit Cost Change.'],
    [{ action: 'UPDATE', targetType: 'ChangeRequest', module: 'Change Requests', details: 'Rejected Minimum Stock Change' }, 'Change request rejected: Minimum Stock Change.'],
    [{ action: 'UPDATE', targetType: 'ChangeRequest', module: 'Change Requests', details: 'unrecognized wording' }, 'unrecognized wording.'],
  ];
  for (const [input, expected] of cases) assert.equal(present(input), expected, JSON.stringify(input));
});

test('export records name the readable report and the captured period only', () => {
  const cases = [
    [{ action: 'EXPORT', targetType: 'Audit Records', module: 'Security & Activity', details: 'XLSX export; 12 records' }, 'Exported audit records to XLSX (12 records).'],
    [{ action: 'EXPORT', targetType: 'Audit Records', module: 'Security & Activity' }, 'Exported audit records to XLSX.'],
    [{ action: 'EXPORT', targetType: 'Audit Records', module: 'Security & Activity', status: 'Failed', details: 'XLSX export failed before a file was prepared' }, 'Audit records export failed before a file was prepared.'],
    [{ action: 'EXPORT', targetType: 'Report', module: 'Reports & Analytics', targetName: 'inventory-summary', details: '2026-10-01..2026-10-07; 12 data rows' }, 'Exported Inventory Summary report for 1 Oct 2026 – 7 Oct 2026.'],
    [{ action: 'EXPORT', targetType: 'Report', module: 'Reports', targetName: 'inventory-period-report', details: '2026-10-10..2026-10-10; 5 data rows' }, 'Exported Inventory Period report on 10 Oct 2026.'],
    [{ action: 'EXPORT', targetType: 'Report', module: 'Reports & Analytics', targetName: 'usage-consumption', details: 'snapshot..snapshot; 3 data rows' }, 'Exported Usage & Consumption report.'],
    [{ action: 'EXPORT', targetType: 'Report', module: 'Reports', targetName: 'inventory-period-report', details: 'all-dates..all-dates; 9 data rows' }, 'Exported Inventory Period report.'],
    [{ action: 'EXPORT', targetType: 'Report', module: 'Reports & Analytics', targetName: 'management-workbook', details: '2026-10-01..2026-10-07; inventory-summary 12 data rows' }, 'Exported Management workbook for 1 Oct 2026 – 7 Oct 2026.'],
    [{ action: 'EXPORT', targetType: 'Report', module: 'Reports & Analytics', targetName: 'expiration-waste', status: 'Failed', details: '2026-10-01..2026-10-07; 0 data rows' }, 'Expiration & Waste report export failed.'],
    [{ action: 'EXPORT', targetType: 'Report', module: 'Reports & Analytics', targetName: 'bad-report', details: 'all-dates..all-dates; 1 data row' }, 'Exported bad report.'],
  ];
  for (const [input, expected] of cases) assert.equal(present(input), expected, JSON.stringify(input));
});

test('failed, warning and unknown records stay truthful without success wording', () => {
  const cases = [
    [{ action: 'DEACTIVATE', targetType: 'User', module: 'User Management', status: 'Failed' }, 'The deactivation of the user record did not complete.'],
    [{ action: 'UPDATE', targetType: 'User', module: 'User Management', status: 'Failed', details: 'stored technical note' }, 'The update of the user record did not complete.'],
    [{ action: 'CREATE', targetType: 'User', module: 'User Management', status: 'Warning' }, 'The creation of the user record completed with a warning.'],
    [{ action: 'UPDATE', targetType: 'InventoryBatch', module: 'Unmapped Module', details: '' }, 'Updated inventorybatch record.'],
    [{ action: 'UPDATE', targetType: 'Mystery', module: 'Unmapped Module', details: 'Legacy internal note' }, 'Legacy internal note.'],
  ];
  for (const [input, expected] of cases) assert.equal(present(input), expected, JSON.stringify(input));
});

test('redaction-sensitive detail text is never echoed to a user-facing sentence', () => {
  assert.equal(present({ action: 'CREATE', targetType: 'Mystery', module: 'Unmapped Module', details: 'Write admin@example.com for access' }), 'Created mystery record.');
  assert.equal(present({ action: 'CREATE', targetType: 'Mystery', module: 'Unmapped Module', details: 'token eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9abcdefghij' }), 'Created mystery record.');
  assert.equal(present({ action: 'CREATE', targetType: 'Mystery', module: 'Unmapped Module', details: 'stored [redacted-address] value' }), 'Created mystery record.');
  // Known records compose from whitelisted fields, so their raw details are irrelevant to the sentence.
  assert.equal(present({ action: 'CREATE', targetType: 'Ingredient', module: 'Ingredients', details: 'Ingredient master-data record created; mail admin@example.com' }), 'Ingredient added to the inventory catalog.');
});

test('exported workbook uses the approved columns, the shared Details sentence and Philippine-time dates', async () => {
  const records = [
    { id: 'a'.repeat(24), userId: '1'.repeat(24), actor: { id: '1'.repeat(24), name: '', role: 'Manager' }, action: 'LOGIN', targetType: 'User', module: 'Authentication', status: 'Success', timestamp: '2026-10-16T15:28:47.000Z' },
    { id: 'b'.repeat(24), userId: '2'.repeat(24), actor: { id: '2'.repeat(24), name: '  Test Admin ', role: 'Admin' }, action: 'EXPORT', targetType: 'Audit Records', targetName: 'Audit records XLSX', module: 'Security & Activity', status: 'Success', details: 'XLSX export; 3 records', timestamp: '2026-10-16T07:00:00.000Z' },
    { id: 'c'.repeat(24), userId: '3'.repeat(24), actor: { id: '3'.repeat(24), name: 'Chef One', role: 'Inventory Staff' }, action: 'CREATE', targetType: 'InventoryBatch', module: 'Stock-In', status: 'Success', details: 'Inventory batch received through Stock-In', timestamp: 'not-a-date' },
    { id: 'd'.repeat(24), userId: '4'.repeat(24), actor: { id: '4'.repeat(24), name: 'Old Name', role: 'Manager' }, action: 'EXPORT', targetType: 'Report', targetName: 'inventory-summary', status: 'Success', details: '2026-10-01..2026-10-07; 12 data rows', timestamp: '2026-10-15T01:02:03.000Z' },
  ];
  const buffer = await auditWorkbook(records, new Date('2026-10-16T15:28:47Z'));
  const { Workbook } = (await import('@excel.js/exceljs')).default;
  const opened = new Workbook();
  await opened.xlsx.load(buffer);
  const sheet = opened.getWorksheet('Audit Records');
  assert.equal(sheet.getRow(1).values[1], 'Audit Records');
  assert.equal(sheet.getRow(2).values[2], '2026-10-16 23:28:47');
  assert.deepEqual(sheet.getRow(4).values.slice(1), ['Date & Time', 'User', 'Action', 'Module', 'Details', 'Status']);
  assert.equal(sheet.views[0].state, 'frozen');
  assert.equal(sheet.getColumn(1).numFmt, 'yyyy-mm-dd hh:mm:ss');

  const login = sheet.getRow(5);
  // Excel renders the serial from its UTC components, so a Manila 23:28:47
  // event must be stored shifted by the fixed +8h Philippine offset.
  assert.equal(login.getCell(1).value.getTime(), Date.parse('2026-10-16T23:28:47Z'));
  assert.equal(login.getCell(2).value, 'Unknown account');
  assert.equal(login.getCell(3).value, 'LOGIN');
  assert.equal(login.getCell(4).value, 'Authentication');
  assert.equal(login.getCell(5).value, 'Signed in.');
  assert.equal(login.getCell(6).value, 'Success');

  const exportRow = sheet.getRow(6);
  assert.equal(exportRow.getCell(2).value, 'Test Admin');
  assert.equal(exportRow.getCell(5).value, 'Exported audit records to XLSX (3 records).');

  const stockIn = sheet.getRow(7);
  assert.equal(stockIn.getCell(1).value, 'not-a-date');
  assert.equal(stockIn.getCell(5).value, 'New ingredient stock received and recorded.');

  const legacyReport = sheet.getRow(8);
  assert.equal(legacyReport.getCell(4).value, 'Report');
  assert.equal(legacyReport.getCell(5).value, 'Exported Inventory Summary report for 1 Oct 2026 – 7 Oct 2026.');
});
