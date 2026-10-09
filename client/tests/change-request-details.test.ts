import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import type { ChangeRequest } from '../src/services/change-requests';
import { changeRequestComparison, formatChangeRequestComparisonParts } from '../src/utils/change-request-format';
import { formatStaffChangeRequestValue } from '../src/utils/change-request-format';

const request = (overrides: Partial<ChangeRequest> = {}): ChangeRequest => ({
  id: 'request-id',
  requestID: 'REQ-20261002-001',
  requestType: 'MINIMUM_STOCK_CHANGE',
  targetField: 'minimumStock',
  reason: 'Incorrect min. stock',
  currentValue: '57',
  requestedValue: '80',
  ingredient: { id: 'ingredient-id', name: 'Chicken Breast', unitOfMeasure: 'kg' },
  status: 'PENDING',
  requestedBy: { id: 'staff-id', name: 'Development InventoryStaff' },
  createdAt: '2026-10-02T00:42:00.000Z',
  updatedAt: '2026-10-02T00:42:00.000Z',
  ...overrides,
});

test('Inventory Staff change values use authoritative type-aware formatting', () => {
  const minimumStock = request();
  assert.equal(formatStaffChangeRequestValue(minimumStock, minimumStock.currentValue), '57 kg');
  assert.equal(formatStaffChangeRequestValue(minimumStock, minimumStock.requestedValue), '80 kg');
  const cost = request({ requestType: 'STANDARD_UNIT_COST_CHANGE', targetField: 'standardUnitCost' });
  assert.equal(formatStaffChangeRequestValue(cost, '100'), '₱100.00');
  const shelfLife = request({ requestType: 'DEFAULT_SHELF_LIFE_CHANGE', targetField: 'defaultShelfLifeDays' });
  assert.equal(formatStaffChangeRequestValue(shelfLife, '1'), '1 day');
  assert.equal(formatStaffChangeRequestValue(shelfLife, '30'), '30 days');
});

test('Inventory Staff details are role-specific while Manager presentation remains intact', () => {
  const source = readFileSync(new URL('../src/components/application/ChangeRequestDetailsDialog.tsx', import.meta.url), 'utf8');
  const staffStart = source.indexOf('function InventoryStaffChangeRequestDetails');
  const staffEnd = source.indexOf('export function ChangeRequestDetailsDialog');
  const staff = source.slice(staffStart, staffEnd);
  assert.match(staff, /View your submitted request\./);
  assert.doesNotMatch(staff, /Request Information|Submitted By|Reviewed By/);
  assert.doesNotMatch(staff, /<dt>Request ID|<dt>Submitted|<dt>Ingredient|<dt>Status/);
  assert.match(staff, /formatHumanReadableText\(request\.ingredient\.name\)/);
  assert.match(staff, /request\.requestID/);
  assert.match(staff, /formatDateTime\(request\.createdAt\)/);
  assert.match(staff, /changeRequestStatusLabel\(request\.status\)/);
  assert.match(staff, />Current</);
  assert.match(staff, />Requested</);
  assert.match(staff, /<div><strong>\{current\}<\/strong><span>Current<\/span><\/div>/);
  assert.match(staff, /className="sl-staff-change-request-requested"/);
  assert.match(staff, /<p>\{request\.reason\}<\/p>/);
  assert.doesNotMatch(staff, /Awaiting manager review/);
  assert.match(staff, /request\.status !== 'PENDING' && request\.reviewedAt/);
  assert.match(staff, /formatDateTime\(request\.reviewedAt\)/);
  assert.match(staff, /request\.status !== 'PENDING' && request\.reviewNote\?\.trim\(\)/);
  assert.match(staff, /Manager Note/);
  assert.doesNotMatch(staff, /reviewedBy/);
  assert.doesNotMatch(staff, /Edit|Delete|Approve|Reject/);
  assert.doesNotMatch(staff, /Chicken Breast|₱555|₱67|57 kg|80 kg/);
  assert.match(staff, /className="sl-account-reference-dialog sl-staff-change-request-details-dialog"/);
  assert.doesNotMatch(staff, /inventoryStaffMyRequests|sl-staff-my-requests-change-request-details-dialog/);
  assert.doesNotMatch(staff, /sl-admin-ingredient-dialog|sl-ingredient-view-dialog/);
  const managerSource = source.slice(source.indexOf('export function ChangeRequestDetailsDialog'));
  assert.doesNotMatch(managerSource, /managerRows/);
  assert.match(managerSource, /closeLabel="Close review dialog"/);
  assert.match(managerSource, /showClose\n    className="sl-change-request-review-dialog"/);
  assert.equal((managerSource.match(/>Close</g) ?? []).length, 0);
  assert.match(managerSource, /identityStatus=\{<Status tone=\{statusTone\(request\.status\)\}>/);
  assert.ok(managerSource.indexOf('callout={') < managerSource.indexOf('lead={'));
  assert.match(managerSource, /<h4>Reason for request<\/h4>/);
  assert.match(managerSource, /\{ label: 'Submitted On', value: formatDateTime\(request\.createdAt\) \}/);
  assert.match(managerSource, /request\.status !== 'PENDING' \? \[/);
  assert.match(managerSource, /\{ label: 'Review Notes', value: request\.reviewNote, wide: true \}/);
  assert.doesNotMatch(managerSource, /Approve|Reject|Pencil|Trash|Escalat|Edit|Cancel/);
  assert.match(source, /subtitle="Review the submitted master-data change and decision\."/);
});

test('Manager review dialog dismissal, information order, and pending/historical actions', () => {
  const shared = readFileSync(new URL('../src/components/application/ApplicationDetailsDialog.tsx', import.meta.url), 'utf8');
  const shell = readFileSync(new URL('../src/components/application/Dialog.tsx', import.meta.url), 'utf8');
  const page = readFileSync(new URL('../src/components/application/ManagerChangeRequestsPage.tsx', import.meta.url), 'utf8');
  const styles = readFileSync(new URL('../src/styles/application.css', import.meta.url), 'utf8');
  // One visible, labelled dismissal control; Escape still dismisses and focus
  // returns to the originating Eye button.
  assert.match(shell, /closeLabel = 'Close dialog'/);
  assert.match(shell, /aria-label=\{closeLabel\}/);
  assert.match(shell, /onCancel=\{event => \{ event\.preventDefault\(\); if \(!busy\) onDismiss\(\); \}\}/);
  assert.match(shell, /querySelector<HTMLElement>\('button'\)\)\?\.focus\(\)/);
  assert.match(shell, /if \(opener\?\.isConnected\) opener\.focus\(\)/);
  assert.match(shared, /closeLabel = 'Close dialog'/);
  assert.match(shared, /closeLabel=\{closeLabel\}/);
  assert.match(shared, /actions=\{actions \?\? <button type="button" className="sl-button" onClick=\{onDismiss\}>Close<\/button>\}/);
  assert.match(shared, /closeLabel = 'Close dialog', showClose = false/);
  assert.match(shared, /showClose=\{showClose\}/);
  // Pending keeps only Reject and Approve Request; historical requests render
  // no decision actions and rely on the X.
  assert.match(page, /actions=\{selected\?\.status==='PENDING'\?\(confirming==='reject'/);
  assert.match(page, /Approve Request<\/button><\/>\):undefined\}/);
  // Approval is confirmed inline now, so the page renders no nested modal at all.
  assert.doesNotMatch(page, /<InventoryStaffModal/);
  assert.doesNotMatch(page, /<ApplicationModal/);
  assert.match(page, /reviewForm=\{confirming==='reject'/);
  assert.match(page, /reviewForm=\{confirming==='reject'&&selected\?\.status==='PENDING'\?renderManagerRejectionForm\(/);
  assert.match(page, /type="submit" form="manager-reject-change-request"/);
  assert.match(page, /const field=rejectionField\.current;if\(!field\)return;field\.focus\(\{preventScroll:true\}\);field\.scrollIntoView\(\{block:'nearest'\}\)/);
  assert.match(page, /const reviewed=confirming;setConfirming\(null\);setReviewNote\(''\);setReviewError\(''\);\(reviewed==='approve'\?approveTrigger:rejectTrigger\)\.current\?\.focus\(\)/);
  assert.match(page, /Enter the reason for rejecting this request\./);
  assert.match(page, /rejectChangeRequest\(selected\.id,reviewNote\.trim\(\)\)/);
  assert.match(styles, /\.sl-ingredient-details-identity-row \{ align-items:flex-start; justify-content:space-between; gap:12px; display:flex; \}/);
  assert.match(styles, /\.sl-ingredient-details-information \.sl-staff-change-request-comparison \{ margin:0 0 16px; \}/);
  assert.match(styles, /@media \(width <= 560px\) \{\s*\.sl-ingredient-details-identity-row \{ flex-direction:column; align-items:flex-start; \}/);
  // Viewport containment: a flex-column dialog capped to the visual viewport,
  // so the header and decision footer stay reachable and only the body scrolls.
  assert.match(styles, /\.sl-area-dialog\.sl-account-reference-dialog\.sl-ingredient-view-dialog\.sl-change-request-review-dialog \{[\s\S]*?width:min\(46rem,calc\(100vw - 2rem\)\)!important;[\s\S]*?max-width:46rem!important;[\s\S]*?display:flex;[\s\S]*?flex-direction:column;[\s\S]*?max-height:calc\(100dvh - 2rem\);[\s\S]*?overflow:hidden;[\s\S]*?\}/);
  assert.match(styles, /\.sl-change-request-review-dialog\.sl-ingredient-view-dialog > \.sl-popover-header \{ flex:0 0 auto; \}/);
  assert.match(styles, /\.sl-change-request-review-dialog\.sl-ingredient-view-dialog > \.sl-dialog-content \{\s*flex:1 1 auto;\s*min-height:0;\s*overflow-y:auto;\s*overscroll-behavior:contain;\s*\}/);
  assert.match(styles, /\.sl-change-request-review-dialog > \.sl-dialog-actions \{ flex:0 0 auto; \}/);
  // Reject mode focuses the required reason field and scrolls it into view.
  assert.match(page, /useEffect\(\(\)=>\{if\(confirming!=='reject'\)return;const field=rejectionField\.current;if\(!field\)return;field\.focus\(\{preventScroll:true\}\);field\.scrollIntoView\(\{block:'nearest'\}\)\},\[confirming\]\)/);
  // Final summary table: the requested change moved into the Review dialog, so the
  // table carries identity, type, ingredient, requester, date, status and actions.
  assert.match(page, /<td><span className="sl-canonical-identifier sl-canonical-identifier-emphasis">\{record\.requestID\}<\/span><\/td>/);
  assert.match(page, /<td>\{changeRequestTypeLabel\(record\.requestType\)\}<\/td>/);
  assert.match(page, /<td className="sl-manager-request-ingredient" title=\{record\.ingredient\?formatHumanReadableText\(record\.ingredient\.name\):undefined\}><span className="sl-manager-request-ingredient-preview" aria-label=\{record\.ingredient\?formatHumanReadableText\(record\.ingredient\.name\):undefined\}>\{record\.ingredient\?formatHumanReadableText\(record\.ingredient\.name\):'—'\}<\/span><\/td>/);
  assert.match(page, /\['Request ID','Type','Ingredient','Submitted By','Submitted','Status','Actions'\]/);
  assert.doesNotMatch(page, /'Requested Change'/);
  assert.doesNotMatch(page, /sl-manager-request-change-comparison/);
  assert.doesNotMatch(page, /formatChangeRequestComparisonParts/);
  assert.doesNotMatch(page, /changeRequestComparison\(record\)/);
  assert.doesNotMatch(page, /className="sl-emphasized-value">\{record\.ingredient/);
  // Long ingredient names show a compact single line with an ellipsis in the row;
  // the stored value is untouched and the full name stays available via tooltip,
  // accessible name and Review dialog.
  assert.match(styles, /\.sl-manager-change-requests-live \.sl-application-records-table \.sl-manager-request-ingredient \{ min-width:0; padding-inline:\.5rem!important; \}/);
  assert.match(styles, /\.sl-manager-change-requests-live \.sl-application-records-table \.sl-manager-request-ingredient-preview \{ display:inline-block; max-width:100%; vertical-align:middle; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; \}/);
  // Seven rebalanced columns: the widths total 100% and Actions keeps one line.
  assert.doesNotMatch(styles, /sl-manager-change-requests-live \.sl-application-records-table :is\(th,td\):nth-child\(8\)/);
  assert.match(styles, /\.sl-manager-change-requests-live \.sl-application-records-table :is\(th,td\):nth-child\(1\) \{ width: 13%; \}/);
  assert.match(styles, /\.sl-manager-change-requests-live \.sl-application-records-table :is\(th,td\):nth-child\(3\) \{ width: 29%; \}/);
  assert.match(styles, /\.sl-manager-change-requests-live \.sl-application-records-table :is\(th,td\):nth-child\(7\) \{ width: 7%; \}/);
  assert.match(styles, /\.sl-manager-change-requests-live \.sl-application-records-table :is\(th,td\):nth-child\(6\) \{ width: 9%; \}/);
  assert.match(styles, /\.sl-manager-change-requests-live \.sl-application-records-table \.sl-sa-ingredients-actions-cell \{ white-space:nowrap; \}/);
  // The Eye action keeps a descriptive accessible name per request.
  assert.match(page, /aria-label=\{record\.status==='PENDING'\?`Review Request \$\{record\.requestID\}`:`View Request \$\{record\.requestID\}`\}/);
  // Dot-free status badges inside this module, with text, tone and semantics kept.
  assert.match(styles, /\.sl-manager-change-requests-live \.sl-application-records-table \.sl-status-dot \{ display:none; \}/);
  assert.match(styles, /\.sl-manager-change-requests-live \.sl-application-records-table \.sl-status \{ justify-content:center; gap:0; padding-inline:var\(--sl-space-3\); \}/);
  // STATUS and ACTIONS read as associated neighbours with a modest gap and no
  // trailing dead space.
  assert.match(styles, /\.sl-manager-change-requests-live \.sl-application-records-table :is\(thead th,tbody td\):nth-child\(6\),\s*\.sl-manager-change-requests-live \.sl-application-records-table :is\(thead th,tbody td\):nth-child\(7\) \{ text-align:center!important; padding-inline:\.375rem!important; \}/);
  assert.match(page, /<Status tone=\{record\.status==='APPROVED'\?'success':record\.status==='REJECTED'\?'critical':'attention'\}>\{changeRequestStatusLabel\(record\.status\)\}<\/Status>/);
  // Identifier pill holds the request ID only; the type appears once, as support text.
  assert.match(styles, /\.sl-change-request-review-dialog \.sl-ingredient-details-identity-support \{ margin:\.45rem 0 0; color:var\(--sl-muted\); font:var\(--sl-font-supporting\); \}/);
  assert.match(styles, /\.sl-change-request-review-dialog \.sl-status-dot \{ display:none; \}/);
  assert.match(styles, /\.sl-change-request-review-dialog \.sl-staff-change-request-requested > strong \{ color:var\(--sl-success\); \}/);
  // Reject is restrained until interaction but keeps contrast, hover, active and focus.
  assert.match(styles, /\.sl-change-request-review-dialog > \.sl-dialog-actions \.sl-manager-request-reject \{[\s\S]*?border-color:var\(--sl-critical\);[\s\S]*?background:var\(--sl-critical-bg\);[\s\S]*?color:var\(--sl-critical\);[\s\S]*?font-weight:600;[\s\S]*?\}/);
  assert.match(styles, /\.sl-change-request-review-dialog > \.sl-dialog-actions \.sl-manager-request-reject:hover:not\(:disabled\) \{ background:color-mix\(in srgb,var\(--sl-critical-bg\) 90%,var\(--sl-critical\) 10%\); \}/);
  assert.match(styles, /\.sl-change-request-review-dialog > \.sl-dialog-actions \.sl-manager-request-reject:active:not\(:disabled\) \{ background:color-mix\(in srgb,var\(--sl-critical-bg\) 82%,var\(--sl-critical\) 18%\); \}/);
  assert.match(styles, /\.sl-change-request-review-dialog > \.sl-dialog-actions \.sl-manager-request-reject:focus-visible \{ outline:2px solid color-mix\(in srgb,var\(--sl-critical\) 72%,var\(--sl-focus\)\); outline-offset:2px; \}/);
});

// The rejection form must grow the scrolling body, never the dialog itself, and
// every decision rule around it must survive unchanged.
test('Review dialog contains the rejection form without losing a decision rule', () => {
  const page = readFileSync(new URL('../src/components/application/ManagerChangeRequestsPage.tsx', import.meta.url), 'utf8');
  const form = readFileSync(new URL('../src/components/application/ManagerRejectionForm.tsx', import.meta.url), 'utf8');
  const styles = readFileSync(new URL('../src/styles/application.css', import.meta.url), 'utf8');
  const shell = readFileSync(new URL('../src/components/application/Dialog.tsx', import.meta.url), 'utf8');
  // The header, the body and the footer are the dialog's only direct children, and
  // they are the ones the flex layout pins, so no other consumer is affected.
  assert.match(shell, /<div className=\{`sl-popover-header/);
  assert.match(shell, /\{children && <div className="sl-dialog-content">\{children\}<\/div>\}/);
  assert.match(shell, /\{actions && <div className="sl-dialog-actions">\{actions\}<\/div>\}/);
  // The inline form sits inside the scrolling body, not in the footer.
  assert.match(page, /reviewForm=\{confirming==='reject'&&selected\?\.status==='PENDING'\?renderManagerRejectionForm\(/);
  assert.match(form, /<form id="manager-reject-change-request" className="sl-manager-inline-rejection"/);
  assert.match(styles, /\.sl-change-request-review-dialog \.sl-manager-inline-rejection \{ margin-top:16px; padding-top:16px; border-top:1px solid var\(--sl-border-subtle\); display:grid; align-content:start; gap:\.35rem; \}/);
  assert.match(styles, /\.sl-change-request-review-dialog \.sl-manager-inline-rejection textarea \{ width:100%; min-height:92px;[\s\S]*?resize:vertical; \}/);
  // Preserved business rules: required reason, explicit Reject Request, Back to
  // Review, single-dialog approval confirmation, Escape and focus restoration.
  assert.match(page, /renderManagerRejectionForm\(\{note:reviewNote,setNote:setReviewNote,error:reviewError,setError:setReviewError,field:rejectionField,onSubmit:\(\)=>void decide\(\)\}\)/);
  assert.match(page, /:confirming==='approve'&&selected\?\.status==='PENDING'\?renderManagerApprovalForm\(\{record:selected,error:reviewError,onSubmit:\(\)=>void decide\(\)\}\)/);
  assert.match(form, /onSubmit=\{event => \{ event\.preventDefault\(\); onSubmit\?\.\(\); \}\}/);
  assert.match(form, /id="manager-rejection-reason" rows=\{4\} required/);
  assert.match(page, />Reject Request<\/button>/);
  assert.match(page, />Back to Review<\/button>/);
  assert.doesNotMatch(page, /Cancel rejection/);
  assert.doesNotMatch(page, /confirming==='create'|secondDialog|pendingApprove/);
});

// The inline rejection form: clean until submitted, validated on submit, cleared
// by a valid value, still whitespace-aware, and never outside the Review dialog.
test('inline rejection validation is submit-driven and keeps Manager rules', () => {
  const page = readFileSync(new URL('../src/components/application/ManagerChangeRequestsPage.tsx', import.meta.url), 'utf8');
  const form = readFileSync(new URL('../src/components/application/ManagerRejectionForm.tsx', import.meta.url), 'utf8');
  const styles = readFileSync(new URL('../src/styles/application.css', import.meta.url), 'utf8');
  // Untouched initial state: opening Reject clears the message, and the form body
  // derives its error from state alone, so nothing is shown before an attempt.
  assert.match(page, /\[confirming,setConfirming\]=useState<'approve'\|'reject'\|null>\(null\),\[reviewNote,setReviewNote\]=useState\(''\)/);
  assert.match(page, /onClick=\{\(\)=>\{setReviewNote\(''\);setReviewError\(''\);setConfirming\('reject'\)\}\}>Reject<\/button>/);
  assert.match(form, /const invalid = Boolean\(error\);/);
  assert.match(form, /const message = 'Enter the reason for rejecting this request\.';/);
  // Invalid submission: the action blocks the call, sets the message and returns
  // focus to the field. A whitespace-only value takes the same path as an empty one.
  assert.match(page, /if\(confirming==='reject'&&!reviewNote\.trim\(\)\)\{setReviewError\('Enter the reason for rejecting this request\.'\);rejectionField\.current\?\.focus\(\);return\}/);
  assert.doesNotMatch(page, /reviewTouched/);
  // Corrected input clears the message; the next submit re-derives it.
  assert.match(form, /if \(next\.trim\(\)\) setError\(''\)/);
  assert.match(form, /aria-invalid=\{invalid\}/);
  assert.match(form, /aria-describedby=\{invalid \? 'manager-rejection-help manager-rejection-error' : 'manager-rejection-help'\}/);
  assert.match(form, /className="sl-field-error" role="alert"/);
  // The visible asterisk is gone, but the field, its helper and its rule remain.
  assert.match(form, /<label htmlFor="manager-rejection-reason">Rejection reason<\/label>/);
  assert.doesNotMatch(form, /\*/);
  assert.match(form, /className="sl-field-help"/);
  // Back to Review returns to the review actions without submitting; the reason
  // id and the trimmed payload are untouched.
  assert.match(page, /onClick=\{closeDecision\}>Back to Review<\/button>/);
  assert.match(page, /const closeDecision=\(\)=>\{const reviewed=confirming;setConfirming\(null\);setReviewNote\(''\);setReviewError\(''\);\(reviewed==='approve'\?approveTrigger:rejectTrigger\)\.current\?\.focus\(\)\}/);
  assert.match(page, /const dismissReview=\(\)=>\{if\(busy\)return;/);
  assert.match(page, /rejectChangeRequest\(selected\.id,reviewNote\.trim\(\)\)/);
  assert.match(page, /type="submit" form="manager-reject-change-request"/);
  // No mutation can happen before Reject Request: approve and reject are the only
  // decision calls, both inside decide().
  assert.equal((page.match(/await approveChangeRequest\(/g) ?? []).length, 1);
  assert.equal((page.match(/await rejectChangeRequest\(/g) ?? []).length, 1);
  assert.equal((page.match(/void decide\(\)/g) ?? []).length, 2);
  // Form conventions come from the approved tokens and the shared helper text.
  assert.match(styles, /\.sl-change-request-review-dialog \.sl-manager-inline-rejection label \{ font:var\(--sl-font-label\); \}/);
  assert.match(styles, /\.sl-change-request-review-dialog \.sl-manager-inline-rejection textarea:focus \{ outline:2px solid var\(--sl-focus\); outline-offset:1px; border-color:var\(--sl-focus\); \}/);
  assert.match(styles, /\.sl-change-request-review-dialog \.sl-manager-inline-rejection textarea\[aria-invalid=true\] \{ border-color:var\(--sl-critical\); \}/);
});

// The split formatter must produce exactly the strings the composed formatter
// showed before, so dropping the redundant type prefix cannot change a value.
test('Manager Requested Change values stay identical without the duplicated type prefix', () => {
  const cases: [string, Partial<ChangeRequest>, string, string][] = [
    ['minimum stock keeps its unit', { requestType: 'MINIMUM_STOCK_CHANGE', targetField: 'minimumStock' }, '57 kg', '80 kg'],
    ['unit cost keeps its currency and precision', { requestType: 'STANDARD_UNIT_COST_CHANGE', targetField: 'standardUnitCost', currentValue: '95', requestedValue: '100' }, '₱95.00', '₱100.00'],
    ['shelf life keeps its unit label', { requestType: 'DEFAULT_SHELF_LIFE_CHANGE', targetField: 'defaultShelfLifeDays', currentValue: '7', requestedValue: '1' }, '7 days', '1 day'],
    ['a text field passes through unchanged', { requestType: 'BRAND_CHANGE', targetField: 'brand', currentValue: 'Baguio', requestedValue: 'Kalinga' }, 'Baguio', 'Kalinga'],
  ];
  for (const [name, overrides, expectedCurrent, expectedRequested] of cases) {
    const record = request(overrides);
    const parts = formatChangeRequestComparisonParts(record);
    assert.equal(parts.current, expectedCurrent, name);
    assert.equal(parts.requested, expectedRequested, name);
    // The composed string keeps the same values and remains available.
    assert.equal(changeRequestComparison(record), `${expectedCurrent} → ${expectedRequested}`, name);
    assert.doesNotMatch(changeRequestComparison(record), /Change: /, name);
  }
});

// A Description Change may hold up to 1000 characters (server validator limit).
// The wrap class is chosen by the target field, and the text itself is passed
// through whole, so wrapping can never truncate or reformat a description.
test('a long Description Change keeps its full text and wraps instead of forcing a wide column', () => {
  const longText = 'Sifted all-purpose flour, repacked into 1 kg resealable pouches and stored away from direct sunlight. '.repeat(8).trim();
  assert.ok(longText.length > 500 && longText.length <= 1000);
  const record = request({ requestType: 'DESCRIPTION_CHANGE', targetField: 'description', currentValue: 'All-purpose flour', requestedValue: longText });
  const parts = formatChangeRequestComparisonParts(record);
  assert.equal(parts.current, 'All-purpose flour');
  assert.equal(parts.requested, longText);
  assert.equal(changeRequestComparison(record), `All-purpose flour → ${longText}`);
});

test('My Requests keeps its protected create modal, date range, and current-only query', () => {
  const source = readFileSync(new URL('../src/app/(administration)/ChangeRequests.tsx', import.meta.url), 'utf8');
  const styles = readFileSync(new URL('../src/styles/application.css', import.meta.url), 'utf8');
  assert.match(source, /<ChangeRequestDetailsDialog inventoryStaff request=\{detail\}/);
  assert.match(source, /description="Submit and track your ingredient change requests\."/);
  assert.match(source, /placeholder="Search by request ID or ingredient\.\.\."/);
  assert.doesNotMatch(source, /Search by request ID, ingredient, or batch ID/);
  assert.match(source, /\['Request ID','Ingredient','Requested Change','Submitted On','Status'\]/);
  assert.doesNotMatch(source, /\['Request ID','Type','Ingredient'/);
  assert.match(source, /const requestedChange=\(record:ChangeRequest\)=>changeRequestTypeLabel\(record\.requestType\)/);
  assert.match(source, /\[FileInput,'brand','Total Requests'/);
  assert.match(source, /\[Clock3,'info','Pending'/);
  assert.match(source, /\[CheckCircle2,'attention','Approved'/);
  assert.match(source, /\[XCircle,'critical','Rejected'/);
  assert.match(source, /<div className="sl-superadmin-dashboard-v49 sl-staff-usage-v150"><section className="sl-sa-kpis sl-inventory-staff-kpis sl-staff-usage-kpis sl-superadmin-dashboard-kpis-v201">/);
  assert.doesNotMatch(styles, /\.sl-staff-requests-v162 \.sl-staff-usage-kpis \.sl-inventory-staff-kpi \{/);
  assert.doesNotMatch(source, />Pending Review</);
  assert.match(source, /getChangeRequestSummary\(signal\)/);
  assert.match(source, /summaryFailed\|\|summary===null\?'—':value/);
  assert.doesNotMatch(source, /items\.reduce/);
  assert.match(source, /<colgroup><col className="sl-staff-request-col-standard"\/><col className="sl-staff-request-col-standard"\/><col className="sl-staff-request-col-change"\/><col className="sl-staff-request-col-standard"\/><col className="sl-staff-request-col-status"\/><\/colgroup>/);
  assert.match(styles, /\.sl-staff-requests-v162 \.sl-staff-my-requests-table :is\(thead th,tbody td\) \{ text-align:left!important; \}/);
  assert.match(styles, /\.sl-staff-requests-v162 \.sl-staff-my-requests-table \.sl-staff-request-col-standard \{ width:20%; \}/);
  assert.match(styles, /\.sl-staff-requests-v162 \.sl-staff-my-requests-table \.sl-staff-request-col-change \{ width:30%; \}/);
  assert.match(styles, /\.sl-staff-requests-v162 \.sl-staff-my-requests-table \.sl-staff-request-col-status \{ width:10%; \}/);
  assert.match(styles, /\.sl-staff-requests-v162 \.sl-staff-my-requests-table \.sl-canonical-identifier \{ font-weight:600; \}/);
  assert.match(styles, /\.sl-staff-change-request-details \.sl-status-dot \{ display:none; \}/);
  assert.match(styles, /\.sl-area-dialog\.sl-staff-change-request-details-dialog \{\s*width:min\(38rem,calc\(100vw - 2rem\)\)!important;\s*max-width:38rem!important;/);
  assert.match(styles, /\.sl-staff-change-request-comparison \{[\s\S]*?background:var\(--sl-surface-subtle\);[\s\S]*?\}/);
  assert.doesNotMatch(styles, /\.sl-staff-change-request-details-dialog \.sl-staff-change-request-comparison > \.sl-staff-change-request-requested \{/);
  assert.doesNotMatch(styles, /\.sl-staff-change-request-details-dialog[^{}]*\.sl-staff-change-request-requested[^{}]*\{[^}]*?(?:background|border|outline|box-shadow|gradient):/);
  assert.match(styles, /\.sl-staff-change-request-details-dialog \.sl-staff-change-request-requested > strong \{ color:var\(--sl-success\); \}/);
  assert.match(styles, /\.sl-staff-change-request-comparison > div > span \{ color:var\(--sl-muted\);/);
  assert.doesNotMatch(styles, /\.sl-staff-change-request-details-dialog[^{}]*\.sl-staff-change-request-requested > span \{/);
  assert.doesNotMatch(styles, /\.sl-staff-change-request-details-dialog[^{}]*first-child[^{}]*strong[^{}]*\{[^}]*color:/);
  assert.match(styles, /@media \(width<=540px\) \{[\s\S]*?\.sl-area-dialog\.sl-staff-change-request-details-dialog \{ width:calc\(100vw - 1rem\)!important; max-width:calc\(100vw - 1rem\)!important; \}/);
  assert.match(styles, /\.sl-staff-change-request-content \{ margin-top:14px; \}/);
  assert.match(styles, /\.sl-staff-change-request-reason \{ margin-top:14px; \}/);
  assert.match(styles, /\.sl-staff-change-request-outcome \{ margin:12px 0 0;/);
  assert.match(styles, /\.sl-staff-requests-v162 \.sl-staff-my-requests-table \{ table-layout:fixed; min-width:58rem; \}/);
  assert.match(source, /<span>Date Range<\/span>/);
  assert.match(source, /currentOnly:true/);
  assert.match(source, /const PAGE_SIZES=\[10,15,50,100,150\]/);
  assert.match(source, /itemLabel=\{total===1\?'request':'requests'\}/);
  assert.match(source, /className="sl-detail-enabled-row" tabIndex=\{0\}/);
  const recordsHeader = source.slice(source.indexOf('<header className="sl-application-records-header'), source.indexOf('</header>', source.indexOf('<header className="sl-application-records-header')));
  const toolbar = source.slice(source.indexOf('<div className="sl-sa-ingredients-table-filters">'), source.indexOf('<div className="sl-sa-ingredients-table-scroll'));
  assert.match(recordsHeader, /<h2>Requests<\/h2>/);
  assert.doesNotMatch(recordsHeader, />New Request</);
  assert.match(toolbar, />New Request</);
  assert.ok(toolbar.indexOf('Search records') < toolbar.indexOf('<span>Type</span>'));
  assert.ok(toolbar.indexOf('<span>Type</span>') < toolbar.indexOf('<span>Status</span>'));
  assert.ok(toolbar.indexOf('<span>Status</span>') < toolbar.indexOf('<span>Date Range</span>'));
  assert.ok(toolbar.indexOf('<span>Date Range</span>') < toolbar.indexOf('>Reset</button>'));
  assert.ok(toolbar.indexOf('>Reset</button>') < toolbar.indexOf('>New Request</button>'));
  assert.match(toolbar, /\{filtered&&<button[^>]*onClick=\{reset\}>Reset<\/button>\}/);
  assert.doesNotMatch(toolbar, />Clear filters<\/button>/);
  assert.match(source, /<span>Request Type<\/span><select/);
  assert.match(source, /<span>Ingredient<\/span><select/);
  assert.match(source, /<span>Current Value<\/span><output/);
  assert.match(source, /Requested Value'[\s\S]*?<input/);
  assert.match(source, /<span>Reason<\/span><textarea/);
  assert.match(source, /secondaryLabel="Cancel"/);
  assert.match(source, /primaryLabel="Submit Request"/);
});

test('Inventory Staff dashboard and My Requests share the same Staff details path', () => {
  const dashboard = readFileSync(new URL('../src/components/dashboard/RoleDashboard.tsx', import.meta.url), 'utf8');
  const myRequests = readFileSync(new URL('../src/app/(administration)/ChangeRequests.tsx', import.meta.url), 'utf8');
  const manager = readFileSync(new URL('../src/components/application/ManagerChangeRequestsPage.tsx', import.meta.url), 'utf8');
  assert.match(dashboard, /<ChangeRequestDetailsDialog inventoryStaff request=\{detail\}/);
  assert.match(myRequests, /<ChangeRequestDetailsDialog inventoryStaff request=\{detail\}/);
  assert.match(dashboard, /<ChangeRequestDetailsDialog inventoryStaff request=\{detail\}/);
  assert.doesNotMatch(`${dashboard}\n${myRequests}`, /inventoryStaffMyRequests/);
  assert.match(manager, /<ChangeRequestDetailsDialog manager request=\{selected\}/);
});

// Final UI refinement: a neutral close control on the Review dialog only, the
// instructed rejection helper text, and the simplified single-step approval
// confirmation. Every preserved decision rule is asserted alongside them.
test('Review dialog refinement keeps the neutral close control, helper text and single approval step', () => {
  const dialog = readFileSync(new URL('../src/components/application/Dialog.tsx', import.meta.url), 'utf8');
  const shared = readFileSync(new URL('../src/components/application/ApplicationDetailsDialog.tsx', import.meta.url), 'utf8');
  const details = readFileSync(new URL('../src/components/application/ChangeRequestDetailsDialog.tsx', import.meta.url), 'utf8');
  const page = readFileSync(new URL('../src/components/application/ManagerChangeRequestsPage.tsx', import.meta.url), 'utf8');
  const form = readFileSync(new URL('../src/components/application/ManagerRejectionForm.tsx', import.meta.url), 'utf8');
  const approvalForm = readFileSync(new URL('../src/components/application/ManagerApprovalForm.tsx', import.meta.url), 'utf8');
  const styles = readFileSync(new URL('../src/styles/application.css', import.meta.url), 'utf8');

  // The neutral treatment is opt-in and applied by string interpolation, so a
  // dialog that passes nothing keeps the exact shared close button it had.
  assert.match(dialog, /closeVariant, className = '' \}: \{/);
  assert.match(dialog, /\$\{closeVariant === 'neutral' \? ' sl-close-button--neutral' : ''\}/);
  assert.match(shared, /closeVariant, actions \}: \{/);
  assert.match(shared, /closeVariant\?: 'neutral';/);
  assert.match(shared, /closeVariant=\{closeVariant\}/);
  assert.match(details, /closeVariant="neutral"/);
  assert.equal((details.match(/closeVariant="neutral"/g) ?? []).length, 1);
  // Focus visibility for the close control is the shared icon-button rule, which is
  // not redefined here; only the hover fill changes, and only for this dialog.
  assert.match(styles, /\.sl-icon-button:focus-visible \{\s*outline: 2px solid var\(--sl-focus\);\s*outline-offset: 2px;\s*\}/);
  assert.match(styles, /\.sl-app \.sl-change-request-review-dialog \.sl-close-button--neutral:hover \{\s*background:var\(--sl-surface-subtle\)!important;\s*border-color:var\(--sl-border\)!important;\s*color:var\(--sl-text\)!important;\s*\}/);
  // The shared red hover is untouched, so unrelated dialogs are unchanged.
  assert.match(styles, /\.sl-app \.sl-close-button:hover,\.sl-area-dialog \.sl-close-button:hover,\.sl-filter-popover \.sl-close-button:hover \{\s*background: var\(--sl-critical\)!important;/);
  assert.doesNotMatch(styles, /\.sl-close-button:hover \{\s*background:var\(--sl-surface-subtle\)/);

  // Instructed helper text, with the field still required three ways.
  assert.match(form, /Please explain why you're rejecting this request\. Your reason will be saved with the request\./);
  assert.doesNotMatch(form, /Explain why this request cannot be approved/);
  assert.match(form, /id="manager-rejection-reason" rows=\{4\} required/);
  assert.doesNotMatch(form, /Rejection reason \*/);

  // Approval is confirmed inline in the same dialog: the instructed copy, the
  // factual field and value line, and the swapped footer actions.
  assert.match(page, /renderManagerApprovalForm\(\{record:selected,error:reviewError,onSubmit:\(\)=>void decide\(\)\}\)/);
  assert.match(approvalForm, /Approve this request\?/);
  assert.match(approvalForm, /The requested change will be applied to the ingredient\. Once approved, the ingredient will use the new value\./);
  assert.doesNotMatch(page, /Approve and apply change\?/);
  assert.doesNotMatch(page, /authoritative Ingredient master-data value/);
  assert.match(page, />Back to Review<\/button>/);
  assert.match(page, />Confirm Approval<\/button>/);
  assert.match(page, /type="submit" form="manager-approve-change-request"/);
  assert.match(approvalForm, /<form id="manager-approve-change-request" className="sl-manager-inline-approval" aria-labelledby="manager-approval-question" aria-describedby=\{invalid \? 'manager-approval-error' : undefined\} onSubmit=\{event => \{ event\.preventDefault\(\); onSubmit\?\.\(\); \}\}>/);
  assert.match(approvalForm, /id="manager-approval-question"/);
  assert.match(approvalForm, /className="sl-field-help"/);
  assert.match(approvalForm, /className="sl-manager-inline-approval-change"/);
  // Exactly one confirmation step and no nested modal of any kind.
  assert.equal((page.match(/<InventoryStaffModal/g) ?? []).length, 0);
  assert.equal((page.match(/<ChangeRequestDetailsDialog/g) ?? []).length, 1);
  assert.doesNotMatch(page, /secondConfirm|confirming==='approveConfirm'|Approve Anyway/);
  // The current-versus-requested comparison is untouched by this refinement.
  assert.match(details, /<div><strong>\{current\}<\/strong><span>Current<\/span><\/div>/);
  assert.match(details, /<strong>\{requested\}<\/strong><span>Requested<\/span><\/div>/);
  // Rejection validation and the explicit final action survive.
  assert.match(page, /if\(confirming==='reject'&&!reviewNote\.trim\(\)\)\{setReviewError\('Enter the reason for rejecting this request\.'\)/);
  assert.match(page, /rejectChangeRequest\(selected\.id,reviewNote\.trim\(\)\)/);
  assert.match(page, /onClick=\{closeDecision\}>Back to Review<\/button>/);
});

// Inline approval confirmation: it opens inside the Review dialog, Back to Review
// submits nothing, only Confirm Approval reaches the existing handler, and a second
// submit cannot start while the first is still in flight.
test('inline approval confirmation confirms once, never submits early, and keeps the rejection path', () => {
  const page = readFileSync(new URL('../src/components/application/ManagerChangeRequestsPage.tsx', import.meta.url), 'utf8');
  const approvalForm = readFileSync(new URL('../src/components/application/ManagerApprovalForm.tsx', import.meta.url), 'utf8');
  const styles = readFileSync(new URL('../src/styles/application.css', import.meta.url), 'utf8');

  // Opening the confirmation: Approve Request switches the inline section on and
  // clears any earlier message, without calling an API.
  assert.match(page, /<button ref=\{approveTrigger\} type="button" className="sl-button sl-button-primary" onClick=\{\(\)=>\{setReviewError\(''\);setConfirming\('approve'\)\}\}>Approve Request<\/button>/);
  assert.match(page, /confirming==='approve'&&selected\?\.status==='PENDING'\?renderManagerApprovalForm\(/);
  assert.equal((page.match(/approveChangeRequest\(/g) ?? []).length, 1);
  assert.equal((page.match(/await approveChangeRequest\(/g) ?? []).length, 1);

  // The confirmation section carries the question, the explanation and the field
  // and values, and its own submit reaches the page handler.
  assert.match(approvalForm, /<h4 id="manager-approval-question">Approve this request\?<\/h4>/);
  assert.match(approvalForm, /const field = isCurrentChangeRequest\(record\) \? CHANGE_REQUEST_TARGET_LABELS\[record\.targetField\] : 'Requested Change';/);
  assert.match(approvalForm, /const \{ current, requested \} = formatChangeRequestComparisonParts\(record\);/);
  assert.match(approvalForm, /\{current\} <span aria-hidden="true">→<\/span> \{requested\}/);
  assert.match(approvalForm, /onSubmit\?\.\(\);/);
  assert.match(page, /<button type="submit" form="manager-approve-change-request" className="sl-button sl-button-primary" disabled=\{busy\}>Confirm Approval<\/button>/);
  assert.match(page, /<button type="button" className="sl-button" disabled=\{busy\} onClick=\{closeDecision\}>Back to Review<\/button>/);

  // Only Confirm Approval is enabled to submit, and only once: the form is the
  // button's form, and every control in the footer is disabled while busy.
  assert.doesNotMatch(page, /onClick=\{\(\)=>void confirm|onClick=\{\(\)=>void approve/);

  // Duplicate submission is impossible: decide() returns while busy, and every
  // footer control of both decision modes is disabled by the same flag.
  assert.match(page, /const decide=async\(\)=>\{if\(!selected\|\|!confirming\|\|busy\)return;/);
  assert.equal((page.match(/disabled=\{busy\}/g) ?? []).length, 4);
  assert.match(page, /const \[data,setData\]=useState[\s\S]*?\[busy,setBusy\]=useState\(false\)/);

  // Truthful handling: the dialog closes and the list reloads only after the call
  // resolves, and a failure shows the message inside the confirmation instead.
  assert.match(page, /if\(confirming==='approve'\)await approveChangeRequest\(selected\.id\);else await rejectChangeRequest\(selected\.id,reviewNote\.trim\(\)\);setConfirming\(null\);/);
  assert.match(page, /catch\{setReviewError\(confirming==='approve'\?'Unable to approve this request\.':'Unable to record this decision\.'\)\}finally\{setBusy\(false\)\}/);
  assert.match(approvalForm, /\{invalid && <p id="manager-approval-error" className="sl-field-error" role="alert">\{error\}<\/p>\}/);

  // Back to Review returns to the review actions, submits nothing and restores
  // focus to the control that opened the decision that was abandoned.
  assert.match(page, /const closeDecision=\(\)=>\{const reviewed=confirming;setConfirming\(null\);setReviewNote\(''\);setReviewError\(''\);\(reviewed==='approve'\?approveTrigger:rejectTrigger\)\.current\?\.focus\(\)\}/);

  // Dialog containment and dismissal are unchanged: the body still scrolls, the
  // header and footer are still pinned, and Escape still dismisses unless busy.
  assert.match(styles, /\.sl-change-request-review-dialog\.sl-ingredient-view-dialog > \.sl-dialog-content \{\s*flex:1 1 auto;\s*min-height:0;\s*overflow-y:auto;\s*overscroll-behavior:contain;\s*\}/);
  assert.match(styles, /\.sl-change-request-review-dialog > \.sl-dialog-actions \{ flex:0 0 auto; \}/);
  assert.match(page, /const dismissReview=\(\)=>\{if\(busy\)return;/);

  // The confirmation section reuses the rejection section's shape and tokens, so
  // both decision modes are one visual pattern rather than two designs.
  assert.match(styles, /\.sl-change-request-review-dialog \.sl-manager-inline-approval \{ margin-top:16px; padding-top:16px; border-top:1px solid var\(--sl-border-subtle\); display:grid; align-content:start; gap:\.35rem; \}/);
  assert.match(styles, /\.sl-change-request-review-dialog \.sl-manager-inline-approval h4 \{ margin:0; font:var\(--sl-font-label\); \}/);
  assert.match(styles, /\.sl-change-request-review-dialog \.sl-manager-inline-approval-change \{[\s\S]*?background:var\(--sl-surface-subtle\);[\s\S]*?font:var\(--sl-font-supporting\);[\s\S]*?\}/);
  // The neutral close hover and its red counterpart are both untouched here.
  assert.match(styles, /\.sl-app \.sl-change-request-review-dialog \.sl-close-button--neutral:hover \{/);

  // The rejection path is untouched: same submit wiring, same validation, and no
  // approval control leaked into the rejection form.
  assert.match(page, /renderManagerRejectionForm\(\{note:reviewNote,setNote:setReviewNote,error:reviewError,setError:setReviewError,field:rejectionField,onSubmit:\(\)=>void decide\(\)\}\)/);
  assert.match(page, /if\(confirming==='reject'&&!reviewNote\.trim\(\)\)\{setReviewError\('Enter the reason for rejecting this request\.'\);rejectionField\.current\?\.focus\(\);return\}/);
});

// Final summary table: seven columns, no duplicated comparison, the values kept
// whole in the Review dialog, and every filter/search/decision path untouched.
test('Manager summary table is seven columns and keeps every decision path', () => {
  const page = readFileSync(new URL('../src/components/application/ManagerChangeRequestsPage.tsx', import.meta.url), 'utf8');
  const details = readFileSync(new URL('../src/components/application/ChangeRequestDetailsDialog.tsx', import.meta.url), 'utf8');
  const styles = readFileSync(new URL('../src/styles/application.css', import.meta.url), 'utf8');
  // Exact column order, and the empty state spans the same seven columns.
  assert.match(page, /<thead><tr>\{\['Request ID','Type','Ingredient','Submitted By','Submitted','Status','Actions'\]\.map\(v=><th key=\{v\}>\{v\}<\/th>\)\}<\/tr><\/thead>/);
  assert.match(page, /<td colSpan=\{7\} className="sl-empty-cell">/);
  assert.equal((page.match(/<th key=\{v\}>/g) ?? []).length, 1);
  // Row order matches the header order exactly.
  const row = page.slice(page.indexOf('data.items.map(record=><tr key={record.id}>'), page.indexOf('):<tr><td colSpan='));
  const order = ['record.requestID', 'changeRequestTypeLabel(record.requestType)', 'record.ingredient', 'record.requestedBy.name', 'formatDateTime(record.createdAt)', "record.status==='APPROVED'", 'onClick={e=>void openReview(record,e.currentTarget)}'];
  let cursor = -1;
  for (const token of order) {
    const at = row.indexOf(token);
    assert.ok(at > cursor, `${token} must come after the previous column`);
    cursor = at;
  }
  assert.equal((row.match(/<td/g) ?? []).length, 7);
  // The removed values, reason and decision history stay available in the dialog,
  // so no API field, audit datum or request information is lost.
  assert.match(details, /const current = formatStaffChangeRequestValue\(request, request.currentValue\);/);
  assert.match(details, /const requested = formatStaffChangeRequestValue\(request, request.requestedValue\);/);
  assert.match(details, /callout=\{<div className=\{`sl-staff-change-request-comparison/);
  assert.match(details, /<h4>Reason for request<\/h4><p>\{request\.reason\}<\/p>/);
  assert.match(details, /\{ label: 'Reviewed By', value: formatHumanReadableText\(request\.reviewedBy\.name\) \}/);
  // The service still carries the values the table no longer shows.
  const service = readFileSync(new URL('../src/services/change-requests.ts', import.meta.url), 'utf8');
  assert.match(service, /currentValue/);
  assert.match(service, /requestedValue/);
  // Search, filters, sorting, pagination, statuses and dialog behavior are intact.
  assert.match(page, /placeholder="Search by request ID or ingredient\.\.\."/);
  assert.match(page, /ariaLabel="Filter requests by type"/);
  assert.match(page, /ariaLabel="Filter requests by status"/);
  assert.match(page, /ariaLabel="Filter requests by date range"/);
  assert.match(page, /const PAGE_SIZES=\[10,15,50,100,150\] as const;/);
  assert.match(page, /<Pagination compact mutedWhenEmpty page=\{page\}/);
  assert.match(page, /const reset=\(\)=>\{setSearch\(''\)/);
  assert.match(page, /<ChangeRequestDetailsDialog manager request=\{selected\}/);
  // Columns are rebalanced but stay inside the design system: fixed layout from the
  // shared rules, no new shared selector, and Actions keeps one line.
  assert.match(styles, /:is\(\.sl-application-records,\.sl-sa-account-pattern-records\) :is\(\.sl-application-records-table,\.sl-sa-ingredients-table\) \{\s*table-layout: fixed;/);
  assert.match(styles, /\.sl-manager-change-requests-live \.sl-application-records-table \.sl-sa-ingredients-actions-cell \{ white-space:nowrap; \}/);
  assert.doesNotMatch(styles, /\.sl-manager-request-change-comparison/);
  // Narrow viewports keep local horizontal scrolling rather than pushing the page wide.
  assert.match(styles, /\.sl-manager-change-requests-live \.sl-application-records-table \{ min-width: 76rem; \}/);
  assert.match(styles, /:is\(\.sl-application-records,\.sl-sa-account-pattern-records\) :is\(\.sl-application-records-table-shell,\.sl-sa-ingredients-table-scroll\.sl-staff-usage-table-shell\) \{[\s\S]*?overflow: auto;/);
});

test('Manager Forecasting table keeps a real min-width and wins the CSS precedence it lost', () => {
  const page = readFileSync(new URL('../src/components/application/ModulePage.tsx', import.meta.url), 'utf8');
  const styles = readFileSync(new URL('../src/styles/application.css', import.meta.url), 'utf8');

  // The table is the shared records table inside the forecast scroll container.
  assert.match(page, /<div className="sl-mgr-forecast-tablewrap sl-application-records-table-shell"><table className="sl-application-records-table sl-data-table">/);
  // Seven forecast columns, with the longest header owning its own weighting.
  assert.match(page, /<th>Ingredient<\/th><th>Category<\/th><th>Current Stock<\/th><th>Avg\. Daily Usage<\/th><th>Forecasted Demand \(Next 30 Days\)<\/th><th>Recommended Action<\/th><th>Risk Level<\/th>/);
  assert.match(page, /<td colSpan=\{7\} className="sl-empty-cell">/);

  // The container localizes overflow instead of widening the page.
  assert.match(styles, /\.sl-mgr-forecast-tablewrap \{\s*min-width: 0;\s*overflow: auto;/);
  // Forecasting-scoped override carries the needed specificity, matching the Change Requests pattern.
  assert.match(styles, /\.sl-mgr-forecast-page \.sl-mgr-forecast-tablewrap \.sl-application-records-table \{ min-width: 76rem; \}/);
  assert.match(styles, /\.sl-mgr-forecast-page \.sl-mgr-forecast-tablewrap \.sl-application-records-table :is\(th,td\):nth-child\(1\) \{ width: 18%; \}/);
  assert.match(styles, /\.sl-mgr-forecast-page \.sl-mgr-forecast-tablewrap \.sl-application-records-table :is\(th,td\):nth-child\(5\) \{ width: 20%; \}/);
  assert.match(styles, /\.sl-mgr-forecast-page \.sl-mgr-forecast-tablewrap \.sl-application-records-table :is\(th,td\):nth-child\(7\) \{ width: 10%; \}/);
  // The override must come after the shared :is(...) rule that sets min-width:0,
  // otherwise the cascade silently resets the table to zero again.
  assert.ok(
    styles.indexOf('.sl-mgr-forecast-page .sl-mgr-forecast-tablewrap .sl-application-records-table { min-width: 76rem; }') >
      styles.indexOf(':is(.sl-application-records,.sl-sa-account-pattern-records) :is(.sl-application-records-table,.sl-sa-ingredients-table) {\n  table-layout: fixed;'),
    'forecast min-width override must appear after the shared records-table rule'
  );
  // The old losing rule stays scoped and untouched; the shared rule is not edited.
  assert.match(styles, /\.sl-mgr-forecast-tablewrap table \{\s*border-collapse: collapse;\s*width: 100%;\s*min-width: 900px;/);
  // Truthful unavailable state is preserved: no fabricated accuracy or demand figures.
  assert.match(page, /<ApplicationPendingState description="Ingredient forecasts will appear when the forecasting service is available\." \/>/);
  assert.match(page, /<span>Forecast Accuracy<\/span><strong>—<\/strong><small>Forecast data pending<\/small>/);
});