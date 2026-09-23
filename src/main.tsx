import React from 'react';
import ReactDOM from 'react-dom/client';
import { App } from './App';
import 'leaflet/dist/leaflet.css';
import './index.css';

// Handle Google OAuth popup redirect if applicable
if (window.location.hash && window.location.hash.includes('access_token')) {
  try {
    const hashParams = new URLSearchParams(window.location.hash.substring(1));
    const accessToken = hashParams.get('access_token');
    const expiresIn = hashParams.get('expires_in');
    if (accessToken) {
      // 1. Store in localStorage for resilient cross-window transfer (bypasses COOP opener restrictions)
      localStorage.setItem(
        'runwar_google_fit_token_transfer',
        JSON.stringify({
          token: accessToken,
          expiresIn: expiresIn ? parseInt(expiresIn, 10) : 3600,
          timestamp: Date.now(),
        })
      );

      // 2. Also try postMessage if window.opener is available
      try {
        if (window.opener) {
          window.opener.postMessage(
            {
              type: 'GOOGLE_HEALTH_OAUTH_TOKEN',
              token: accessToken,
              expiresIn: expiresIn ? parseInt(expiresIn, 10) : 3600,
            },
            window.location.origin
          );
        }
      } catch {}

      // Close popup after transferring token
      try {
        window.close();
      } catch {}
    }
  } catch (e) {
    console.debug('OAuth popup receiver handled:', e);
  }
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
