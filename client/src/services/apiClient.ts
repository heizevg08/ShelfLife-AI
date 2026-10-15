import { apiBaseUrl } from './config';
import { currentUser } from './auth';
import { getAccessToken } from './session';
import { publishActionFeedback } from './actionFeedback';

export class ApiError extends Error {
  constructor(public status: number, public code: string, message: string, public details: { field: string; message: string }[] = []) { super(message); }
}
type ApiClientOptions = RequestInit & { successMessage?: string | false };

export async function apiClient<T>(path: string, options: ApiClientOptions = {}): Promise<T> {
  const { successMessage = 'Changes saved successfully.', ...requestOptions } = options;
  const method = (requestOptions.method ?? 'GET').toUpperCase();
  const isAction = !['GET', 'HEAD', 'OPTIONS'].includes(method);
  try {
    // Restore through the existing session owner; never retry a write after an ambiguous failure.
    await currentUser();
    const base = apiBaseUrl;
    const response = await fetch(`${base}/api${path}`, { ...requestOptions, credentials: 'include', cache: 'no-store',
      headers: { 'Content-Type': 'application/json', ...requestOptions.headers, Authorization: `Bearer ${getAccessToken()}` } });
    const body = response.status === 204 ? undefined : await response.json().catch(() => undefined);
    if (!response.ok) {
      const message = body?.error?.message || 'Unable to complete the request';
      if (isAction) publishActionFeedback({ kind: 'error', message });
      throw new ApiError(response.status, body?.error?.code || 'REQUEST_FAILED', message, body?.error?.details || []);
    }
    if (isAction && successMessage !== false) publishActionFeedback({ kind: 'success', message: successMessage });
    return body as T;
  } catch (error) {
    if (isAction && !(error instanceof ApiError)) publishActionFeedback({ kind: 'error', message: 'The action could not be completed. Check your connection and try again.' });
    throw error;
  }
}
