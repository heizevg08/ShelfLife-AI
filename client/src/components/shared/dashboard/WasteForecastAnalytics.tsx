/**
 * Shared analytics presentation for Super Admin and Admin dashboards.
 *
 * There is currently no dashboard analytics service wired to this component,
 * so both roles intentionally render the same chart architecture with an
 * honest unavailable state. Do not replace the chart shell with fabricated
 * values: when live analytics arrives, feed it into this shared component.
 */
export function WasteForecastAnalytics() {
  return <section aria-labelledby="sl-analytics-preview-title" className="sl-admin-section">
    <div className="sl-section-heading">
      <div>
        <p className="sl-eyebrow">Analytics</p>
        <h2 id="sl-analytics-preview-title" className="sl-section-title">Waste and Forecast Analytics</h2>
      </div>
    </div>

    <div className="sl-analytics-preview-grid">
      <article className="sl-analytics-preview-card sl-weekly-waste-card" data-tone="attention">
        <h3>Weekly Waste Cost</h3>
        <strong className="sl-analytics-empty-value">—</strong>
        <div className="sl-preview-bars sl-analytics-empty-chart" role="img" aria-label="Weekly waste cost data unavailable">
          <i /><i /><i /><i /><i /><i /><i />
        </div>
        <div className="sl-analytics-axis-labels" aria-hidden="true">
          <span>Mon</span><span>Tue</span><span>Wed</span><span>Thu</span><span>Fri</span><span>Sat</span><span>Sun</span>
        </div>
        <p className="sl-supporting sl-analytics-state-copy">Awaiting waste analytics service</p>
      </article>

      <article className="sl-analytics-preview-card" data-tone="success">
        <div className="sl-analytics-card-heading"><h3>Forecast Accuracy</h3></div>
        <strong className="sl-analytics-empty-value">—</strong>
        <div className="sl-forecast-shell" role="img" aria-label="Forecast accuracy data unavailable">
          <div className="sl-preview-meter sl-analytics-empty-meter"><span /></div>
          <div className="sl-forecast-shell-lines" aria-hidden="true"><i /><i /><i /></div>
        </div>
        <p className="sl-supporting sl-analytics-state-copy">Awaiting forecast analytics service</p>
      </article>

      <article className="sl-analytics-preview-card sl-waste-value-card" data-tone="critical">
        <div className="sl-analytics-card-heading"><h3>30-Day Waste Value</h3></div>
        <strong className="sl-analytics-empty-value">—</strong>
        <div className="sl-preview-bars sl-analytics-empty-chart sl-analytics-empty-chart-compact" role="img" aria-label="30-day waste value data unavailable">
          <i /><i /><i /><i /><i /><i />
        </div>
        <p className="sl-supporting sl-analytics-state-copy">Awaiting waste analytics service</p>
      </article>
    </div>
  </section>;
}
