import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import { ThemeProvider } from './context/ThemeContext';
import { LanguageProvider } from './context/LanguageContext';
import Navbar from './components/Navbar';
import BackBar from './components/BackBar';
import AnimatedBackdrop from './components/AnimatedBackdrop';

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
import AutomationDashboard from './pages/AutomationDashboard';
import ServingCalendar from './pages/ServingCalendar';
import CounselorDashboard from './pages/CounselorDashboard';
import ModuleDocs from './pages/ModuleDocs';
import TicketsDashboard from './pages/TicketsDashboard';
import CreateTicket from './pages/CreateTicket';
import TicketView from './pages/TicketView';
import AffirmationDashboard from './pages/AffirmationDashboard';
import SendAffirmation from './pages/SendAffirmation';
import AffirmationView from './pages/AffirmationView';
import FundTrackerDashboard from './pages/FundTrackerDashboard';
import ResourceCenter from './pages/ResourceCenter';
import ResourceDetail from './pages/ResourceDetail';
import ForceLogout from './pages/ForceLogout';
import GamesDashboard from './pages/GamesDashboard';
import QuizPlay from './pages/QuizPlay';
import QuizCreate from './pages/QuizCreate';
import DevotionalDashboard from './pages/DevotionalDashboard';
import SubmitDevotional from './pages/SubmitDevotional';
import DevotionalView from './pages/DevotionalView';
import ProfileSettings from './pages/ProfileSettings';

const RootRedirect = () => {
  const { user, loading } = useAuth();

  // While loading, show a neutral loading state. 
  // Do NOT redirect yet, as we don't know if the user is authenticated.
  if (loading) {
    return (
      <div className="app-container" style={{ justifyContent: 'center', alignItems: 'center', height: '100vh' }}>
        <div className="skeleton-title" style={{ width: '100px' }}></div>
        <p style={{ color: 'var(--text-muted)', marginTop: '1rem' }}>Initializing...</p>
      </div>
    );
  }

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
            <AnimatedBackdrop />
            <NameChangePrompt />
            <Navbar />
            <main className="main-content">
              {/* One global back control for every module & settings page.
                  Route hierarchy lives in data/navMap.js — do not add
                  per-page back buttons. */}
              <BackBar />
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
                <Route path="/settings" element={<ProtectedRoute><ProfileSettings /></ProtectedRoute>} />
                <Route path="/mirror/dashboard" element={<ProtectedRoute><MirrorDashboard /></ProtectedRoute>} />
                <Route path="/mirror/send" element={<ProtectedRoute><SendMirror /></ProtectedRoute>} />
                <Route path="/mirror/thread/:id" element={<ProtectedRoute><ThreadView /></ProtectedRoute>} />
                <Route path="/admin" element={<ProtectedRoute><AdminPanel /></ProtectedRoute>} />
                <Route path="/admin/automation" element={<ProtectedRoute><AutomationDashboard /></ProtectedRoute>} />
                <Route path="/automation-hub/calendar" element={<ProtectedRoute><ServingCalendar /></ProtectedRoute>} />
                <Route path="/counselor" element={<ProtectedRoute><CounselorDashboard /></ProtectedRoute>} />
                
                {/* Module Docs - Generally public but can be protected if desired */}
                <Route path="/docs/:moduleName" element={<ProtectedRoute allowGuest><ModuleDocs /></ProtectedRoute>} />

                <Route path="/tickets/dashboard" element={<ProtectedRoute><TicketsDashboard /></ProtectedRoute>} />
                <Route path="/tickets/create" element={<ProtectedRoute><CreateTicket /></ProtectedRoute>} />
                <Route path="/tickets/:id" element={<ProtectedRoute><TicketView /></ProtectedRoute>} />
                
                <Route path="/affirm/dashboard" element={<ProtectedRoute><AffirmationDashboard /></ProtectedRoute>} />
                <Route path="/affirm/send" element={<ProtectedRoute><SendAffirmation /></ProtectedRoute>} />
                <Route path="/affirm/:id" element={<ProtectedRoute><AffirmationView /></ProtectedRoute>} />
                
                <Route path="/funds" element={<ProtectedRoute><FundTrackerDashboard /></ProtectedRoute>} />
                <Route path="/resources" element={<ProtectedRoute><ResourceCenter /></ProtectedRoute>} />
                <Route path="/resources/:id" element={<ProtectedRoute><ResourceDetail /></ProtectedRoute>} />
                
                <Route path="/games" element={<ProtectedRoute><GamesDashboard /></ProtectedRoute>} />
                <Route path="/games/play/:id" element={<ProtectedRoute><QuizPlay /></ProtectedRoute>} />
                <Route path="/games/create" element={<ProtectedRoute><QuizCreate /></ProtectedRoute>} />
                <Route path="/games/edit/:id" element={<ProtectedRoute><QuizCreate /></ProtectedRoute>} />
                
                <Route path="/devotionals" element={<ProtectedRoute><DevotionalDashboard /></ProtectedRoute>} />
                <Route path="/devotionals/submit" element={<ProtectedRoute><SubmitDevotional /></ProtectedRoute>} />
                <Route path="/devotionals/:id" element={<ProtectedRoute><DevotionalView /></ProtectedRoute>} />
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
