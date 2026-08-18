import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App.jsx';
import { ThemeProvider } from './context/ThemeContext';
import { GoogleOAuthProvider } from '@react-oauth/google';
import './index.css';
import './styles/redesign.css';
import './styles/no-zoom.css'; // must stay last — it overrides mobile font-size rules

const googleClientId = import.meta.env.VITE_GOOGLE_CLIENT_ID || '737835718804-j8hghc211jrqqttj608c836qj7kfa8cr.apps.googleusercontent.com';

const rootElement = document.getElementById('root');
if (rootElement) {
  try {
    ReactDOM.createRoot(rootElement).render(
      <React.StrictMode>
        <GoogleOAuthProvider clientId={googleClientId}>
          <ThemeProvider>
            <App />
          </ThemeProvider>
        </GoogleOAuthProvider>
      </React.StrictMode>,
    );
  } catch (err) {
    console.error('Initial render failed:', err);
    rootElement.innerHTML = `<div style="padding: 20px; color: white;">Something went wrong while loading the app. Please refresh.</div>`;
  }
}

window.addEventListener('error', (event) => {
  console.error('Caught global error:', event.error);
});

// ── Block pinch-zoom on iOS Safari ──
// iOS has ignored `user-scalable=no` in the viewport meta since iOS 10, and it
// does not honour `touch-action` for page pinch either — these proprietary
// gesture events are the only thing it listens to. Everything else (double-tap,
// input focus zoom) is handled in styles/no-zoom.css.
// `passive: false` is required or preventDefault() is ignored.
['gesturestart', 'gesturechange', 'gestureend'].forEach((type) => {
  document.addEventListener(type, (event) => event.preventDefault(), { passive: false });
});
