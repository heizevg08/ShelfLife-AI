import { Link, type Href } from 'expo-router';
import { ArrowRight, FileInput, Filter, Info, Plus, Search } from 'lucide-react';
import { useEffect, useMemo, useRef, useState, type FormEvent } from 'react';
import { AccountsTable } from './AccountsTable';
import { useApplicationWorkspace } from './ApplicationWorkspace';
import { Dialog } from './Dialog';
import { moduleContent, previewFields, type PreviewId } from './module-content';
import { Card, PageHeader, PlaceholderSummaryCards, PlaceholderTable, Status, SummaryCards } from './primitives';
import { modules, type ModuleId } from './workspace';
import { accountSummary } from '../../services/administration';


const INGREDIENT_CATEGORIES = ['Dairy', 'Produce', 'Bakery', 'Pantry', 'Meat', 'Seafood', 'Frozen', 'Beverages', 'Other'] as const;
type IngredientDraft = { name: string; brand: string; category: string; unit: string; minStock: string; unitCost: string; shelfLife: string; description: string };
const emptyIngredient: IngredientDraft = { name:'', brand:'', category:'', unit:'', minStock:'', unitCost:'', shelfLife:'', description:'' };

function IngredientForm({ onSaved, onCancel }: { onSaved: (item: IngredientDraft) => void; onCancel: () => void }) {
  const [form, setForm] = useState<IngredientDraft>(emptyIngredient);
  const [error, setError] = useState('');
  const set = (key: keyof IngredientDraft, value: string) => setForm(current => ({ ...current, [key]: value }));
  const submit = (event: FormEvent) => {
    event.preventDefault(); setError('');
    if (!form.name.trim() || !form.category || !form.unit.trim()) { setError('Name, category, and unit of measure are required.'); return; }
    if ([form.minStock, form.unitCost, form.shelfLife].some(value => value !== '' && Number(value) < 0)) { setError('Stock, cost, and shelf life cannot be negative.'); return; }
    onSaved({ ...form, name: form.name.trim(), brand: form.brand.trim(), unit: form.unit.trim(), description: form.description.trim() });
  };
  return <form id="sl-ingredient-form" className="sl-preview sl-live-ingredient-form" onSubmit={submit}>
    {error && <p className="sl-inline-notice sl-inline-notice-error" role="alert">{error}</p>}
    <div className="sl-form-grid">
      <label>Name<input className="sl-admin-input" value={form.name} onChange={e => set('name', e.target.value)} required /></label>
      <label>Brand<input className="sl-admin-input" value={form.brand} onChange={e => set('brand', e.target.value)} /></label>
      <label>Category<select className="sl-admin-input" value={form.category} onChange={e => set('category', e.target.value)} required><option value="">Select category</option>{INGREDIENT_CATEGORIES.map(value => <option key={value}>{value}</option>)}</select></label>
      <label>Unit of measure<input className="sl-admin-input" value={form.unit} onChange={e => set('unit', e.target.value)} required /></label>
      <label>Minimum stock<input className="sl-admin-input" type="number" min="0" step="any" value={form.minStock} onChange={e => set('minStock', e.target.value)} /></label>
      <label>Standard unit cost<input className="sl-admin-input" type="number" min="0" step="0.01" value={form.unitCost} onChange={e => set('unitCost', e.target.value)} /></label>
      <label>Default shelf life (days)<input className="sl-admin-input" type="number" min="0" step="1" value={form.shelfLife} onChange={e => set('shelfLife', e.target.value)} /></label>
      <label>Description<input className="sl-admin-input" value={form.description} onChange={e => set('description', e.target.value)} /></label>
    </div>
  </form>;
}

export function WorkspaceLink({ to, children, primary = false }: { to: string; children: React.ReactNode; primary?: boolean }) {
  return <Link href={to as Href} className={`sl-button${primary ? ' sl-button-primary' : ''}`}>{children}</Link>;
}
export function ForecastFlow() {
  return <section className="sl-forecast-flow" aria-label="Forecasting workflow">
    {['Historical usage', 'Current stock & expiry', 'Demand forecast', 'Expiration risk', 'Recommended actions'].map((label, index) => <div key={label}>
      {index > 0 && <ArrowRight size={16} aria-hidden="true" />}<span>{label}</span>
    </div>)}
  </section>;
}
function FormPreview({ id }: { id: PreviewId }) {
  return <div className="sl-preview">
    <p className="sl-inline-notice"><Info size={18} aria-hidden="true" />Form preview only. Entry and saving will become available when the required records are connected.</p>
    <fieldset disabled className="sl-form-grid"><legend className="sl-sr-only">Unavailable {id} form</legend>
      {previewFields[id].map(label => <label key={label}>{label}<input className="sl-admin-input" /></label>)}
    </fieldset>
    {(id === 'Usage' || id === 'Waste') && <p className="sl-supporting">Recorded by your authenticated account. Available quantity and batch eligibility are validated before saving.</p>}
  </div>;
}

function IngredientsAdminPage({ preview, setPreview }: { preview: PreviewId | null; setPreview: (value: PreviewId | null) => void }) {
  const [categoryOpen, setCategoryOpen] = useState(false);
  const [category, setCategory] = useState('All');
  const [search, setSearch] = useState('');
  const [items, setItems] = useState<(IngredientDraft & { id:string; createdBy:string })[]>([]);
  const menuRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const close = (event: MouseEvent) => { if (!menuRef.current?.contains(event.target as Node)) setCategoryOpen(false); };
    document.addEventListener('mousedown', close); return () => document.removeEventListener('mousedown', close);
  }, []);
  const visible = useMemo(() => items.filter(item => (category === 'All' || item.category === category) && `${item.name} ${item.brand}`.toLowerCase().includes(search.toLowerCase())), [items, category, search]);
  const save = (draft: IngredientDraft) => {
    setItems(current => [...current, { ...draft, id: `local-${Date.now()}`, createdBy: 'Admin' }]);
    setPreview(null);
  };
  return <>
    <div className="sl-ingredients-master-heading">
      <PageHeader title="Ingredients" description="Global repository for registered kitchen ingredients and base specs." />
      <div className="sl-ingredients-master-tools">
        <div className="sl-directory-search" role="search"><Search size={17} aria-hidden="true" /><input type="search" placeholder="Search ingredients..." aria-label="Search ingredients" value={search} onChange={e => setSearch(e.target.value)} /></div>
        <div className="sl-filter-menu" ref={menuRef}><button className="sl-button" type="button" aria-haspopup="menu" aria-expanded={categoryOpen} onClick={() => setCategoryOpen(value => !value)}><Filter size={16} aria-hidden="true" />{category === 'All' ? 'Category Filter' : category}</button>{categoryOpen && <div className="sl-filter-popover" role="menu">{['All', ...INGREDIENT_CATEGORIES].map(value => <button key={value} type="button" role="menuitemradio" aria-checked={category === value} onClick={() => { setCategory(value); setCategoryOpen(false); }}>{value === 'All' ? 'All categories' : value}</button>)}</div>}</div>
        <button className="sl-button sl-button-primary" type="button" onClick={() => setPreview('Ingredients')}><Plus size={16} aria-hidden="true" />Add Ingredient</button>
      </div>
    </div>
    <div className="sl-admin-view sl-ingredients-master-view">
      <section className="sl-ingredients-master-table" aria-label="Ingredients">
        <div className="sl-table-scroll"><table className="sl-data-table"><thead><tr>{['Name','Brand','Category','Unit','Min Stock','Unit Cost','Shelf Life','Created By','Actions'].map(column => <th key={column}>{column}</th>)}</tr></thead><tbody>{visible.length ? visible.map(item => <tr key={item.id}><td>{item.name}</td><td>{item.brand || '—'}</td><td><Status>{item.category}</Status></td><td>{item.unit}</td><td>{item.minStock || '—'}</td><td>{item.unitCost ? `₱${Number(item.unitCost).toFixed(2)}` : '—'}</td><td>{item.shelfLife ? `${item.shelfLife} days` : '—'}</td><td>{item.createdBy}</td><td>—</td></tr>) : <tr><td colSpan={9} className="sl-empty-table-message">{items.length ? 'No ingredients match the selected filters.' : 'No live ingredient records yet — add an ingredient to begin.'}</td></tr>}</tbody></table></div>
      </section>
      <div className="sl-system-pagination" aria-label="Ingredients pagination"><button className="sl-button" disabled>Previous</button><button className="sl-button sl-page-number sl-page-number-active" aria-current="page">1</button><button className="sl-button" disabled>Next</button></div>
    </div>
    <Dialog open={preview === 'Ingredients'} title="Ingredient form" onDismiss={() => setPreview(null)} actions={<><button className="sl-button" type="button" onClick={() => setPreview(null)}>Cancel</button><button className="sl-button sl-button-primary" type="submit" form="sl-ingredient-form">Save</button></>}><IngredientForm onSaved={save} onCancel={() => setPreview(null)} /></Dialog>
  </>;
}

export function ModulePage({ moduleId }: { moduleId: ModuleId }) {
  const { user } = useApplicationWorkspace();
  const [preview, setPreview] = useState<PreviewId | null>(null);
  const [accountTotals, setAccountTotals] = useState<{ totalUsers: number; activeUsers: number; inactiveUsers: number } | null>(null);
  const [accountTotalsError, setAccountTotalsError] = useState(false);
  useEffect(() => {
    if (moduleId !== 'UserManagement') return;
    const abort = new AbortController(); setAccountTotalsError(false);
    accountSummary(abort.signal).then(setAccountTotals).catch(() => { if (!abort.signal.aborted) setAccountTotalsError(true); });
    return () => abort.abort();
  }, [moduleId]);
  const staff = user.role === 'Inventory Staff';
  if (moduleId === 'UserManagement') return <>
    <PageHeader eyebrow="Administration" title="User Management" description="Control access, manage permissions, and monitor system participants." />
    <div className="sl-admin-view sl-user-management-view">
      {/* TODO: Replace these preview values with account-summary / invitation data when those backend aggregates are available. */}
      <SummaryCards items={[
        { label: 'Total users', value: accountTotals?.totalUsers.toLocaleString() ?? (accountTotalsError ? 'Unavailable' : 'Loading…'), detail: 'Directory total from live account data', tone: 'brand', trend: 'line' },
        { label: 'Active users', value: accountTotals?.activeUsers.toLocaleString() ?? (accountTotalsError ? 'Unavailable' : 'Loading…'), detail: 'Active account total', tone: 'success', trend: 'accuracy' },
        { label: 'Pending invites', value: '—', detail: 'Invitation service not connected', tone: 'attention', trend: 'segments' },
        { label: 'Deactivated', value: accountTotals?.inactiveUsers.toLocaleString() ?? (accountTotalsError ? 'Unavailable' : 'Loading…'), detail: 'Inactive account total', tone: 'critical', trend: 'bars' },
      ]} />
      <section className="sl-user-management-panel" aria-label="User account directory">
        <AccountsTable />
      </section>

    </div>
  </>;
  if (moduleId === 'Ingredients' && user.role === 'Admin') return <IngredientsAdminPage preview={preview} setPreview={setPreview} />;

  if (moduleId === 'Roles') return <>
    <PageHeader eyebrow="Administration" title="Role responsibilities" description="Four defined roles. Permissions are enforced by the application." />
    <div className="sl-admin-view"><Card id="role-responsibilities" title="Access boundaries"><dl className="sl-guidance-list">
      {[['Super Admin', 'System-wide administration, Admin accounts and protected security oversight.'], ['Admin', 'Operational accounts, ingredient master data and administrative monitoring.'], ['Manager', 'Inventory oversight, request review and decision support.'], ['Inventory Staff', 'Stock-in, usage, waste and own change requests.']].map(([title, text]) => <div key={title}><dt>{title}</dt><dd>{text}</dd></div>)}
    </dl></Card></div>
  </>;
  if (moduleId === 'StockIn') return <>
    <PageHeader eyebrow="Inventory" title="Stock-In" description="Receive a new inventory batch against an existing ingredient." />
    <div className="sl-admin-view"><div className="sl-module-columns"><Card id="stock-in" title="Receive stock"><FormPreview id="StockIn" /></Card><Card id="stock-in-guide" title="Before receiving">
      <dl className="sl-guidance-list"><div><dt>Choose an ingredient</dt><dd>Use the approved catalogue and its unit of measure.</dd></div><div><dt>Record the batch</dt><dd>Capture the received quantity, cost and actual expiration date.</dd></div></dl><div className="sl-related-actions"><WorkspaceLink to="/InventoryBatches">View inventory</WorkspaceLink></div>
    </Card></div></div>
  </>;
  if (moduleId === 'UsageWaste') return <>
    <PageHeader eyebrow="Inventory oversight" title="Usage & Waste" description="Review consumption and loss as separate inventory transactions." />
    <div className="sl-admin-view"><div className="sl-workflow-links">
      <WorkflowLink to="/Usage" title="Usage Records" description="Ingredient consumption and the history behind demand forecasts." />
      <WorkflowLink to="/Waste" title="Waste Records" description="Discarded quantities, reasons and recorded waste cost." />
    </div><div className="sl-transaction-sections"><Card id="usage-history" title="Usage Records"><PlaceholderTable label="Usage records" columns={moduleContent.Usage!.columns} description="Ingredient quantities consumed from inventory batches" /></Card>
      <Card id="waste-history" title="Waste Records"><PlaceholderTable label="Waste records" columns={moduleContent.Waste!.columns} description="Discarded quantities and reasons" /></Card></div></div>
  </>;
  const content = moduleContent[moduleId]!;
  const title = moduleId === 'ChangeRequests' && staff ? 'My Change Requests' : modules[moduleId].label;
  const previewId: PreviewId | undefined = moduleId === 'Ingredients' && user.role === 'Admin' ? 'Ingredients'
    : staff && ['Usage', 'Waste', 'ChangeRequests'].includes(moduleId) ? moduleId as PreviewId : undefined;
  const previewTitle = preview === 'Ingredients' ? 'Ingredient form' : preview === 'ChangeRequests' ? 'Change request form' : preview === 'Usage' ? 'Record usage' : 'Record waste';
  return <>
    <div className="sl-page-heading-row"><PageHeader eyebrow={user.role === 'Admin' ? 'Administration' : 'Inventory & decision support'} title={title} description={content.description} />
      {previewId && <button className="sl-button" onClick={() => setPreview(previewId)}><FileInput size={18} aria-hidden="true" />Preview form</button>}
      {moduleId === 'InventoryBatches' && staff && <WorkspaceLink to="/StockIn" primary>Stock-In</WorkspaceLink>}
    </div>
    <div className="sl-admin-view">
      {content.summaryItems && <PlaceholderSummaryCards items={content.summaryItems} />}
      {(moduleId === 'InventoryBatches' || moduleId === 'ExpirationMonitoring') && <nav className="sl-module-tabs" aria-label="Inventory views">
        <Link href="/InventoryBatches" aria-current={moduleId === 'InventoryBatches' ? 'page' : undefined}>Inventory Batches</Link>
        <Link href="/Ingredients">Ingredients</Link>
        {user.role !== 'Admin' && <Link href="/ExpirationMonitoring" aria-current={moduleId === 'ExpirationMonitoring' ? 'page' : undefined}>Expiration & FEFO</Link>}
      </nav>}
      {(moduleId === 'Usage' || moduleId === 'Waste') && <nav className="sl-module-tabs" aria-label="Transaction views"><Link href="/Usage" aria-current={moduleId === 'Usage' ? 'page' : undefined}>Usage Records</Link><Link href="/Waste" aria-current={moduleId === 'Waste' ? 'page' : undefined}>Waste Records</Link></nav>}
      {moduleId === 'Forecasting' && <ForecastFlow />}
      <div className="sl-module-columns"><Card id={`module-${moduleId}`} title={moduleId === 'ChangeRequests' ? staff ? 'Your submissions' : 'Awaiting review' : content.title}>
        <PlaceholderTable label={content.title} columns={content.columns} description={staff && ['Usage', 'Waste', 'ChangeRequests'].includes(moduleId) ? 'Your records' : content.title} />
      </Card><aside><Card id={`guide-${moduleId}`} title={moduleId === 'Forecasting' ? 'Decision support' : 'Workflow guide'}><dl className="sl-guidance-list">{content.guide.map(item => <div key={item.title}><dt>{item.title}</dt><dd>{item.text}</dd></div>)}</dl></Card></aside></div>
      {moduleId === 'ChangeRequests' && <Card id="request-history" title="Decision history"><PlaceholderTable label="Decision history" columns={['Request', 'Type', 'Target', 'Decision', 'Outcome']} description="Approved and rejected requests" rows={3} /></Card>}
    </div>
    <Dialog open={!!preview} title={previewTitle} onDismiss={() => setPreview(null)} actions={<button className="sl-button" onClick={() => setPreview(null)}>Close preview</button>}>{preview && <FormPreview id={preview} />}</Dialog>
  </>;
}
export function WorkflowLink({ to, title, description }: { to: string; title: string; description: string }) {
  return <Link href={to as Href} className="sl-workflow-link"><span><strong>{title}</strong><span className="sl-supporting">{description}</span></span><ArrowRight size={18} aria-hidden="true" /></Link>;
}