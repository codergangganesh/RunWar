import { createClient } from '@insforge/sdk';

const baseUrl = (typeof import.meta !== 'undefined' && import.meta.env?.VITE_INSFORGE_URL) || 'https://9r3q7vvs.us-east.insforge.app';
const anonKey = (typeof import.meta !== 'undefined' && import.meta.env?.VITE_INSFORGE_ANON_KEY) || 'ik_3f6a564a8b2a7de0a8e58110051ed7a8';

export const insforge = createClient({
  baseUrl,
  anonKey,
  auth: {
    detectOAuthCallback: false,
  },
});

