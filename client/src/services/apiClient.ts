import { currentUser } from './auth';
import { getAccessToken } from './session';

export class ApiError extends Error {
  constructor(public status: number, public code: string, message: string, public details: { field: string; message: string }[] = []) { super(message); }
}
export async function apiClient<T>(path: string, options: RequestInit = {}): Promise<T> {
  // Restore through the existing session owner; never retry a write after an ambiguous failure.
  await currentUser();
  const base = process.env.EXPO_PUBLIC_API_URL?.replace(/\/$/, '') || `http://${typeof window !== 'undefined' && window.location.hostname === 'localhost' ? 'localhost' : '127.0.0.1'}:5000`;
  const response = await fetch(`${base}/api${path}`, { ...options, credentials: 'include', cache: 'no-store',
    headers: { 'Content-Type': 'application/json', ...options.headers, Authorization: `Bearer ${getAccessToken()}` } });
  const body = await response.json();
  if (!response.ok) throw new ApiError(response.status, body.error?.code || 'REQUEST_FAILED', body.error?.message || 'Unable to complete the request', body.error?.details || []);
  return body as T;
}
