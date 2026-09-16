import { Card } from '../../application/primitives';

export function ChangeRequestOverview() {
  return <Card id="sl-dashboard-requests" title="Change Request Overview">
    {/* TODO: Replace this unavailable-state chart with backend-derived request aggregates. */}
    <div className="sl-request-preview">
      <div className="sl-request-donut" role="img" aria-label="Change request distribution awaiting request service">
        <svg viewBox="0 0 120 120" aria-hidden="true">
          <circle className="sl-request-donut-track" cx="60" cy="60" r="44" />
          <circle className="sl-request-donut-segment sl-request-donut-success" cx="60" cy="60" r="44" pathLength="100" />
          <circle className="sl-request-donut-segment sl-request-donut-attention" cx="60" cy="60" r="44" pathLength="100" />
          <circle className="sl-request-donut-segment sl-request-donut-critical" cx="60" cy="60" r="44" pathLength="100" />
        </svg>
        <strong aria-hidden="true">—</strong>
      </div>
      <div className="sl-preview-legend">
        <span><i className="sl-dot sl-dot-success" /> Approved <strong>—</strong></span>
        <span><i className="sl-dot sl-dot-attention" /> Pending <strong>—</strong></span>
        <span><i className="sl-dot sl-dot-critical" /> Rejected <strong>—</strong></span>
      </div>
      <p className="sl-supporting">Awaiting request service</p>
    </div>
  </Card>;
}
