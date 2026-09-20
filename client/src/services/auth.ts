import { apiBaseUrl } from './config';
import { clearSession, getAccessToken, setAccessToken } from './session';

// Preserve HTTP status so presentation can distinguish rejected credentials from outages.
export class AuthRequestError extends Error {
  constructor(public readonly status: number, message: string) {
    super(message);
    this.name = 'AuthRequestError';
  }
}

export interface SessionUser {
  id: string;
  name: string;
  email: string;
  role: 'Super Admin' | 'Admin' | 'Inventory Manager' | 'Inventory Staff';
  isActive: boolean;
}

// Normalize only known legacy role-label identities. Real personal names remain untouched.
export function sessionDisplayName(user: Pick<SessionUser, 'name' | 'role'>): string {
  const name = user.name?.trim();
  if (user.role === 'Admin' && (!name || name === 'Super Admin')) return 'Admin';
  if (user.role === 'Super Admin' && (!name || name === 'Admin')) return 'Super Admin';
  return name || user.role;
}

export function sessionInitials(user: Pick<SessionUser, 'name' | 'role'>): string {
  return sessionDisplayName(user).split(/\s+/).filter(Boolean).map(part => part[0]).slice(0, 2).join('').toUpperCase();
}
const baseUrl = () => apiBaseUrl;
async function request(path: string, options: RequestInit = {}) {
  const response = await fetch(`${baseUrl()}/api/auth/${path}`, { ...options, credentials: 'include', cache: 'no-store' });
  if (response.status === 204) return;
  const body = await response.json();
  if (!response.ok) {
    if (response.status === 401) clearSession();
    throw new AuthRequestError(response.status, typeof body.error === 'string' ? body.error : body.error?.message || 'Authentication failed');
  }
  return body;
}
async function userFromAccessToken(): Promise<SessionUser> {
  const accessToken = getAccessToken();
  if (!accessToken) throw new Error('Authentication required');
  const body = await request('me', { headers: { Authorization: `Bearer ${accessToken}` } });
  return body.user;
}
let refreshing: Promise<SessionUser> | undefined;
async function refreshSession(): Promise<SessionUser> {
  const refresh = async () => {
    const body = await request('refresh', { method: 'POST' });
    if (typeof body.accessToken !== 'string') throw new Error('Authentication failed');
    setAccessToken(body.accessToken);
    return userFromAccessToken();
  };
  // Serialize cookie rotation across tabs where Web Locks is available.
  return typeof navigator !== 'undefined' && navigator.locks
    ? navigator.locks.request('shelflifeai-session', refresh) : refresh();
}
export async function currentUser(): Promise<SessionUser> {
  if (getAccessToken()) {
    try { return await userFromAccessToken(); }
    catch (error) { if (!(error instanceof AuthRequestError) || error.status !== 401) throw error; }
  }
  return refreshing ??= refreshSession().finally(() => { refreshing = undefined; });
}
export async function logout(): Promise<void> {
  const revoke = async () => { await request('logout', { method: 'POST' }); clearSession(); };
  if (typeof navigator !== 'undefined' && navigator.locks) await navigator.locks.request('shelflifeai-session', revoke);
  else await revoke();
}
export const recoveryAvailability = () => request('password-reset/availability') as Promise<{ available: boolean }>;
export const requestPasswordReset = (email: string) => request('password-reset/request', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email }) });
export const completePasswordReset = (token: string, password: string) => request('password-reset/complete', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ token, password }) });
export async function login(email: string, password: string, rememberMe = false): Promise<SessionUser> {
  clearSession();
  const body = await request('login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email, password, rememberMe }) });
  if (typeof body.accessToken !== 'string') throw new Error('Authentication failed');
  setAccessToken(body.accessToken);
  try { return await userFromAccessToken(); } catch (error) { clearSession(); throw error; }
}
