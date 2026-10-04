import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

test('Inventory Staff My Requests follows Inventory Batches search proportions and stays adaptive', () => {
  const route = readFileSync(new URL('../src/app/(administration)/ChangeRequests.tsx', import.meta.url), 'utf8');
  const inventoryModule = readFileSync(new URL('../src/components/application/ModulePage.tsx', import.meta.url), 'utf8');
  const styles = readFileSync(new URL('../src/styles/application.css', import.meta.url), 'utf8');
  const rulesStart = styles.lastIndexOf('/* My Requests keeps its custom-range controls and actions in one adaptive layout. */');
  const myRequestsRules = styles.slice(rulesStart);

  assert.match(route, /sl-staff-my-requests-records"><header[^>]*><span className="sl-staff-usage-head-icon"><FileInput aria-hidden="true" \/><\/span><h2>Requests<\/h2>/);
  assert.match(route, /sl-staff-requests-toolbar sl-staff-my-requests-toolbar">/);
  assert.doesNotMatch(route, /data-custom-range=/);
  assert.match(route, /range==='Custom range'&&<div className="sl-v219-custom-date-range"><label><span>From<\/span><input type="date"[\s\S]*?<label><span>To<\/span><input type="date"/);
  assert.match(route, /\{filtered&&<button type="button" className="sl-button sl-staff-clear-filters" onClick=\{reset\}>Reset<\/button>\}/);
  assert.match(route, /\['Request ID','Ingredient','Requested Change','Submitted On','Status'\]/);
  assert.match(route, /<td><span className="sl-canonical-identifier">\{record\.requestID\}<\/span><\/td>/);

  assert.match(inventoryModule, /sl-application-records-toolbar sl-sa-ingredients-filter-card sl-staff-inventory-record-filters" data-layout="inventory-staff"/);
  assert.match(styles, /\.sl-staff-inventory-v149 \.sl-staff-inventory-record-filters \{\s*grid-template-columns: minmax\(14rem,1\.55fr\) minmax\(8\.5rem,\.7fr\) minmax\(8rem,\.65fr\) minmax\(10rem,\.8fr\) auto;/);
  assert.match(myRequestsRules, /\.sl-staff-my-requests-records \.sl-staff-my-requests-toolbar \{\s*align-items:end;\s*flex-wrap:wrap;\s*display:flex;/);
  assert.match(myRequestsRules, /> \.sl-sa-ingredients-search \{\s*flex:1\.55 1 14rem;\s*min-width:14rem;/);
  assert.match(myRequestsRules, /> label:nth-child\(2\) \{\s*flex:\.7 1 8\.5rem;\s*min-width:8\.5rem;/);
  assert.match(myRequestsRules, /> label:nth-child\(3\) \{\s*flex:\.65 1 8rem;\s*min-width:8rem;/);
  assert.match(myRequestsRules, /> label:nth-child\(4\) \{\s*flex:\.8 1 10rem;\s*min-width:10rem;/);
  assert.doesNotMatch(myRequestsRules, /> \.sl-sa-ingredients-search \{[^}]*flex:1 1/);
  assert.match(myRequestsRules, /> \.sl-v219-custom-date-range \{\s*display:contents;/);
  assert.match(myRequestsRules, /> \.sl-v219-custom-date-range > label \{\s*flex:0 1 9\.25rem;\s*min-width:8\.75rem;\s*max-width:10rem;/);
  assert.match(myRequestsRules, /> \.sl-sa-ingredients-filter-actions \{\s*flex:0 0 auto;\s*margin-left:auto;/);
  assert.doesNotMatch(myRequestsRules, /data-custom-range|grid-row:\s*[12]|grid-column:\s*[235] \/ [35]/);
  assert.match(myRequestsRules, /@media \(width<=900px\)[\s\S]*?grid-template-columns:repeat\(2,minmax\(0,1fr\)\);\s*display:grid;/);
  assert.match(myRequestsRules, /@media \(width<=600px\)[\s\S]*?grid-template-columns:minmax\(0,1fr\)/);

  assert.match(myRequestsRules, /\.sl-staff-my-requests-table :is\(thead th,tbody td\):first-child \{\s*text-align:left!important;/);
  assert.match(myRequestsRules, /\.sl-staff-my-requests-table :is\(thead th,tbody td\):not\(:first-child\) \{\s*text-align:center!important;/);
  assert.match(myRequestsRules, /\.sl-staff-my-requests-table tbody td:last-child \.sl-status \{\s*margin-inline:auto;/);
  assert.match(styles, /\.sl-staff-requests-v162 \.sl-staff-my-requests-table \.sl-canonical-identifier \{ font-weight:600; \}/);
  assert.doesNotMatch(myRequestsRules, /sl-staff-inventory-|sl-admin-|sl-manager-|sl-superadmin-|position:absolute|margin:\s*-|overflow-x/);
});
