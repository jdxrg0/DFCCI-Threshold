import axios from 'axios';

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || `http://${window.location.hostname}:5000/api`,
  withCredentials: true, // Crucial for httpOnly cookies
});

// Add a response interceptor to handle unauthorized errors globally
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response && error.response.status === 401) {
      console.warn('[API Interceptor] 401 Unauthorized detected. Path:', window.location.pathname);
      // If the API returns 401, clear the cache and force a reload to trigger the ProtectedRoute logic
      localStorage.removeItem('dfcci_user_cache');
      // Only reload if we aren't already on the login page to avoid loops
      if (!window.location.pathname.includes('/login')) {
        console.warn('[API Interceptor] Redirecting to /login');
        window.location.href = '/login';
      }
    }
    return Promise.reject(error);
  }
);

export default api;
