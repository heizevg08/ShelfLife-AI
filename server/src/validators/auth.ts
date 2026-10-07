export function normalizeEmail(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const email = value.trim().toLowerCase();
  return email.length <= 254 && /^[a-z0-9.!#$%&'*+/=?^_`{|}~-]+@shelflife\.com$/.test(email)
    && !email.startsWith('.') && !email.includes('..') && !email.includes('.@') ? email : null;
}

export function validPassword(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0 && Buffer.byteLength(value, 'utf8') <= 1024;
}

export type LoginInput = { email: string; password: string; rememberMe: boolean };
export function loginInput(value: unknown): LoginInput | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const input = value as Record<string, unknown>;
  if (Object.keys(input).some(key => !['email', 'password', 'rememberMe'].includes(key))) return null;
  const email = normalizeEmail(input.email);
  if (!email || !validPassword(input.password) || (input.rememberMe !== undefined && typeof input.rememberMe !== 'boolean')) return null;
  return { email, password: input.password, rememberMe: input.rememberMe === true };
}

export function emptyAuthBody(value: unknown): boolean {
  return value === undefined || (!!value && typeof value === 'object' && !Array.isArray(value) && Object.keys(value as Record<string, unknown>).length === 0);
}

export function authBodyFields(value: unknown, fields: readonly string[]): boolean {
  return !!value && typeof value === 'object' && !Array.isArray(value)
    && Object.keys(value as Record<string, unknown>).every(key => fields.includes(key));
}
