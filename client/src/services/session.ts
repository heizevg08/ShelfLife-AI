// Only the bearer token is retained. User identity is always fetched from /auth/me.
// Sessions last for this browser tab, with an in-memory fallback.
let token: string | null = null;
const key = 'shelflifeai.accessToken';
export function getAccessToken(): string | null {
  try {
    if (typeof window !== 'undefined' && window.sessionStorage) return window.sessionStorage.getItem(key) || token;
  } catch { /* Storage may be unavailable. */ }
  return token;
}
export function setAccessToken(value: string) {
  token = value;
  try { if (typeof window !== 'undefined') window.sessionStorage?.setItem(key, value); } catch { /* Memory-only fallback. */ }
}
export function clearSession() {
  token = null;
  try { if (typeof window !== 'undefined') window.sessionStorage?.removeItem(key); } catch { /* Storage may be unavailable. */ }
  try { if (typeof window !== 'undefined') window.localStorage?.removeItem('userToken'); } catch { /* Remove inherited session if present. */ }
}
