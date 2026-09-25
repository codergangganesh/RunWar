import React from 'react';
import ReactDOM from 'react-dom/client';
import { App } from './App';
import 'leaflet/dist/leaflet.css';
import './index.css';
import { healthService } from './services/health/healthService';
import { stravaProvider } from './services/health/stravaProvider';

// Restore Google Health persistent connection on every app load.
healthService.startPersistentConnection().catch(() => {});

// Handle redirected Strava OAuth authorization code if popup was bypassed
try {
  const pendingStravaCode = sessionStorage.getItem('runwar_pending_strava_code');
  if (pendingStravaCode) {
    sessionStorage.removeItem('runwar_pending_strava_code');
    stravaProvider.exchangeAuthorizationCode(pendingStravaCode).catch((err) => {
      console.warn('Failed to exchange pending Strava code:', err);
    });
  }
} catch {}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
