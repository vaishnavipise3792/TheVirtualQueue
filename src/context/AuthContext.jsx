/**
 * AuthContext.jsx
 *
 * Provides authentication state for the whole app:
 *   - authUser  : the currently logged-in user object (or null)
 *   - authLoading: true while checking an existing token on boot
 *   - login(credentials, persist) : calls API and stores token
 *   - logout()                    : clears token and redirects
 *
 * View protection helpers:
 *   - isAuthenticated
 *   - hasRole(...roles)
 */

import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { api, tokenStore } from '../utils/api.js';

const AuthContext = createContext(null);

// Mapping: role → default landing view in the SPA
export const ROLE_DEFAULT_VIEW = {
  CUSTOMER:    'landing',
  STAFF:       'staff',
  FRONT_DESK:  'frontdesk',
  ORG_ADMIN:   'admin',
  SUPER_ADMIN: 'admin',  // Super admin shares the admin view with extended privileges
};

// Which nav tabs each role is allowed to see
export const ROLE_ALLOWED_VIEWS = {
  CUSTOMER:    ['landing', 'track', 'display'],
  STAFF:       ['staff', 'display'],
  FRONT_DESK:  ['frontdesk', 'display'],
  ORG_ADMIN:   ['admin', 'display'],
  SUPER_ADMIN: ['admin', 'display', 'acceptance-suite'],
};

export function AuthProvider({ children }) {
  const [authUser, setAuthUser] = useState(null);
  const [authLoading, setAuthLoading] = useState(true);

  // On boot: try to restore session from stored token
  useEffect(() => {
    const token = tokenStore.get();
    if (!token) {
      setAuthLoading(false);
      return;
    }
    api.me()
      .then(({ user }) => {
        setAuthUser(user);
      })
      .catch(() => {
        // Token invalid or expired – clear it
        tokenStore.clear();
      })
      .finally(() => setAuthLoading(false));
  }, []);

  /**
   * login({ email, password, role }, persist)
   * role is used for:
   *   - 'CUSTOMER'  → guest login with name instead of email/password
   *   - others      → normal staff login
   */
  const login = useCallback(async (credentials, persist = false) => {
    const data = await api.login(credentials);
    tokenStore.set(data.token, persist);
    setAuthUser(data.user);
    return data.user;
  }, []);

  const logout = useCallback(async () => {
    try { await api.logout(); } catch (_) {}
    tokenStore.clear();
    setAuthUser(null);
    // Navigate to landing / customer login
    window.location.hash = '';
  }, []);

  const isAuthenticated = Boolean(authUser);

  const hasRole = (...roles) => authUser && roles.includes(authUser.role);

  const value = {
    authUser,
    authLoading,
    isAuthenticated,
    hasRole,
    login,
    logout,
    ROLE_DEFAULT_VIEW,
    ROLE_ALLOWED_VIEWS,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within an AuthProvider');
  return ctx;
}
