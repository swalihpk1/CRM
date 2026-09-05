import React, { createContext, useEffect, useState, useCallback } from 'react';
import * as authApi from '../api/auth';
import { getToken, setToken as persistToken, clearToken, subscribe } from '../lib/tokenStore';

export const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [token, setTokenState] = useState(getToken());
  const [loading, setLoading] = useState(true);

  const fetchUser = useCallback(async () => {
    try {
      const userData = await authApi.getMe();
      setUser(userData);
    } catch (err) {
      // Only clear the session on a genuine auth failure (401 — invalid/
      // expired token), not on any error. Previously this caught ALL
      // errors including transient network failures and called logout()
      // unconditionally, force-logging-out users on a flaky connection.
      // apiClient's response interceptor already clears the token store on
      // a real 401 (which is what triggers the tokenStore subscription
      // below); here we just also clear local `user` state so the UI
      // reflects it immediately without waiting for that subscription tick.
      if (err.status === 401) {
        setUser(null);
      }
      // Network errors: leave `user` as-is (null, since we haven't loaded
      // it yet) — the UI will show the auth page, and a retry can succeed
      // once connectivity returns, rather than being treated as a logout.
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (token) {
      fetchUser();
    } else {
      setLoading(false);
    }
  }, [token]);

  // React to token changes triggered from outside this component — e.g.
  // apiClient's response interceptor calling clearToken() on a 401 from
  // some arbitrary API call, not just from this provider's own login/logout.
  useEffect(() => {
    return subscribe((newToken) => {
      setTokenState(newToken);
      if (!newToken) setUser(null);
    });
  }, []);

  const login = useCallback(async (email, password) => {
    const { token: newToken, user: userData } = await authApi.login({ email, password });
    persistToken(newToken);
    setTokenState(newToken);
    setUser(userData);
  }, []);

  const signup = useCallback(async (email, password) => {
    const { token: newToken, user: userData } = await authApi.signup({ email, password });
    persistToken(newToken);
    setTokenState(newToken);
    setUser(userData);
  }, []);

  const logout = useCallback(() => {
    clearToken();
    setTokenState(null);
    setUser(null);
  }, []);

  return (
    <AuthContext.Provider value={{ user, token, loading, login, signup, logout }}>
      {children}
    </AuthContext.Provider>
  );
}
