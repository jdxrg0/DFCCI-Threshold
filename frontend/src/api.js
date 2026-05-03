import axios from 'axios';

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || '/api',
  withCredentials: true,
});

// Automatically attach the Authorization header if a token exists
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('dfcci_token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
}, (error) => Promise.reject(error));

// Add a response interceptor to handle unauthorized errors globally
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response && error.response.status === 401) {
      console.warn('[API Interceptor] 401 Unauthorized detected. Path:', window.location.pathname);
      // If the API returns 401, clear the cache
      localStorage.removeItem('dfcci_user_cache');
      
      // Define routes where we should NOT force a hard redirect to login
      // These are pages where an unauthenticated state is expected or allowed.
      const publicRoutes = ['/login', '/signup', '/forgot-password', '/docs'];
      const isPublicRoute = publicRoutes.some(route => window.location.pathname.startsWith(route));

      // Only reload to login if we aren't already on a public/auth page
      if (!isPublicRoute) {
        console.warn('[API Interceptor] Private route 401. Redirecting to /login');
        window.location.href = '/login';
      } else {
        console.warn('[API Interceptor] Public route 401. Letting ProtectedRoute handle it.');
      }
    }
    return Promise.reject(error);
  }
);

export default api;
