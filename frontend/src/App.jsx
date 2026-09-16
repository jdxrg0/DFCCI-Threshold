import { lazy, Suspense, useState } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import { LanguageProvider } from './context/LanguageContext';
import Navbar from './components/Navbar';
import BackBar from './components/BackBar';

import ProtectedRoute from './components/ProtectedRoute';
import NameChangePrompt from './components/NameChangePrompt';
import { useAuth } from './context/AuthContext';

// First-paint critical pages stay eager.
import Login from './pages/Login';
import Signup from './pages/Signup';
import ForgotPassword from './pages/ForgotPassword';
import PortalDashboard from './pages/PortalDashboard';
import ForceLogout from './pages/ForceLogout';

// Everything else is split per-route so the big modules (Fund Tracker, Admin,
// Automation Hub…) only download when the user actually opens them.
const MirrorDashboard = lazy(() => import('./pages/MirrorDashboard'));
const SendMirror = lazy(() => import('./pages/SendMirror'));
const ThreadView = lazy(() => import('./pages/ThreadView'));
const AdminPanel = lazy(() => import('./pages/AdminPanel'));
const AutomationDashboard = lazy(() => import('./pages/AutomationDashboard'));
const ServingCalendar = lazy(() => import('./pages/ServingCalendar'));
const CounselorDashboard = lazy(() => import('./pages/CounselorDashboard'));
const ModuleDocs = lazy(() => import('./pages/ModuleDocs'));
const TicketsDashboard = lazy(() => import('./pages/TicketsDashboard'));
const CreateTicket = lazy(() => import('./pages/CreateTicket'));
const TicketView = lazy(() => import('./pages/TicketView'));
const AffirmationDashboard = lazy(() => import('./pages/AffirmationDashboard'));
const SendAffirmation = lazy(() => import('./pages/SendAffirmation'));
const AffirmationView = lazy(() => import('./pages/AffirmationView'));
const FundTrackerDashboard = lazy(() => import('./pages/FundTrackerDashboard'));
const ResourceCenter = lazy(() => import('./pages/ResourceCenter'));
const ResourceDetail = lazy(() => import('./pages/ResourceDetail'));
const GamesDashboard = lazy(() => import('./pages/GamesDashboard'));
const QuizPlay = lazy(() => import('./pages/QuizPlay'));
const QuizCreate = lazy(() => import('./pages/QuizCreate'));
const DevotionalDashboard = lazy(() => import('./pages/DevotionalDashboard'));
const SubmitDevotional = lazy(() => import('./pages/SubmitDevotional'));
const DevotionalView = lazy(() => import('./pages/DevotionalView'));
const ProfileSettings = lazy(() => import('./pages/ProfileSettings'));

const PageSkeleton = () => (
  <div className="app-container" style={{ justifyContent: 'center', alignItems: 'center', paddingTop: '3rem' }}>
    <div className="skeleton-title" style={{ width: '140px' }} />
  </div>
);

const RootRedirect = () => {
  const { user, loading } = useAuth();
  const [now] = useState(() => Date.now());

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
    const isSignupValid = pendingSignupExpiry && now < parseInt(pendingSignupExpiry, 10);
    
    if (pendingSignupStep === '2' && isSignupValid) {
      return <Navigate to="/signup" replace />;
    }

    // If the user was mid-password reset (step 2)
    const pendingFPStep = localStorage.getItem('dfcci_fp_step');
    const pendingFPExpiry = localStorage.getItem('dfcci_fp_expiry');
    const isFPValid = pendingFPExpiry && now < parseInt(pendingFPExpiry, 10);

    if (pendingFPStep === '2' && isFPValid) {
      return <Navigate to="/forgot-password" replace />;
    }

    return <Navigate to="/login" replace />;
  }

  return <Navigate to="/dashboard" replace />;
};

const App = () => {
  return (
    <LanguageProvider>
      {/* ThemeProvider is mounted once, in main.jsx. It used to be mounted here
          as well: two independent copies of the theme state, both running the
          effect that writes <html>. Effects run child-first, so main.jsx's copy
          ran last and won the DOM — while the picker, being inside this one,
          only ever updated the copy that lost. Any re-render of the outer
          provider (an OS light/dark change fires its matchMedia listener) then
          reverted the page to its stale theme with the picker still showing the
          user's choice. */}
      <AuthProvider>
        <Router>
          <div className="app-container">
            <NameChangePrompt />
            <Navbar />
            <main className="main-content">
              {/* One global back control for every module & settings page.
                  Route hierarchy lives in data/navMap.js — do not add
                  per-page back buttons. */}
              <BackBar />
              <Suspense fallback={<PageSkeleton />}>
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
              </Suspense>
            </main>
          </div>
        </Router>
      </AuthProvider>
    </LanguageProvider>
  );
};

export default App;
