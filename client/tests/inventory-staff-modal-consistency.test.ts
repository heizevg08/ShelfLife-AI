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

test('known Batch Details appearance divergence remains an explicit migration target', () => {
  assert.match(modulePage, /<InventoryBatchDetailsDialog batch=\{viewBatch\} inventoryStaff/);
  assert.match(dashboard, /<InventoryBatchDetailsDialog batch=\{batchDetail\}/);
  assert.doesNotMatch(dashboard, /<InventoryBatchDetailsDialog batch=\{batchDetail\} inventoryStaff/);
  assert.match(styles, /\.sl-staff-inventory-batch-details-dialog\.sl-area-dialog/);
  assert.match(styles, /\.sl-inventory-batch-details-dialog\.sl-area-dialog/);
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
  assert.match(styles, /\.sl-area-dialog\.sl-staff-my-requests-change-request-details-dialog \{[\s\S]*?width:min\(38rem,calc\(100vw - 2rem\)\)!important;/);
  assert.match(styles, /@media \(width<=520px\)[\s\S]*?\.sl-staff-inventory-batch-details-dialog > \.sl-dialog-actions \{ align-items:stretch; flex-direction:column-reverse; \}/);
});
