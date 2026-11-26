import React from 'react';
import ReactDOM from 'react-dom/client';
import { App } from './App';
import 'leaflet/dist/leaflet.css';
import './index.css';
import { healthService } from './services/health/healthService';

// Restore Google Health persistent connection on every app load.
healthService.startPersistentConnection().catch(() => {});

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
