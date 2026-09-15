import { ChevronDown, Download } from 'lucide-react';
import { useState } from 'react';
import { reportExportFormats } from '../../components/application/module-content';
import { Card, PageHeader, PlaceholderTable, SummaryCards } from '../../components/application/primitives';

function MoneyPlaceholder() {
  return <><span aria-hidden="true">₱ —</span><span className="sl-sr-only">Philippine peso value unavailable</span></>;
}

export default function Reports() {
  const [downloadOpen, setDownloadOpen] = useState(false);

  return <>
    <PageHeader eyebrow="Analytics" title="Reports" description="Waste, inventory, and forecast reporting for system-wide oversight." />
    <div className="sl-admin-view">
      <SummaryCards items={[
        { label: 'Inventory value', value: <MoneyPlaceholder />, detail: 'Inventory value trend will appear here', tone: 'brand', trend: 'line' },
        { label: 'Weekly waste cost', value: <MoneyPlaceholder />, detail: 'Weekly waste trend will appear here', tone: 'attention', trend: 'line' },
        { label: 'Forecast accuracy', value: '—%', detail: 'Accuracy history will appear here', tone: 'success', trend: 'accuracy' },
        { label: '30-day waste value', value: <MoneyPlaceholder />, detail: '30-day waste trend will appear here', tone: 'critical', trend: 'bars' },
      ]} />

      <div className="sl-report-grid sl-report-grid-v4">
        <Card id="sl-weekly-waste-preview" title="Weekly Waste Cost">
          {/* TODO: Replace this empty chart scaffold with a PHP-formatted waste-cost series from the reporting service. */}
          <div className="sl-chart-panel sl-chart-panel-wide" role="img" aria-label="Weekly waste cost chart awaiting backend data">
            <div className="sl-chart-y-label">PHP (₱)</div>
            <div className="sl-chart-grid" aria-hidden="true"><i /><i /><i /><i /></div>
            <div className="sl-chart-empty-message">Weekly waste-cost data will appear here</div>
            <div className="sl-chart-x-axis" aria-hidden="true">{['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map(day => <span key={day}>{day}</span>)}</div>
          </div>
        </Card>

        <Card id="sl-forecast-accuracy-preview" title="Predicted vs Actual Waste">
          {/* TODO: Plot actual forecast and waste values from the reporting/forecasting APIs. */}
          <div className="sl-comparison-chart" role="img" aria-label="Predicted versus actual waste chart awaiting backend data">
            <div className="sl-comparison-legend" aria-hidden="true"><span><i data-series="predicted" />Predicted</span><span><i data-series="actual" />Actual</span></div>
            <div className="sl-comparison-plot" aria-hidden="true"><i /><i /><i /></div>
            <p className="sl-supporting">Comparison data will appear here</p>
          </div>
        </Card>
      </div>

      <Card id="sl-high-waste-breakdown" title="High-Waste Breakdown">
        <PlaceholderTable
          label="High-waste ingredient breakdown"
          columns={['Ingredient', 'Waste cost (₱)', 'Quantity wasted', 'Mitigation action']}
          description="High-waste ingredients will appear here when reporting services are connected."
          rows={4}
        />
      </Card>

      <div className="sl-download-control">
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
        {downloadOpen && <div id="sl-report-download-menu" className="sl-download-menu" role="menu" aria-label="Report download formats">
          {reportExportFormats.map(format => <button key={format.id} type="button" role="menuitem" disabled className="sl-download-option"><span>{format.label}</span></button>)}
          <p className="sl-supporting">Downloads activate when the reporting backend and export permissions are available.</p>
        </div>}
      </div>
    </div>
  </>;
}