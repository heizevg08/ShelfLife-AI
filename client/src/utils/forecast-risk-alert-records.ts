import type { ForecastTableRow } from '../services/ingredients';
import { formatCurrentStock } from './current-stock';

export function forecastRiskAlertRecords(rows: ForecastTableRow[], date: string) {
  return rows
    .filter(row => row.riskLevel === 'Critical' || row.riskLevel === 'High')
    .map(row => ({
      id: `forecast-risk:${row.id}`,
      date,
      ingredient: row.name,
      category: 'Forecast Risk' as const,
      details: `${row.riskLevel} shortage risk · ${formatCurrentStock(row.currentStock)} ${row.unit} on hand. ${row.recommendedAction}. 30-day demand: ${formatCurrentStock(row.forecastedDemand)} ${row.unit}`,
      detailSummary: `${row.riskLevel} shortage risk · ${formatCurrentStock(row.currentStock)} ${row.unit} on hand`,
      detailNote: `${row.recommendedAction} · 30-day demand ${formatCurrentStock(row.forecastedDemand)} ${row.unit}`,
      priority: 'High' as const,
      status: 'Active' as const,
    }));
}
