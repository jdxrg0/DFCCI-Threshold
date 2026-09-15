import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

/**
 * ProtectedRoute component that checks if a user is authenticated.
 * If not, it redirects to the login page, saving the attempted location.
 * 
 * @param {Object} props
 * @param {React.ReactNode} props.children - The component to render if authenticated
 * @param {boolean} props.allowGuest - If true, allows unauthenticated access (for public pages)
 * @param {boolean} props.restrictAuthenticated - If true, redirects to dashboard if ALREADY authenticated (for login/signup)
 */
const ProtectedRoute = ({ children, allowGuest = false, restrictAuthenticated = false }) => {
  const { user, loading } = useAuth();
  const location = useLocation();

  // Handle loading state from AuthContext (prevents flash of login screen)
  if (loading) {
    return (
      <div className="app-container" style={{ justifyContent: 'center', alignItems: 'center', height: '100vh' }}>
        <div className="skeleton-title" style={{ width: '100px' }}></div>
        <p style={{ color: 'var(--text-muted)', marginTop: '1rem' }}>Verifying session...</p>
      </div>
    );
  }

  // If we are on a page that should NOT be seen by authenticated users (like Login)
  if (restrictAuthenticated && user) {
    return <Navigate to="/dashboard" replace />;
  }

  // If the page is private and there is no user
  if (!allowGuest && !user && !restrictAuthenticated) {
    // Redirect to login, but keep the current location so we can redirect back after login
    return <Navigate to="/login" replace state={{ from: location }} />;
  }

  return children;
};

export default ProtectedRoute;
