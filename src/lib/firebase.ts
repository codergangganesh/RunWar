import { initializeApp, getApps, getApp, FirebaseApp } from 'firebase/app';
import { getAuth, Auth } from 'firebase/auth';

const getEnv = (key: string, fallback: string = ''): string => {
  return (
    (import.meta.env[`NEXT_PUBLIC_${key}`] as string) ||
    (import.meta.env[`VITE_${key}`] as string) ||
    (import.meta.env[key] as string) ||
    fallback
  );
};

export const firebaseConfig = {
  apiKey: getEnv('FIREBASE_API_KEY', 'AIzaSyDkfmVEA_WevXiWOEwgXkkzXHEforKzC2E'),
  authDomain: getEnv('FIREBASE_AUTH_DOMAIN', 'runwarotp-service.firebaseapp.com'),
  projectId: getEnv('FIREBASE_PROJECT_ID', 'runwarotp-service'),
  storageBucket: getEnv('FIREBASE_STORAGE_BUCKET', 'runwarotp-service.firebasestorage.app'),
  messagingSenderId: getEnv('FIREBASE_MESSAGING_SENDER_ID', '597039258309'),
  appId: getEnv('FIREBASE_APP_ID', '1:597039258309:web:fed2a60fd5e07c5d58aeac'),
};

export const isFirebaseConfigured = (): boolean => {
  return Boolean(firebaseConfig.apiKey && firebaseConfig.projectId);
};

let app: FirebaseApp | null = null;
let auth: Auth | null = null;

try {
  if (isFirebaseConfigured()) {
    app = getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);
    auth = getAuth(app);
  } else {
    console.warn(
      '[Firebase] Firebase credentials are not yet configured in .env.local. Phone OTP authentication will operate in setup guidance mode.'
    );
  }
} catch (error) {
  console.error('[Firebase] Failed to initialize Firebase App:', error);
}

export { app, auth };
