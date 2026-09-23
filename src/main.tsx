import React from 'react';
import ReactDOM from 'react-dom/client';
import { App } from './App';
import 'leaflet/dist/leaflet.css';
import './index.css';

// Handle Google OAuth popup redirect if applicable
if (window.opener && window.location.hash) {
  try {
    const hashParams = new URLSearchParams(window.location.hash.substring(1));
    const accessToken = hashParams.get('access_token');
    const expiresIn = hashParams.get('expires_in');
    if (accessToken) {
      window.opener.postMessage(
        {
          type: 'GOOGLE_HEALTH_OAUTH_TOKEN',
          token: accessToken,
          expiresIn: expiresIn ? parseInt(expiresIn, 10) : 3600,
        },
        window.location.origin
      );
      window.close();
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
