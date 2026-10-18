export function normalizeEmail(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const email = value.trim().toLowerCase();
  return email.length <= 254 && /^[a-z0-9.!#$%&'*+/=?^_`{|}~-]+@shelflife\.com$/.test(email)
    && !email.startsWith('.') && !email.includes('..') && !email.includes('.@') ? email : null;
}

const personalEmailPattern = /^[a-z0-9.!#$%&'*+/=?^_`{|}~-]+@(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/;
export function normalizePersonalEmail(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const email = value.trim().toLowerCase();
  const local = email.slice(0, email.lastIndexOf('@'));
  return email.length <= 254 && personalEmailPattern.test(email)
    && !local.startsWith('.') && !local.endsWith('.') && !local.includes('..') ? email : null;
}

export function validPassword(value: unknown): value is string {
  return typeof value === 'string' && value.length > 0 && Buffer.byteLength(value, 'utf8') <= 1024;
}
