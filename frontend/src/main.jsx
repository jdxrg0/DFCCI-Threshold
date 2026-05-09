import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App.jsx';
import { ThemeProvider } from './context/ThemeContext';
import { GoogleOAuthProvider } from '@react-oauth/google';
import './index.css';

const googleClientId = import.meta.env.VITE_GOOGLE_CLIENT_ID || 'placeholder_client_id';

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
