import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import { ThemeProvider } from './context/ThemeContext';
import { LanguageProvider } from './context/LanguageContext';
import Navbar from './components/Navbar';

import ProtectedRoute from './components/ProtectedRoute';
import { useAuth } from './context/AuthContext';

import Login from './pages/Login';
import Signup from './pages/Signup';
import ForgotPassword from './pages/ForgotPassword';
import PortalDashboard from './pages/PortalDashboard';
import MirrorDashboard from './pages/MirrorDashboard';
import SendMirror from './pages/SendMirror';
import ThreadView from './pages/ThreadView';
import AdminPanel from './pages/AdminPanel';
import CounselorDashboard from './pages/CounselorDashboard';
import Notifications from './pages/Notifications';
import ModuleDocs from './pages/ModuleDocs';
import TicketsDashboard from './pages/TicketsDashboard';
import CreateTicket from './pages/CreateTicket';
import TicketView from './pages/TicketView';
import AffirmationDashboard from './pages/AffirmationDashboard';
import SendAffirmation from './pages/SendAffirmation';
import AffirmationView from './pages/AffirmationView';
import FundTrackerDashboard from './pages/FundTrackerDashboard';
import ForceLogout from './pages/ForceLogout';

const RootRedirect = () => {
  const { user, loading } = useAuth();

  // While loading, optimistically send to /login. If the user IS authenticated,
  // ProtectedRoute on /login (restrictAuthenticated) will redirect them to /dashboard once resolved.
  if (loading) return <Navigate to="/login" replace />;

  if (!user) {
    // If the user was mid-signup (step 2) and the state is still valid, send them there
    const pendingSignupStep = localStorage.getItem('dfcci_signup_step');
    const pendingSignupExpiry = localStorage.getItem('dfcci_signup_expiry');
    const isSignupValid = pendingSignupExpiry && Date.now() < parseInt(pendingSignupExpiry, 10);
    
    if (pendingSignupStep === '2' && isSignupValid) {
      return <Navigate to="/signup" replace />;
    }

    // If the user was mid-password reset (step 2)
    const pendingFPStep = localStorage.getItem('dfcci_fp_step');
    const pendingFPExpiry = localStorage.getItem('dfcci_fp_expiry');
    const isFPValid = pendingFPExpiry && Date.now() < parseInt(pendingFPExpiry, 10);

    if (pendingFPStep === '2' && isFPValid) {
      return <Navigate to="/forgot-password" replace />;
    }

    return <Navigate to="/login" replace />;
  }

  return <Navigate to="/dashboard" replace />;
};

import NameChangePrompt from './components/NameChangePrompt';

const App = () => {
  return (
    <LanguageProvider>
    <ThemeProvider>
      <AuthProvider>
        <Router>
          <div className="app-container">
            <NameChangePrompt />
            <Navbar />
            <main className="main-content">
              <Routes>
                {/* Public / Landing logic */}
                <Route path="/" element={<RootRedirect />} />
                <Route path="/force-logout" element={<ForceLogout />} />
                
                {/* Auth Routes - Restricted to Guest */}
                <Route path="/login" element={<ProtectedRoute restrictAuthenticated><Login /></ProtectedRoute>} />
                <Route path="/signup" element={<ProtectedRoute restrictAuthenticated><Signup /></ProtectedRoute>} />
                <Route path="/forgot-password" element={<ProtectedRoute restrictAuthenticated><ForgotPassword /></ProtectedRoute>} />

                {/* Private Routes - Required Auth */}
                <Route path="/dashboard" element={<ProtectedRoute><PortalDashboard /></ProtectedRoute>} />
                <Route path="/mirror/dashboard" element={<ProtectedRoute><MirrorDashboard /></ProtectedRoute>} />
                <Route path="/mirror/send" element={<ProtectedRoute><SendMirror /></ProtectedRoute>} />
                <Route path="/mirror/thread/:id" element={<ProtectedRoute><ThreadView /></ProtectedRoute>} />
                <Route path="/admin" element={<ProtectedRoute><AdminPanel /></ProtectedRoute>} />
                <Route path="/counselor" element={<ProtectedRoute><CounselorDashboard /></ProtectedRoute>} />
                <Route path="/notifications" element={<ProtectedRoute><Notifications /></ProtectedRoute>} />
                
                {/* Module Docs - Generally public but can be protected if desired */}
                <Route path="/docs/:moduleName" element={<ProtectedRoute allowGuest><ModuleDocs /></ProtectedRoute>} />

                <Route path="/tickets/dashboard" element={<ProtectedRoute><TicketsDashboard /></ProtectedRoute>} />
                <Route path="/tickets/create" element={<ProtectedRoute><CreateTicket /></ProtectedRoute>} />
                <Route path="/tickets/:id" element={<ProtectedRoute><TicketView /></ProtectedRoute>} />
                
                <Route path="/affirm/dashboard" element={<ProtectedRoute><AffirmationDashboard /></ProtectedRoute>} />
                <Route path="/affirm/send" element={<ProtectedRoute><SendAffirmation /></ProtectedRoute>} />
                <Route path="/affirm/:id" element={<ProtectedRoute><AffirmationView /></ProtectedRoute>} />
                
                <Route path="/funds" element={<ProtectedRoute><FundTrackerDashboard /></ProtectedRoute>} />
              </Routes>
            </main>
          </div>
        </Router>
      </AuthProvider>
    </ThemeProvider>
    </LanguageProvider>
  );
};

export default App;
