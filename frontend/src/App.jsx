import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import { ThemeProvider } from './context/ThemeContext';
import { LanguageProvider } from './context/LanguageContext';
import Navbar from './components/Navbar';


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

const App = () => {
  return (
    <LanguageProvider>
    <ThemeProvider>
      <AuthProvider>
        <Router>
          <div className="app-container">
            <Navbar />
            <main className="main-content">
              <Routes>
                <Route path="/" element={<Navigate to="/login" replace />} />
                <Route path="/login" element={<Login />} />
                <Route path="/signup" element={<Signup />} />
                <Route path="/forgot-password" element={<ForgotPassword />} />
                <Route path="/dashboard" element={<PortalDashboard />} />
                <Route path="/mirror/dashboard" element={<MirrorDashboard />} />
                <Route path="/mirror/send" element={<SendMirror />} />
                <Route path="/mirror/thread/:id" element={<ThreadView />} />
                <Route path="/admin" element={<AdminPanel />} />
                <Route path="/counselor" element={<CounselorDashboard />} />
                <Route path="/notifications" element={<Notifications />} />
                <Route path="/docs/:moduleName" element={<ModuleDocs />} />
                <Route path="/tickets/dashboard" element={<TicketsDashboard />} />
                <Route path="/tickets/create" element={<CreateTicket />} />
                <Route path="/tickets/:id" element={<TicketView />} />
                <Route path="/affirm/dashboard" element={<AffirmationDashboard />} />
                <Route path="/affirm/send" element={<SendAffirmation />} />
                <Route path="/affirm/:id" element={<AffirmationView />} />
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
