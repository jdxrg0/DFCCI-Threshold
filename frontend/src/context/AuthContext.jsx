/* eslint-disable react-refresh/only-export-components */
import { createContext, useState, useEffect, useContext, useMemo, useCallback, useRef } from 'react';
import * as authService from '../services/auth';

// Split into two contexts so components that only call actions (login, logout,
// signup…) never re-render when the `user` object changes, and vice-versa.
const UserContext = createContext();
const AuthActionsContext = createContext();
const USER_CACHE_KEY = 'dfcci_user_cache';

// Re-validate the session on tab-return at most this often. Every check runs a
// network call and (when the payload differs) a full re-render of the tree —
// mobile app switches fire visibilitychange in rapid bursts, so throttle it.
const VISIBILITY_REVALIDATE_MS = 30 * 1000;

// Back-compatible combined hook — subscribes to both contexts.
export const useAuth = () => {
  const user = useContext(UserContext);
  const actions = useContext(AuthActionsContext);
  return { ...actions, ...user };
};

// Actions-only hook for consumers that never render user data.
export const useAuthActions = () => useContext(AuthActionsContext);

export const AuthProvider = ({ children }) => {
  // Initialize from localStorage immediately — prevents blank flash on mobile reload
  const [user, setUser] = useState(() => {
    try {
      const cached = localStorage.getItem(USER_CACHE_KEY);
      return cached ? JSON.parse(cached) : null;
    } catch {
      return null;
    }
  });
  // If we have a cached user, skip the blocking loading screen
  const [loading, setLoading] = useState(() => {
    return !localStorage.getItem(USER_CACHE_KEY);
  });

  // Mirror of the current user for cheap change detection without re-renders.
  const userRef = useRef(user);
  const pendingCheckRef = useRef(null);
  const lastVisibilityCheckRef = useRef(0);

  /**
   * Commit a freshly fetched user only when it actually changed. Server
   * responses come back as brand-new object identities, so a naive setUser
   * re-renders every consumer even when the payload is byte-for-byte the same.
   * Returning the same state from the updater lets React bail out of the
   * re-render entirely.
   */
  const commitUser = useCallback((freshUser) => {
    const serialized = JSON.stringify(freshUser);
    if (serialized === JSON.stringify(userRef.current)) return;
    userRef.current = freshUser;
    try {
      localStorage.setItem(USER_CACHE_KEY, serialized);
    } catch {
      // Persistence is best-effort
    }
    setUser(freshUser);
  }, []);

  const checkAuth = useCallback(async (silent = false) => {
    // One in-flight revalidation at a time; duplicate triggers share the promise.
    if (pendingCheckRef.current) {
      return pendingCheckRef.current;
    }
    if (!silent) setLoading(true);
    const check = (async () => {
      try {
        const data = await authService.getMe();
        commitUser(data.user);
      } catch (error) {
        if (error.response && error.response.status === 401) {
          console.warn('[Auth] Session invalid (401), logging out...');
          userRef.current = null;
          setUser(null);
          try {
            localStorage.removeItem(USER_CACHE_KEY);
          } catch {
            // best-effort
          }
        } else if (error.message === 'Network Error' || !error.response) {
          console.warn('[Auth] Network error (offline?), keeping cached user:', error.message);
          // Don't clear user here, allow them to see cached data if possible
        } else {
          console.warn('[Auth] Unknown auth error:', error.message);
        }
      } finally {
        pendingCheckRef.current = null;
        if (!silent) setLoading(false);
      }
    })();
    pendingCheckRef.current = check;
    return check;
  }, [commitUser]);

  useEffect(() => {
    // Always re-validate with the server in the background
    // eslint-disable-next-line react-hooks/set-state-in-effect
    checkAuth();
  }, [checkAuth]);

  // Re-validate when user returns to the tab (handles mobile app-switch),
  // throttled so rapid visibility flapping does not hammer the API.
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState !== 'visible') return;
      const nowTs = Date.now();
      if (nowTs - lastVisibilityCheckRef.current < VISIBILITY_REVALIDATE_MS) return;
      lastVisibilityCheckRef.current = nowTs;
      checkAuth(true); // silent = true, don't show loading screen
    };
    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
  }, [checkAuth]);

  const login = useCallback(async (email, password) => {
    const data = await authService.login(email, password);
    const { user: userData, token } = data;

    commitUser(userData);
    localStorage.setItem('dfcci_token', token);
    return data;
  }, [commitUser]);

  const googleAuth = useCallback(async (credential, confirmedName = null) => {
    const data = await authService.googleAuth(credential, confirmedName);

    if (data.requireNameConfirmation) {
      return data;
    }

    const { user: userData, token } = data;

    commitUser(userData);
    localStorage.setItem('dfcci_token', token);
    return data;
  }, [commitUser]);

  const logout = useCallback(async () => {
    await authService.logout();
    userRef.current = null;
    setUser(null);
    try {
      localStorage.removeItem(USER_CACHE_KEY);
      localStorage.removeItem('dfcci_token');
    } catch {
      // best-effort
    }
  }, []);

  const signup = useCallback((userData) => authService.signup(userData), []);

  const verifyOtp = useCallback((email, otp) => authService.verifyOtp(email, otp), []);

  // NOTE: Do NOT early-return here — that blocks the Router from mounting.
  // ProtectedRoute handles the loading skeleton per-route.

  const updateDisplayName = useCallback(async (newName) => {
    const data = await authService.updateName(newName);
    commitUser(data.user);
    return data;
  }, [commitUser]);

  const updateProfile = useCallback(async (formData) => {
    const data = await authService.updateProfile(formData);
    commitUser(data.user);
    return data;
  }, [commitUser]);

  const updateEmail = useCallback(async (email) => {
    const data = await authService.updateEmail(email);
    if (data.user) commitUser(data.user);
    return data;
  }, [commitUser]);

  const verifyEmailOtp = useCallback(async (otp) => {
    const data = await authService.verifyEmailOtp(otp);
    if (data.user) commitUser(data.user);
    return data;
  }, [commitUser]);

  const resendEmailOtp = useCallback(() => authService.resendEmailOtp(), []);

  const cancelEmailUpdate = useCallback(async () => {
    const data = await authService.cancelEmailUpdate();
    if (data.user) commitUser(data.user);
    return data;
  }, [commitUser]);

  const updatePassword = useCallback(async (currentPassword, newPassword) => {
    return await authService.updatePassword(currentPassword, newPassword);
  }, []);

  const removeProfilePicture = useCallback(async () => {
    const data = await authService.removeProfilePicture();
    commitUser(data.user);
    return data;
  }, [commitUser]);

  const userValue = useMemo(() => ({ user, loading }), [user, loading]);

  const actionsValue = useMemo(() => ({
    login,
    logout,
    signup,
    verifyOtp,
    googleAuth,
    updateDisplayName,
    updateProfile,
    updateEmail,
    verifyEmailOtp,
    resendEmailOtp,
    cancelEmailUpdate,
    updatePassword,
    removeProfilePicture
  }), [
    login,
    logout,
    signup,
    verifyOtp,
    googleAuth,
    updateDisplayName,
    updateProfile,
    updateEmail,
    verifyEmailOtp,
    resendEmailOtp,
    cancelEmailUpdate,
    updatePassword,
    removeProfilePicture
  ]);

  return (
    <UserContext.Provider value={userValue}>
      <AuthActionsContext.Provider value={actionsValue}>{children}</AuthActionsContext.Provider>
    </UserContext.Provider>
  );
};