import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const read = (path: string) => readFileSync(new URL(path, import.meta.url), 'utf8');
const batchDetails = read('../src/components/application/InventoryBatchDetailsDialog.tsx');
const bulkModal = read('../src/components/application/InventoryStaffBulkModal.tsx');
const changeDetails = read('../src/components/application/ChangeRequestDetailsDialog.tsx');
const modulePage = read('../src/components/application/ModulePage.tsx');
const dashboard = read('../src/components/dashboard/RoleDashboard.tsx');
const styles = read('../src/styles/application.css');

test('locked Inventory Staff batch details keeps its approved content hierarchy and actions', () => {
  assert.match(batchDetails, /const ingredient = batch \? formatHumanReadableText\(batch\.ingredient\.name\) : '—'/);
  assert.match(batchDetails, /<h3>\{ingredient\}<\/h3>/);
  assert.match(batchDetails, /<span className="sl-canonical-identifier">\{batch\.batchID\}<\/span>/);
  assert.match(batchDetails, /\(!inventoryStaff \|\| batch\.displayStatus !== 'Expired'\) && <Status/);
  assert.match(batchDetails, /batch\.displayStatus === 'Expired' && batch\.quantity > 0/);
  assert.match(batchDetails, /<strong>\{batch\.quantity\.toLocaleString\(\)\} \{batch\.unit\}<\/strong>/);
  assert.match(batchDetails, /inventoryBatchExpirationContext\(batch\.daysLeft\)/);
  assert.match(batchDetails, /inventoryBatchRecorderLabel\(batch\.createdBy\)/);
  assert.match(batchDetails, /inventoryStaff && requiresWaste/);
  assert.match(batchDetails, /onRecordWaste\(batch\)/);

  assert.match(styles, /\.sl-staff-inventory-batch-details-dialog \.sl-batch-details-identity h3 \{[\s\S]*?font-size:1\.3125rem;[\s\S]*?font-weight:700;/);
  assert.match(styles, /\.sl-staff-inventory-batch-details-dialog > \.sl-dialog-actions \{ justify-content:flex-end; gap:10px; padding:12px 24px 14px; \}/);
  assert.match(styles, /\.sl-staff-inventory-batch-details-dialog > \.sl-dialog-actions \.sl-button-danger \{[\s\S]*?border-color:var\(--sl-critical\);[\s\S]*?background:var\(--sl-critical-bg\);[\s\S]*?color:var\(--sl-critical\);/);
});

test('Inventory Batches keeps the approved row-to-details-to-Waste handoff', () => {
  assert.match(modulePage, /<tr key=\{batch\.id\} className="sl-detail-enabled-row"[\s\S]*?setViewBatch\(batch\)/);
  assert.match(modulePage, /<InventoryBatchDetailsDialog batch=\{viewBatch\} inventoryStaff/);
  assert.match(modulePage, /pathname:'\/WasteRecording',params:\{recordWaste:'1',ingredientId:batch\.ingredient\.id,batchId:batch\.id\}/);
  assert.match(modulePage, /initialSelection=\{handoff \? \{ ingredientId: params\.ingredientId!, batchId: params\.batchId! \}/);
});

test('Dashboard and Inventory Batches share the canonical Inventory Staff Batch Details variant', () => {
  assert.match(modulePage, /<InventoryBatchDetailsDialog batch=\{viewBatch\} inventoryStaff/);
  assert.match(dashboard, /<InventoryBatchDetailsDialog batch=\{batchDetail\} inventoryStaff/);
  assert.match(dashboard, /pathname: '\/WasteRecording', params: \{ recordWaste: '1', ingredientId: batch\.ingredient\.id, batchId: batch\.id \}/);
  assert.match(styles, /\.sl-staff-inventory-batch-details-dialog\.sl-area-dialog/);
});

test('modal-specific content remains separate from shared shell semantics', () => {
  assert.match(bulkModal, /type Mode = 'stock' \| 'usage' \| 'waste'/);
  assert.match(bulkModal, /stock: \{ title: 'Add Stock-In'/);
  assert.match(bulkModal, /usage: \{ title: 'Record Usage'/);
  assert.match(bulkModal, /waste: \{ title: 'Record Waste'/);
  assert.match(changeDetails, /sl-staff-change-request-comparison/);
  assert.match(batchDetails, /sl-batch-details-primary/);
  assert.doesNotMatch(changeDetails, /sl-batch-details-primary/);
  assert.doesNotMatch(batchDetails, /sl-staff-change-request-comparison/);
});

test('current bulk shell split is characterized as accidental drift, not canonical parity', () => {
  assert.match(bulkModal, /if \(mode === 'waste'\) return <InventoryStaffModal/);
  assert.match(bulkModal, /return <Dialog open=\{open\}/);
  assert.match(styles, /\.sl-inventory-staff-bulk-dialog > \.sl-dialog-actions \{[\s\S]*?position:sticky/);
  assert.match(styles, /\.sl-inventory-staff-bulk-dialog\.sl-staff-waste-dialog \.sl-application-modal-actions \{[\s\S]*?position:sticky/);
});

test('Inventory Staff dialogs retain viewport-safe dimensions and established scroll ownership', () => {
  assert.match(styles, /\.sl-area-dialog\.sl-inventory-staff-bulk-dialog \{[\s\S]*?width: min\(45rem,calc\(100vw - 2rem\)\)!important;[\s\S]*?max-height:min\(92vh,820px\);[\s\S]*?overflow:hidden;/);
  assert.match(styles, /\.sl-area-dialog\.sl-inventory-staff-bulk-dialog > \.sl-dialog-content \{[\s\S]*?overflow-y:auto;[\s\S]*?overflow-x:hidden;/);
  assert.match(styles, /\.sl-area-dialog\.sl-staff-change-request-details-dialog \{[\s\S]*?width:min\(38rem,calc\(100vw - 2rem\)\)!important;/);
  assert.match(styles, /@media \(width<=520px\)[\s\S]*?\.sl-staff-inventory-batch-details-dialog > \.sl-dialog-actions \{ align-items:stretch; flex-direction:column-reverse; \}/);
});

// The shared form is a two-column grid, so the action row used to land in whichever cell
// the field count happened to leave free: Record Usage has five fields (footer fell into
// the right column) and Record Waste six (footer fell into the left). Spanning the row is
// the one fix that corrects both dialogs at once from the shared primitive, instead of a
// per-dialog override that would have to be repeated for every future recording form.
test('the shared modal action row spans the form grid whatever the field count is', () => {
  assert.match(styles, /:is\(\.sl-application-modal,\.sl-inventory-staff-modal\) :is\(\.sl-application-modal-actions,\.sl-staff-usage-form-actions\) \{[\s\S]*?grid-column: 1 \/ -1;[\s\S]*?padding: 1rem var\(--sl-application-modal-padding\);/);
  assert.match(styles, /:is\(\.sl-application-modal,\.sl-inventory-staff-modal\) :is\(\.sl-application-modal-actions,\.sl-staff-usage-form-actions\) \{[\s\S]*?border-top: 1px solid var\(--sl-border-subtle\);/);
  // The footer separator is drawn once by the shared rule: no per-dialog duplicate is added.
  assert.equal(/\.sl-manager-usage-live[^{]*\.sl-application-modal-actions\s*\{[^}]*border-top/.test(styles), false);
  // Both Manager dialogs are the shared bulk modal, so no Manager form exists at all.
  const page = read('../src/components/application/ManagerUsageWastePage.tsx');
  assert.match(page, /<InventoryStaffBulkModal mode="usage" open=\{usageOpen\}/);
  assert.match(page, /<InventoryStaffBulkModal mode="waste" open=\{wasteOpen\}/);
  assert.equal(/sl-usage-entry-modal/.test(page), false);
  assert.equal(/<span>Batch ID<\/span>/.test(page), false);
});

// The Manager recording dialogs ARE the locked Inventory Staff bulk dialog: the same
// component rendered, so there is no second composition to keep in step. Reusing the component
// (not its numbers) is the strongest form of the rule - header, field grid, controls, bulk-item
// workflow and footer all come from the one approved implementation.
test('Manager recording dialogs are the locked Inventory Staff bulk dialog, not a copy', () => {
  const page = read('../src/components/application/ManagerUsageWastePage.tsx');
  // Both modes render the locked component itself.
  assert.match(page, /<InventoryStaffBulkModal mode="usage" open=\{usageOpen\}/);
  assert.match(page, /<InventoryStaffBulkModal mode="waste" open=\{wasteOpen\}/);
  // The page carries no recording form, class chain, or field markup of its own.
  assert.equal(/sl-bulk-recording-row/.test(page), false);
  assert.equal(/sl-usage-entry-modal/.test(page), false);
  assert.equal(/sl-staff-waste-dialog/.test(page), false);
  // The only Ingredient label left on the page belongs to the records filter toolbar.
  assert.match(page, /<span>Ingredient<\/span><FilterSelect/);
  assert.equal((page.match(/<span>Ingredient<\/span><select/g) ?? []).length, 0);
  // No Manager-specific dialog class or rule is introduced anywhere.
  const stylesNoComments = styles.replace(/\/\*[\s\S]*?\*\//g, '');
  assert.equal(/sl-manager-record-dialog/.test(page), false);
  assert.equal(/sl-manager-record-dialog/.test(stylesNoComments), false);
  // The locked Inventory Staff rules the Manager now depends on are present and untouched.
  assert.match(styles, /\.sl-area-dialog\.sl-usage-entry-modal \{[\s\S]*?width: min\(45rem,calc\(100vw - 2rem\)\)!important;/);
  assert.match(styles, /\.sl-inventory-staff-bulk-dialog \.sl-bulk-recording-row \.sl-creation-form-row \{[\s\S]*?grid-template-columns:repeat\(2,minmax\(0,1fr\)\);/);
  assert.match(styles, /\.sl-inventory-staff-bulk-dialog \.sl-bulk-recording-row \.sl-bulk-quantity-input \{[\s\S]*?min-height:48px;/);
  // The locked baseline is reused, never rewritten for the Manager.
  assert.equal(/sl-inventory-staff-bulk-dialog[^{]*\.sl-manager/.test(stylesNoComments), false);
});