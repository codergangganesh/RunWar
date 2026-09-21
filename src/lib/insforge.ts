import { createClient } from '@insforge/sdk';

const baseUrl = (typeof import.meta !== 'undefined' && import.meta.env?.VITE_INSFORGE_URL) || 'https://7p7ewmvi.us-east.insforge.app';
const anonKey = (typeof import.meta !== 'undefined' && import.meta.env?.VITE_INSFORGE_ANON_KEY) || 'ik_9d2a844d3d742c432e4c93745a27c78d';

export const insforge = createClient({
  baseUrl,
  anonKey,
});

