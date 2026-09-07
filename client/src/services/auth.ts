import { Platform } from 'react-native';
import Constants from 'expo-constants';
import { clearSession, getAccessToken, setAccessToken } from './session';

export interface SessionUser {
  id: string;
  name: string;
  email: string;
  role: 'Super Admin' | 'Admin' | 'Manager' | 'Inventory Staff';
  isActive: boolean;
}
function baseUrl() {
  if (process.env.EXPO_PUBLIC_API_URL) return process.env.EXPO_PUBLIC_API_URL.replace(/\/$/, '');
  if (Platform.OS === 'web') return 'http://127.0.0.1:5000';
  const host = Constants.expoConfig?.hostUri?.split(':')[0] || '10.0.2.2';
  return `http://${host}:5000`;
}
async function request(path: string, options: RequestInit = {}) {
  const response = await fetch(`${baseUrl()}/api/auth/${path}`, { ...options, cache: 'no-store' });
  const body = await response.json();
  if (!response.ok) {
    if (response.status === 401) clearSession();
    throw new Error(typeof body.error === 'string' ? body.error : body.error?.message || 'Authentication failed');
  }
  return body;
}
export async function currentUser(): Promise<SessionUser> {
  const accessToken = getAccessToken();
  if (!accessToken) throw new Error('Authentication required');
  const body = await request('me', { headers: { Authorization: `Bearer ${accessToken}` } });
  return body.user;
}
export async function login(email: string, password: string): Promise<SessionUser> {
  clearSession();
  const body = await request('login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email, password }) });
  if (typeof body.accessToken !== 'string') throw new Error('Authentication failed');
  setAccessToken(body.accessToken);
  try { return await currentUser(); } catch (error) { clearSession(); throw error; }
}
