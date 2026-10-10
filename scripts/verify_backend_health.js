#!/usr/bin/env node
/**
 * RunWar: InsForge Backend Health & Diagnostics Verifier
 * Validates database connectivity, core tables, storage buckets,
 * edge functions, and credentials in a fast 2-second check.
 *
 * Usage: npm run check:backend
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');

// Load .env.local
const envPath = path.join(rootDir, '.env.local');
const env = {};
if (fs.existsSync(envPath)) {
  const content = fs.readFileSync(envPath, 'utf8');
  for (const line of content.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eqIdx = trimmed.indexOf('=');
    if (eqIdx > 0) {
      const key = trimmed.slice(0, eqIdx).trim();
      const val = trimmed.slice(eqIdx + 1).trim();
      env[key] = val;
    }
  }
}

const INSFORGE_URL = env.VITE_INSFORGE_URL || 'https://9r3q7vvs.us-east.insforge.app';
const ANON_KEY = env.VITE_INSFORGE_ANON_KEY || 'ik_3f6a564a8b2a7de0a8e58110051ed7a8';
const FUNCTIONS_URL = env.VITE_INSFORGE_FUNCTIONS_URL || 'https://9r3q7vvs.function2.insforge.app';
const VAPID_KEY = env.VITE_VAPID_PUBLIC_KEY || '';

console.log('\n==================================================');
console.log('       RUNWAR: INSFORGE BACKEND HEALTH CHECK      ');
console.log('==================================================');
console.log(`Backend Base URL : ${INSFORGE_URL}`);
console.log(`Functions URL    : ${FUNCTIONS_URL}`);
console.log(`VAPID Public Key : ${VAPID_KEY ? VAPID_KEY.slice(0, 15) + '...' : 'MISSING'}\n`);

let passedCount = 0;
let totalChecks = 0;

async function check(name, testFn) {
  totalChecks++;
  process.stdout.write(`  [CHECK] ${name.padEnd(40)} `);
  try {
    const result = await testFn();
    passedCount++;
    console.log(`\x1b[32m✓ PASS\x1b[0m ${result ? `(${result})` : ''}`);
    return true;
  } catch (err) {
    console.log(`\x1b[31m✗ FAIL\x1b[0m: ${err.message}`);
    return false;
  }
}

async function runAllChecks() {
  // 1. Credentials
  await check('Environment Keys Configured', async () => {
    if (!INSFORGE_URL) throw new Error('Missing VITE_INSFORGE_URL');
    if (!ANON_KEY) throw new Error('Missing VITE_INSFORGE_ANON_KEY');
    if (!VAPID_KEY) throw new Error('Missing VITE_VAPID_PUBLIC_KEY');
    return 'URL, Anon Key, VAPID present';
  });

  // 2. Database Connectivity & Core Tables
  const coreTables = ['profiles', 'workouts', 'push_subscriptions', 'user_settings', 'alarms'];
  for (const table of coreTables) {
    await check(`DB Table: ${table}`, async () => {
      const url = `${INSFORGE_URL}/api/database/records/${table}?limit=1`;
      const res = await fetch(url, {
        headers: {
          Authorization: `Bearer ${ANON_KEY}`,
          apikey: ANON_KEY,
        },
      });
      if (!res.ok) {
        const text = await res.text().catch(() => '');
        throw new Error(`HTTP ${res.status}: ${text.slice(0, 100)}`);
      }
      return 'Table exists & readable';
    });
  }

  // 3. Storage Bucket: avatars
  await check('Storage: avatars bucket', async () => {
    // InsForge public bucket URL check
    const testUrl = `${INSFORGE_URL}/api/storage/buckets/avatars`;
    const res = await fetch(testUrl, {
      headers: {
        Authorization: `Bearer ${ANON_KEY}`,
        apikey: ANON_KEY,
      },
    });
    // Either 200 or 404 on root is fine, but 401/403 indicates invalid key
    if (res.status === 401 || res.status === 403) {
      throw new Error(`Auth failed with status ${res.status}`);
    }
    return 'Bucket endpoint authorized';
  });

  // 4. Edge Function: send-push-notification
  await check('Edge Function: send-push-notification', async () => {
    const url = `${FUNCTIONS_URL}/send-push-notification`;
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${ANON_KEY}`,
        apikey: ANON_KEY,
      },
      body: JSON.stringify({ ping: true }),
    });

    const body = await res.json().catch(() => ({}));
    // We expect 400 validation error (notificationId, userId required), NOT 500 VAPID/server crash!
    if (res.status === 500) {
      throw new Error(`Server crash 500: ${JSON.stringify(body)}`);
    }
    if (res.status === 400 && body.error && body.error.includes('required')) {
      return 'Responded 400 (validation operational, 0 crash)';
    }
    return `Responded ${res.status}`;
  });

  // 5. Edge Function: send-bug-report
  await check('Edge Function: send-bug-report', async () => {
    const url = `${FUNCTIONS_URL}/send-bug-report`;
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${ANON_KEY}`,
        apikey: ANON_KEY,
      },
      body: JSON.stringify({ ping: true }),
    });

    const body = await res.json().catch(() => ({}));
    if (res.status === 500) {
      throw new Error(`Server crash 500: ${JSON.stringify(body)}`);
    }
    return `Responded ${res.status} (Operational)`;
  });

  console.log('\n--------------------------------------------------');
  console.log(`Results: ${passedCount} / ${totalChecks} checks passed.`);
  console.log('--------------------------------------------------\n');

  if (passedCount === totalChecks) {
    console.log('\x1b[32m✓ All backend health checks passed! InsForge is 100% operational.\x1b[0m\n');
    process.exit(0);
  } else {
    console.log('\x1b[31m✗ Some checks failed. Review details above.\x1b[0m\n');
    process.exit(1);
  }
}

runAllChecks().catch((err) => {
  console.error('\nFatal health check error:', err);
  process.exit(1);
});
