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
      } else {
        console.warn('[Auth] Network error during auth check, keeping cached user:', error.message);
      }
    } finally {
      if (!silent) setLoading(false);
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

  if (loading) {
    return <div className="app-container" style={{justifyContent: 'center', alignItems: 'center'}}>Loading...</div>;
  }

  return (
    <AuthContext.Provider value={{ user, login, logout, signup, verifyOtp }}>
      {children}
    </AuthContext.Provider>
  );
};
