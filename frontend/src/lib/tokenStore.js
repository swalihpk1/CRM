// Single source of truth for the auth token. A plain module (not React
// context) because the axios interceptor in apiClient.js runs outside the
// React tree and must not import AuthContext (would be circular).
//
// Every component should go through this module rather than reading
// localStorage directly — previously localStorage.getItem('token') was
// re-read ad-hoc in 6+ places across the app with a manually-attached
// Authorization header, inconsistent with the axios default-header path
// used everywhere else.

const STORAGE_KEY = 'token';

let token = null;
try {
  token = localStorage.getItem(STORAGE_KEY);
} catch (e) {
  // localStorage may be unavailable (privacy mode, SSR-like environments) —
  // fail open with no token rather than crashing module load.
  token = null;
}

const listeners = new Set();

function notify() {
  listeners.forEach((listener) => {
    try {
      listener(token);
    } catch (e) {
      // eslint-disable-next-line no-console
      console.error('tokenStore listener threw', e);
    }
  });
}

export function getToken() {
  return token;
}

export function setToken(newToken) {
  token = newToken;
  try {
    if (newToken) {
      localStorage.setItem(STORAGE_KEY, newToken);
    } else {
      localStorage.removeItem(STORAGE_KEY);
    }
  } catch (e) {
    // ignore storage failures — in-memory token still works for this session
  }
  notify();
}

export function clearToken() {
  setToken(null);
}

// Returns an unsubscribe function.
export function subscribe(listener) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}
