import { CalendarDays, ChevronDown, Download, Filter } from 'lucide-react';
import { useState } from 'react';
import { reportExportFormats } from '../../components/application/module-content';
import { Card, DataState, PageHeader, Status } from '../../components/application/primitives';

function PendingPanel({ label, compact = false }: { label: string; compact?: boolean }) {
  return (
    <div className={`sl-sa-reports-pending${compact ? ' compact' : ''}`}>
      <DataState
        kind="empty"
        title="No live records yet"
        description={label}
        action={<Status>Preview · data pending</Status>}
      />
    </div>
  );
}

export default function Reports() {
  const [downloadOpen, setDownloadOpen] = useState(false);

  return <>
    <PageHeader
      eyebrow="Analytics"
      title="Reports"
      description="Waste, inventory, and forecast reporting for system-wide oversight."
    />

    <div className="sl-admin-view sl-sa-reports-page">
      <section className="sl-sa-reports-kpis" aria-label="Reporting summary">
        <article className="sl-sa-reports-kpi" data-tone="brand">
          <div>
            <span>Inventory Value</span>
            <strong>—</strong>
            <small>Awaiting inventory valuation API</small>
          </div>
        </article>

        <article className="sl-sa-reports-kpi" data-tone="attention">
          <div>
            <span>Weekly Waste Cost</span>
            <strong>—</strong>
            <small>Awaiting waste-cost API</small>
          </div>
        </article>

        <article className="sl-sa-reports-kpi" data-tone="success">
          <div>
            <span>Forecast Accuracy</span>
            <strong>—</strong>
            <small>Awaiting forecast accuracy API</small>
          </div>
        </article>

        <article className="sl-sa-reports-kpi" data-tone="critical">
          <div>
            <span>30-Day Waste Value</span>
            <strong>—</strong>
            <small>Awaiting reporting summary API</small>
          </div>
        </article>
      </section>

      <section className="sl-sa-reports-filter-card" aria-label="Report filters">
        <label>
          <span>Date Range</span>
          <div className="sl-sa-reports-date">
            <CalendarDays size={16} aria-hidden="true" />
            <input type="text" value="Data pending" readOnly disabled />
          </div>
        </label>

        <label>
          <span>Report Type</span>
          <select disabled aria-label="Report type filter unavailable">
            <option>All Report Types</option>
          </select>
        </label>

        <label>
          <span>Ingredient</span>
          <select disabled aria-label="Ingredient filter unavailable">
            <option>All Ingredients</option>
          </select>
        </label>

        <div className="sl-sa-reports-filter-actions">
          <button type="button" className="sl-button sl-button-primary" disabled>
            <Filter size={15} aria-hidden="true" />
            Apply Filters
          </button>

          <div className="sl-download-control sl-sa-reports-download">
            <button
              type="button"
              className="sl-button sl-download-trigger"
              aria-expanded={downloadOpen}
              aria-controls="sl-report-download-menu"
              onClick={() => setDownloadOpen(value => !value)}
            >
              <Download size={17} aria-hidden="true" />
              Download
              <ChevronDown size={16} aria-hidden="true" />
            </button>

            {downloadOpen && (
              <div
                id="sl-report-download-menu"
                className="sl-download-menu"
                role="menu"
                aria-label="Report download formats"
              >
                {reportExportFormats.map(format => (
                  <button
                    key={format.id}
                    type="button"
                    role="menuitem"
                    disabled
                    className="sl-download-option"
                  >
                    <span>{format.label}</span>
                  </button>
                ))}
                <p className="sl-supporting">
                  Downloads activate when the reporting backend and export permissions are available.
                </p>
              </div>
            )}
          </div>
        </div>
      </section>

      <div className="sl-sa-reports-grid">
        <Card id="sl-weekly-waste-preview" title="Weekly Waste Cost">
          <PendingPanel label="Weekly waste cost" />
        </Card>

        <Card id="sl-forecast-accuracy-preview" title="Forecast vs Actual Consumption">
          <div className="sl-sa-reports-comparison-labels" aria-hidden="true">
            <span>Forecast</span>
            <span>Actual Consumption</span>
          </div>
          <PendingPanel label="Forecast vs actual consumption" />
        </Card>
      </div>

      <Card id="sl-high-waste-breakdown" title="High-Waste Breakdown">
        <div className="sl-sa-reports-table-shell">
          <div className="sl-sa-reports-table-head" aria-hidden="true">
            <span>Ingredient</span>
            <span>Waste Cost (₱)</span>
            <span>Quantity Wasted</span>
            <span>Waste Reason</span>
          </div>

          <PendingPanel label="High-waste ingredient breakdown" />
        </div>
      </Card>
    </div>
  </>;
}
