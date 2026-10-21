// Only the bearer token is retained. User identity is always fetched from /auth/me.
// Web sessions last for this tab; native sessions are memory-only for this milestone.
let token: string | null = null;
const key = 'shelflifeai.accessToken';

/**
 * The access token held for the current tab.
 *
 * @returns the token, or null when no one is signed in.
 */
export function getAccessToken(): string | null {
  try {
    if (typeof window !== 'undefined' && window.sessionStorage) {
      return window.sessionStorage.getItem(key) || token;
    }
  } catch {
    /* Storage may be unavailable. */
  }
  return token;
}

/**
 * Store the access token used by later API calls.
 *
 * @param value - the token issued at login.
 */
export function setAccessToken(value: string) {
  token = value;
  try {
    if (typeof window !== 'undefined') {
      window.sessionStorage?.setItem(key, value);
    }
  } catch {
    /* Memory-only fallback. */
  }
}

/** Forget the current token and any inherited legacy session key. */
export function clearSession() {
  token = null;
  try {
    if (typeof window !== 'undefined') {
      window.sessionStorage?.removeItem(key);
    }
  } catch {
    /* Storage may be unavailable. */
  }
  try {
    if (typeof window !== 'undefined') {
      window.localStorage?.removeItem('userToken');
    }
  } catch {
    /* Remove inherited session if present. */
  }
}
