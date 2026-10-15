// DEVELOPMENT-ONLY preview of the two Manager Forecasting panels.
//
// WHY THIS IS A SEPARATE PAGE AND NOT THE PRODUCTION ROUTE: Manager /Forecasting has no
// forecasting service, no model and no stored forecast records. Rendering sample numbers
// there - even labelled - would put invented quantities on a live decision-support
// surface, which the project forbids. This page exists so the designs can be inspected,
// polished and approved as UI before any forecasting service exists.
//
// THREE INDEPENDENT GUARDS keep it out of production:
//   1. The route is added only when import.meta.env.DEV is true, so a production build
//      never registers the path at all.
//   2. The page itself returns null outside development, so even a stray import cannot
//      render sample data.
//   3. Every sample value comes from forecast-sample-data.ts, and the route is not
//      linked from any workspace navigation.
//
// It reads no API, writes nothing, imports no dataset and computes no prediction.

import { useState } from 'react';
import { Card, PageHeader } from '../../components/application/primitives';
import { ForecastInsightCards, ForecastInsightsEmpty, ForecastVsActualChart, ForecastVsActualLegend } from '../../components/application/ManagerForecastCharts';
import {
  FORECAST_SAMPLE_INSIGHTS,
  FORECAST_SAMPLE_SERIES,
  FORECAST_SAMPLE_VS_ACTUAL,
} from '../../components/application/forecast-sample-data';
import type { ForecastSeriesKey } from '../../components/application/forecast-chart-data';

export default function Page() {
  // Guard 2: outside development the page renders nothing at all.
  if (!import.meta.env.DEV) return null;
  return <ForecastPreview />;
}

function ForecastPreview() {
  const [visible, setVisible] = useState<Record<ForecastSeriesKey, boolean>>({ forecast: true, actual: true });
  const toggle = (series: ForecastSeriesKey) => setVisible(current => ({ ...current, [series]: !current[series] }));

  return <>
    <PageHeader
      eyebrow="Development only"
      title="Forecasting panel preview"
      description="Design preview of the two Manager Forecasting panels. Every value below is invented sample data, not a forecast."
    />
    <div className="sl-admin-view sl-mgr-fc-preview">
      {/* Prominent and first, so a screenshot of this page can never be mistaken for a
          working forecasting feature. */}
      <p className="sl-mgr-fc-sample-banner" role="note">
        <strong>SAMPLE DATA — UI PREVIEW ONLY.</strong> These numbers are hand-written fixtures for reviewing the panel designs.
        They are not model output, they are not historical records, and no forecasting service is connected.
      </p>

      <section className="sl-mgr-fc-preview-grid" aria-label="Forecasting panel previews">
        <Card
          id="preview-v-actual"
          title="Forecast vs. Actual"
          action={<ForecastVsActualLegend visible={visible} onToggle={toggle} />}
        >
          <ForecastVsActualChart
            ariaLabel="Sample forecast and actual consumption by date"
            points={FORECAST_SAMPLE_VS_ACTUAL}
            meta={FORECAST_SAMPLE_SERIES}
            visible={visible}
          />
        </Card>

        <Card id="preview-insights" title="Forecast Insights">
          <ForecastInsightCards
            ariaLabel="Sample ranked forecasting insights"
            insights={FORECAST_SAMPLE_INSIGHTS}
          />
        </Card>
      </section>

      {/* The empty compositions are previewed alongside the populated ones. These are the
          states the production route actually renders today, so what the Manager sees is
          reviewed here rather than only the sample-filled panels. */}
      <section className="sl-mgr-fc-preview-grid" aria-label="Forecasting empty-state previews">
        <Card id="preview-v-actual-empty" title="Forecast vs. Actual (empty state)">
          <ForecastVsActualChart
            ariaLabel="Forecast versus actual consumption, empty state"
            points={[]}
            meta={FORECAST_SAMPLE_SERIES}
            visible={visible}
            emptyLabel="No live records yet"
            emptyDescription="Forecasted and actual consumption will be plotted here once a validated forecasting service supplies them."
          />
        </Card>
        <Card id="preview-insights-empty" title="Forecast Insights (empty state)">
          <ForecastInsightsEmpty />
        </Card>
      </section>

      <p className="sl-mgr-fc-preview-note">
        The production Manager Forecasting page keeps its truthful pending state until a real forecasting service is
        available. This preview is development-only and is absent from a production build.
      </p>
    </div>
  </>;
}
