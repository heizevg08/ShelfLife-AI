import { CalendarDays } from 'lucide-react';
import { FilterSelect } from './FilterSelect';

export type DateRangeValue = 'any' | 'week' | 'month' | 'quarter' | 'custom';
export const DATE_RANGE_OPTIONS: { value: DateRangeValue; label: string }[] = [
  { value: 'any', label: 'Any date' },
  { value: 'week', label: 'Last 7 Days' },
  { value: 'month', label: 'Last 30 Days' },
  { value: 'quarter', label: 'Last 90 Days' },
  { value: 'custom', label: 'Custom' },
];
export const MANAGER_DATE_RANGE_OPTIONS = DATE_RANGE_OPTIONS.filter(option => option.value !== 'any');

export function DateRangeFilter({ value, from, to, onChange, onFromChange, onToChange, label = 'Date Range', className = '' }: {
  value: DateRangeValue;
  from: string;
  to: string;
  onChange: (value: DateRangeValue) => void;
  onFromChange: (value: string) => void;
  onToChange: (value: string) => void;
  label?: string;
  className?: string;
}) {
  return <div className={`sl-admin-reports-date-group ${className}`.trim()} data-custom={value === 'custom'}>
    <label><span>{label}</span><div className="sl-admin-reports-date"><CalendarDays size={16} aria-hidden="true" /><FilterSelect ariaLabel={label} value={value} options={MANAGER_DATE_RANGE_OPTIONS.map(option => ({value: option.value, label: option.label}))} onChange={next => onChange(next as DateRangeValue)}/></div></label>
    {value === 'custom' && <div className="sl-v219-custom-date-range" aria-label={`Custom ${label.toLowerCase()}`}>
      <label><span>From</span><input type="date" min="2020-01-01" max={to || undefined} value={from} onChange={event => onFromChange(event.target.value)} /></label>
      <label><span>To</span><input type="date" min={from || '2020-01-01'} max="2099-12-31" value={to} onChange={event => onToChange(event.target.value)} /></label>
    </div>}
  </div>;
}
