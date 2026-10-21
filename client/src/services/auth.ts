import { apiBaseUrl } from './config';
import { clearSession, getAccessToken, setAccessToken } from './session';

/** Preserve HTTP status so callers distinguish rejected credentials from outages. */
export class AuthRequestError extends Error {
  constructor(public readonly status: number, message: string) {
    super(message);
    this.name = 'AuthRequestError';
  }
}

/** Server-authoritative account identity and access state for the current session. */
export interface SessionUser {
  id: string;
  name: string;
  // Authoritative name parts, used instead of splitting the combined display name.
  firstName?: string;
  lastName?: string;
  email: string;
  role: 'Super Admin' | 'Admin' | 'Manager' | 'Inventory Staff';
  isActive: boolean;
  mustChangePassword?: boolean;
  lastLoginAt?: string;
  createdAt: string;
  updatedAt: string;
}

/**
 * Replace legacy role-label names without rewriting real personal names.
 * @param user - Session name and role from the server.
 * @returns Display name or role fallback.
 */
export function sessionDisplayName(user: Pick<SessionUser, 'name' | 'role'>): string {
  const name = user.name?.trim();
  if (user.role === 'Admin' && (!name || name === 'Super Admin')) return 'Admin';
  if (user.role === 'Super Admin' && (!name || name === 'Admin')) return 'Super Admin';
  return name || user.role;
}

/**
 * Initials for a user avatar.
 *
 * Falls back from first and last name to the display name, and finally to the
 * first letter of the role, so the avatar is never empty.
 *
 * @param user - Authoritative name parts, display name, and role fallback.
 * @returns One or two uppercase letters.
 */
export function sessionInitials(user: Pick<SessionUser, 'name' | 'role'> & Partial<Pick<SessionUser, 'firstName' | 'lastName'>>): string {
  // Prefer authoritative name parts so profile edits update initials immediately.
  // Older records fall back to their display name or role.
  const parts = [user.firstName, user.lastName].map(part => part?.trim()).filter((part): part is string => !!part);
  const source = parts.length ? parts : sessionDisplayName(user).split(/\s+/).filter(Boolean);
  return source.slice(0, 2).map(part => part[0]).join('').toUpperCase();
}
const baseUrl = () => apiBaseUrl;
// Every authenticated call must carry the bearer token. Only the sign-in, refresh and recovery
// endpoints are anonymous, so the token is attached here rather than at each call site where it
// could be forgotten.
let cachedUser: SessionUser | null = null;
let cachedToken: string | null = null;
let inflightUser: Promise<SessionUser> | undefined;
async function request(path: string, options: RequestInit = {}) {
  const accessToken = getAccessToken();
  const headers = new Headers(options.headers);
  if (accessToken) headers.set('Authorization', `Bearer ${accessToken}`);
  if (options.method && options.method !== 'GET') { cachedUser = null; cachedToken = null; }
  const response = await fetch(`${baseUrl()}/api/auth/${path}`, { ...options, headers, credentials: 'include', cache: 'no-store' });
  if (response.status === 204) return;
  const body = await response.json();
  if (!response.ok) {
    if (response.status === 401) { cachedUser = null; cachedToken = null; clearSession(); }
    throw new AuthRequestError(response.status, typeof body.error === 'string' ? body.error : body.error?.message || 'Authentication failed');
  }
  return body;
}
async function userFromAccessToken(): Promise<SessionUser> {
  const token = getAccessToken();
  if (token && cachedUser && cachedToken === token) return cachedUser;
  return inflightUser ??= request('me').then(body => {
    cachedUser = body.user;
    cachedToken = getAccessToken();
    return body.user as SessionUser;
  }).finally(() => { inflightUser = undefined; });
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

/**
 * Read the signed-in user from the server.
 *
 * The server is asked rather than the stored copy, so a token that was revoked
 * elsewhere cannot keep a session alive.
 *
 * @returns the session user.
 * @throws AuthRequestError when authentication fails or the server rejects the session.
 */
export async function currentUser(): Promise<SessionUser> {
  // The token is attached inside request(), so an empty token still fails closed with a 401
  // and falls through to the refresh path below.
  if (getAccessToken()) {
    try { return await userFromAccessToken(); }
    catch (error) { if (!(error instanceof AuthRequestError) || error.status !== 401) throw error; }
  }
  return refreshing ??= refreshSession().finally(() => { refreshing = undefined; });
}

/**
 * End the session locally and ask the server to end it too.
 *
 * @returns resolves once the local session is cleared, even when the server call fails.
 */
export async function logout(): Promise<void> {
  const revoke = async () => { await request('logout', { method: 'POST' }); clearSession(); };
  if (typeof navigator !== 'undefined' && navigator.locks) await navigator.locks.request('shelflifeai-session', revoke);
  else await revoke();
}
export const recoveryAvailability = () => request('password-reset/availability') as Promise<{ available: boolean }>;
// Authenticated self-service change. The account comes from the bearer token on the server,
// so no user identifier is ever sent from the browser.
export const changePassword = (currentPassword: string, newPassword: string) =>
  request('password/change', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ currentPassword, newPassword }) }) as Promise<{ message: string }>;
// Self-service name update, available to every authenticated role. The server takes the
// account from the bearer token and refuses every other field, so no identifier is ever sent.
export const updateProfile = (changes: { firstName?: string; lastName?: string }) =>
  request('profile', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(changes) }) as Promise<{ message: string; user: SessionUser }>;
export const emailChangeAvailability = () => request('email/change/availability') as Promise<{ available: boolean }>;
export const requestEmailChange = (email: string, currentPassword: string) =>
  request('email/change/request', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email, currentPassword }) }) as Promise<{ message: string }>;
export const completeEmailChange = (code: string) =>
  request('email/change/complete', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ code }) }) as Promise<{ message: string }>;
export const requestPasswordReset = (email: string) => request('password-reset/request', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email }) });
export const completePasswordReset = (token: string, password: string) => request('password-reset/complete', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ token, password }) });

/**
 * Exchange credentials for a session and store the access token.
 *
 * @param email - the account email.
 * @param password - the account password.
 * @param rememberMe - keep the session across browser restarts.
 * @returns the signed-in user.
 * @throws AuthRequestError when credentials are rejected or the account is inactive.
 */
export async function login(email: string, password: string, rememberMe = false): Promise<SessionUser> {
  clearSession();
  const body = await request('login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email, password, rememberMe }) });
  if (typeof body.accessToken !== 'string') throw new Error('Authentication failed');
  setAccessToken(body.accessToken);
  try { return await userFromAccessToken(); } catch (error) { clearSession(); throw error; }
}
