import { Filter, X } from 'lucide-react';
import { useState } from 'react';
import { administrationFilterCatalog } from '../../components/application/administration';
import { Card, PageHeader, PlaceholderSummaryCards, PlaceholderTable } from '../../components/application/primitives';

export default function Alerts() {
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [filters, setFilters] = useState<Record<string, string>>({ type: administrationFilterCatalog.alerts.type[0], severity: administrationFilterCatalog.alerts.severity[0], status: administrationFilterCatalog.alerts.status[0] });

  return <>
    <PageHeader eyebrow="System Controls" title="Alerts" description="Review inventory, expiration, and waste-risk alerts that need attention." />
    <div className="sl-admin-view">
      <PlaceholderSummaryCards items={[
        { label: 'Total alerts', tone: 'brand' },
        { label: 'Critical', tone: 'critical' },
        { label: 'Low stock', tone: 'attention' },
        { label: 'Expiring soon', tone: 'attention' },
      ]} />

      <Card
        id="sl-alert-queue"
        title="Alert Queue"
        action={
          <div className="sl-filter-control">
            <button
              type="button"
              className="sl-icon-button sl-filter-trigger"
              aria-label="Open alert filters"
              aria-expanded={filtersOpen}
              aria-controls="sl-alert-filter-panel"
              onClick={() => setFiltersOpen(value => !value)}
            >
              <Filter size={18} aria-hidden="true" />
            </button>
            {filtersOpen && <div id="sl-alert-filter-panel" className="sl-filter-popover" role="dialog" aria-label="Alert filters">
              <div className="sl-filter-popover-header">
                <strong>Filters</strong>
                <button type="button" className="sl-icon-button sl-close-button" aria-label="Close alert filters" onClick={() => setFiltersOpen(false)}><X size={17} aria-hidden="true" /></button>
              </div>
              <div className="sl-filter-popover-body">
                {Object.entries(administrationFilterCatalog.alerts).map(([key, values]) => <label key={key}>
                  {key === 'type' ? 'Type' : key === 'severity' ? 'Severity' : 'Status'}
                  <select className="sl-admin-input" value={filters[key as keyof typeof filters]} onChange={event => setFilters(current => ({ ...current, [key]: event.target.value }))}>
                    {values.map(value => <option key={value}>{value}</option>)}
                  </select>
                </label>)}
                <button type="button" className="sl-button sl-filter-clear" onClick={() => setFilters({ type: administrationFilterCatalog.alerts.type[0], severity: administrationFilterCatalog.alerts.severity[0], status: administrationFilterCatalog.alerts.status[0] })}>Clear filters</button>
                <p className="sl-supporting" aria-live="polite">Filters are active. They will apply to alert records as soon as the alert service returns data.</p>
              </div>
            </div>}
          </div>
        }
      >
        {/* TODO: Connect this page to the canonical alert service once alert APIs are implemented. */}
        <PlaceholderTable
          label="System alerts"
          columns={['Ingredient', 'Type', 'Severity', 'Message', 'Status', 'Date', 'Actions']}
          description="Alert records will appear here when the alert service is connected."
          rows={6}
        />
      </Card>
    </div>
  </>;
}
