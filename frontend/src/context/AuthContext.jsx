import React, { createContext, useState, useEffect, useContext } from 'react';
import api from '../api';

const AuthContext = createContext();
const USER_CACHE_KEY = 'dfcci_user_cache';

export const useAuth = () => useContext(AuthContext);

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

  useEffect(() => {
    // Always re-validate with the server in the background
    checkAuth();
  }, []);

  // Re-validate when user returns to the tab (handles mobile app-switch)
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        checkAuth(true); // silent = true, don't show loading screen
      }
    };
    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
  }, []);

  const checkAuth = async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      const res = await api.get('/auth/me');
      const freshUser = res.data.user;
      console.log('[Auth] checkAuth success:', freshUser.displayName);
      setUser(freshUser);
      // Persist to localStorage for instant restore next time
      localStorage.setItem(USER_CACHE_KEY, JSON.stringify(freshUser));
    } catch (error) {
      if (error.response && error.response.status === 401) {
        console.warn('[Auth] Session invalid (401), logging out...');
        setUser(null);
        localStorage.removeItem(USER_CACHE_KEY);
      } else if (error.message === 'Network Error' || !error.response) {
        console.warn('[Auth] Network error (offline?), keeping cached user:', error.message);
        // Don't clear user here, allow them to see cached data if possible
      } else {
        console.warn('[Auth] Unknown auth error:', error.message);
      }
    } finally {
      setLoading(false);
    }
  };

  const login = async (email, password) => {
    const res = await api.post('/auth/login', { email, password });
    const { user: userData, token } = res.data;
    
    setUser(userData);
    localStorage.setItem(USER_CACHE_KEY, JSON.stringify(userData));
    localStorage.setItem('dfcci_token', token);
    return res.data;
  };

  const googleAuth = async (credential, confirmedName = null) => {
    const res = await api.post('/auth/google', { credential, confirmedName });
    
    if (res.data.requireNameConfirmation) {
      return res.data;
    }

    const { user: userData, token } = res.data;
    
    setUser(userData);
    localStorage.setItem(USER_CACHE_KEY, JSON.stringify(userData));
    localStorage.setItem('dfcci_token', token);
    return res.data;
  };

  const logout = async () => {
    await api.post('/auth/logout');
    setUser(null);
    localStorage.removeItem(USER_CACHE_KEY);
    localStorage.removeItem('dfcci_token');
  };

  const signup = async (userData) => {
    return await api.post('/auth/signup', userData);
  };

  const verifyOtp = async (email, otp) => {
    return await api.post('/auth/verify-otp', { email, otp });
  };

  // NOTE: Do NOT early-return here — that blocks the Router from mounting.
  // ProtectedRoute handles the loading skeleton per-route.

  const updateDisplayName = async (newName) => {
    const res = await api.put('/users/me/update-name', { displayName: newName });
    const freshUser = res.data.user;
    setUser(freshUser);
    localStorage.setItem(USER_CACHE_KEY, JSON.stringify(freshUser));
    return res.data;
  };

  const updateProfile = async (formData) => {
    const res = await api.put('/users/me/update-profile', formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });
    const freshUser = res.data.user;
    setUser(freshUser);
    localStorage.setItem(USER_CACHE_KEY, JSON.stringify(freshUser));
    return res.data;
  };

  const updateEmail = async (email) => {
    const res = await api.put('/users/me/update-email', { email });
    const freshUser = res.data.user;
    setUser(freshUser);
    localStorage.setItem(USER_CACHE_KEY, JSON.stringify(freshUser));
    return res.data;
  };

  const updatePassword = async (currentPassword, newPassword) => {
    const res = await api.put('/users/me/update-password', { currentPassword, newPassword });
    return res.data;
  };

  const removeProfilePicture = async () => {
    const res = await api.delete('/users/me/remove-profile-picture');
    const freshUser = res.data.user;
    setUser(freshUser);
    localStorage.setItem(USER_CACHE_KEY, JSON.stringify(freshUser));
    return res.data;
  };

  return (
    <AuthContext.Provider value={{ 
      user, 
      loading, 
      login, 
      logout, 
      signup, 
      verifyOtp, 
      googleAuth, 
      updateDisplayName,
      updateProfile,
      updateEmail,
      updatePassword,
      removeProfilePicture
    }}>
      {children}
    </AuthContext.Provider>
  );
};
