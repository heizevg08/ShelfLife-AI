import { Filter, X } from 'lucide-react';
import { useState } from 'react';
import { administrationFilterCatalog } from '../../components/application/administration';
import { Card, PageHeader, PlaceholderSummaryCards, PlaceholderTable } from '../../components/application/primitives';

export default function ChangeRequests() {
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [filters, setFilters] = useState<Record<string, string>>({ status: administrationFilterCatalog.changeRequests.status[0], requestType: administrationFilterCatalog.changeRequests.requestType[0], period: administrationFilterCatalog.changeRequests.period[0] });

  return <>
    <PageHeader eyebrow="System Controls" title="Change Requests" description="Review operational overrides requested by authorized users." />
    <div className="sl-admin-view">
      <PlaceholderSummaryCards items={[
        { label: 'Total requests', tone: 'brand' },
        { label: 'Pending requests', tone: 'attention' },
        { label: 'Approved this month', tone: 'success' },
        { label: 'Rejected this month', tone: 'critical' },
      ]} />

      <Card
        id="sl-change-request-table"
        title="Request Queue"
        action={
          <div className="sl-filter-control">
            <button
              type="button"
              className="sl-icon-button sl-filter-trigger"
              aria-label="Open change request filters"
              aria-expanded={filtersOpen}
              aria-controls="sl-request-filter-panel"
              onClick={() => setFiltersOpen(value => !value)}
            >
              <Filter size={18} aria-hidden="true" />
            </button>
            {filtersOpen && <div id="sl-request-filter-panel" className="sl-filter-popover" role="dialog" aria-label="Change request filters">
              <div className="sl-filter-popover-header">
                <strong>Filters</strong>
                <button type="button" className="sl-icon-button sl-close-button" aria-label="Close change request filters" onClick={() => setFiltersOpen(false)}><X size={17} aria-hidden="true" /></button>
              </div>
              <div className="sl-filter-popover-body">
                {Object.entries(administrationFilterCatalog.changeRequests).map(([key, values]) => <label key={key}>
                  {key === 'status' ? 'Status' : key === 'requestType' ? 'Request type' : 'Date range'}
                  <select className="sl-admin-input" value={filters[key as keyof typeof filters]} onChange={event => setFilters(current => ({ ...current, [key]: event.target.value }))}>
                    {values.map(value => <option key={value}>{value}</option>)}
                  </select>
                </label>)}
                <button type="button" className="sl-button sl-filter-clear" onClick={() => setFilters({ status: administrationFilterCatalog.changeRequests.status[0], requestType: administrationFilterCatalog.changeRequests.requestType[0], period: administrationFilterCatalog.changeRequests.period[0] })}>Clear filters</button>
                <p className="sl-supporting" aria-live="polite">Filters are active. They will apply to request records as soon as the request service returns data.</p>
              </div>
            </div>}
          </div>
        }
      >
        <PlaceholderTable
          label="Change requests"
          columns={['Target', 'Requested by', 'Request type', 'Reason', 'Status', 'Date', 'Actions']}
          description="Operational change requests will appear here when the request service is connected."
          rows={4}
        />
      </Card>

      <Card id="sl-change-request-review" title="Request Review">
        <div className="sl-request-detail-preview">
          <div>
            <span className="sl-supporting">Requested change</span>
            <strong>Select a request when connected</strong>
          </div>
          <div>
            <span className="sl-supporting">Reason for request</span>
            <p>No request is selected because the change-request backend is not connected yet.</p>
          </div>
        </div>
        <div className="sl-review-actions">
          <button className="sl-button" disabled>Reject</button>
          <button className="sl-button sl-button-primary" disabled>Approve</button>
        </div>
      </Card>
    </div>
  </>;
}