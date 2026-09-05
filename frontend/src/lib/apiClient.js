import axios from 'axios';
import { getToken, clearToken } from './tokenStore';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
export const API_BASE_URL = `${BACKEND_URL}/api`;

export const apiClient = axios.create({
  baseURL: API_BASE_URL,
  // Intentionally no default Content-Type here — leaving it unset lets
  // axios infer application/json for plain objects and correctly set the
  // multipart boundary for FormData (contacts/import + contacts/preview
  // uploads), which a global 'application/json' default would break.
});

// Request interceptor: always attach the current token from the single
// source of truth (tokenStore), replacing the old mix of
// axios.defaults.headers.common mutation (set in 3 places) and manual
// per-call `headers: { Authorization: ... }` reads of localStorage
// (6+ call sites, all redundant with the default once it was set).
apiClient.interceptors.request.use((config) => {
  const token = getToken();
  if (token) {
    config.headers = config.headers || {};
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Paths that must NOT trigger the auto-logout-on-401 behavior below, since
// a 401 from these IS the expected "bad credentials" response, not a
// "your session expired" signal.
const AUTH_ENDPOINTS = ['/auth/login', '/auth/signup'];

function isAuthEndpoint(url = '') {
  return AUTH_ENDPOINTS.some((path) => url.includes(path));
}

// Response interceptor: normalize every error into a stable shape so
// components never touch axios/error internals directly.
//
// IMPORTANT: `detail` must stay the raw backend string as-is. The backend
// (both the Python and Node ports) always returns {"detail": "..."} on
// error (see backend-node/src/middleware/errorHandler.js), and some
// frontend code string-matches on it (e.g. detail.includes('already
// exists') for the duplicate-contact-phone case) — never reshape/replace
// this string here.
apiClient.interceptors.response.use(
  (response) => response,
  (error) => {
    const status = error.response?.status ?? 0;
    const detail =
      error.response?.data?.detail ??
      (error.request ? 'Network error. Please check your connection.' : error.message) ??
      'Something went wrong';

    const normalized = {
      status,
      detail,
      isNetworkError: !error.response,
      cause: error,
    };

    // Only log out on a GENUINE 401 from a non-auth endpoint. Previously
    // AuthProvider.fetchUser() called logout() in its catch for ANY error
    // — including a transient network blip — which force-logged-out users
    // on flaky connections. A 401 here means the token itself is invalid/
    // expired, which is the only case that should clear the session.
    if (status === 401 && !isAuthEndpoint(error.config?.url)) {
      clearToken();
    }

    return Promise.reject(normalized);
  }
);

export default apiClient;
