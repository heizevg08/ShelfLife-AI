import { CalendarDays } from 'lucide-react';

export type DateRangeValue = 'any' | 'week' | 'month' | 'year' | 'custom';
export const DATE_RANGE_OPTIONS: { value: DateRangeValue; label: string }[] = [
  { value: 'any', label: 'Any date' },
  { value: 'week', label: 'Last week' },
  { value: 'month', label: 'Last month' },
  { value: 'year', label: 'Last year' },
  { value: 'custom', label: 'Custom' },
];

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
    <label><span>{label}</span><div className="sl-admin-reports-date"><CalendarDays size={16} aria-hidden="true" /><select value={value} onChange={event => onChange(event.target.value as DateRangeValue)} aria-label={label}>{DATE_RANGE_OPTIONS.map(option => <option key={option.value} value={option.value}>{option.label}</option>)}</select></div></label>
    {value === 'custom' && <div className="sl-v219-custom-date-range" aria-label={`Custom ${label.toLowerCase()}`}>
      <label><span>From</span><input type="date" value={from} max={to || undefined} onChange={event => onFromChange(event.target.value)} /></label>
      <label><span>To</span><input type="date" value={to} min={from || undefined} onChange={event => onToChange(event.target.value)} /></label>
    </div>}
  </div>;
}
