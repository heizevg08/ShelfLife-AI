type DateValue = string | Date;

const dateFormatter = new Intl.DateTimeFormat(undefined, { dateStyle: 'medium' });
const dateTimeFormatter = new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short', hour12: true });
const timeFormatter = new Intl.DateTimeFormat(undefined, { hour: 'numeric', minute: '2-digit', hour12: true });

function dateOnlyValue(value: DateValue) {
  if (typeof value !== 'string') return new Date(value);
  const match = /^(\d{4})-(\d{2})-(\d{2})(?:T00:00:00(?:\.000)?Z)?$/.exec(value);
  return match ? new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3])) : new Date(value);
}

export function formatDate(value: DateValue) {
  return dateFormatter.format(dateOnlyValue(value));
}

export function formatDateTime(value: DateValue) {
  return dateTimeFormatter.format(new Date(value));
}

export function formatTime(value: DateValue) {
  return timeFormatter.format(new Date(value));
}
