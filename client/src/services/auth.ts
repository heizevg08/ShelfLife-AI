import { Platform } from 'react-native';
import Constants from 'expo-constants';
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
  role: 'Super Admin' | 'Admin' | 'Manager' | 'Inventory Staff';
  isActive: boolean;
}
function baseUrl() {
  if (process.env.EXPO_PUBLIC_API_URL) return process.env.EXPO_PUBLIC_API_URL.replace(/\/$/, '');
  if (Platform.OS === 'web') return `http://${typeof window !== 'undefined' && window.location.hostname === 'localhost' ? 'localhost' : '127.0.0.1'}:5000`;
  const host = Constants.expoConfig?.hostUri?.split(':')[0] || '10.0.2.2';
  return `http://${host}:5000`;
}
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
