const CACHE_NAME = 'runwar-cache-v4';

// Only pre-cache critical small assets. Large media and hero images use runtime caching below.
const STATIC_ASSETS = [
  '/logo.png',
  '/manifest.webmanifest',
];

// Install Event
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(STATIC_ASSETS);
    }).then(() => self.skipWaiting())
  );
});

// Activate Event - clear old caches
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.map((key) => {
          if (key !== CACHE_NAME) {
            return caches.delete(key);
          }
        })
      );
    }).then(() => self.clients.claim())
  );
});

// Fetch Interceptor
self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;
  const url = new URL(event.request.url);
  const hostname = url.hostname.toLowerCase();
  const pathname = url.pathname.toLowerCase();

  // Skip APIs, InsForge backend, and all external map tile servers
  if (
    url.origin.includes('insforge.app') ||
    hostname.includes('openstreetmap') ||
    hostname.includes('cartocdn') ||
    hostname.includes('arcgisonline') ||
    hostname.includes('stadiamaps') ||
    hostname.includes('mapbox') ||
    pathname.includes('/tile') ||
    pathname.startsWith('/api')
  ) {
    return;
  }

  // 1. Navigation / HTML requests: Network-First (always get latest Vercel deployment)
  if (event.request.mode === 'navigate' || event.request.headers.get('accept')?.includes('text/html')) {
    event.respondWith(
      fetch(event.request)
        .then((networkResponse) => {
          if (networkResponse && networkResponse.status === 200) {
            const copy = networkResponse.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(event.request, copy));
          }
          return networkResponse;
        })
        .catch(() => {
          // Offline fallback
          return caches.match(event.request).then((cached) => cached || caches.match('/index.html'));
        })
    );
    return;
  }

  // 2. Static Assets (JS, CSS, Images): Stale-While-Revalidate
  event.respondWith(
    caches.match(event.request).then((cachedResponse) => {
      const fetchPromise = fetch(event.request)
        .then((networkResponse) => {
          if (networkResponse && networkResponse.status === 200) {
            const copy = networkResponse.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(event.request, copy));
          }
          return networkResponse;
        })
        .catch(() => null);

      return cachedResponse || fetchPromise;
    })
  );
});

// ── WEB PUSH HANDLERS ────────────────────────────────────────────────────────

const NOTIFICATION_ICONS = {
  alarm:       { icon: '/logo.png', badge: '/logo.png', color: '#10b981' },
  goal:        { icon: '/logo.png', badge: '/logo.png', color: '#f59e0b' },
  challenge:   { icon: '/logo.png', badge: '/logo.png', color: '#6366f1' },
  social:      { icon: '/logo.png', badge: '/logo.png', color: '#3b82f6' },
  workout:     { icon: '/logo.png', badge: '/logo.png', color: '#10b981' },
  achievement: { icon: '/logo.png', badge: '/logo.png', color: '#f59e0b' },
  streak:      { icon: '/logo.png', badge: '/logo.png', color: '#ef4444' },
  system:      { icon: '/logo.png', badge: '/logo.png', color: '#64748b' },
};

// 📳 Custom Haptic Patterns by Notification Category
const VIBRATION_PATTERNS = {
  alarm:       [200, 100, 200, 100, 500], // High-energy double pulse for wake-up / running alarms
  workout:     [200, 100, 200, 100, 500], // High-energy double pulse
  challenge:   [100, 50, 100],            // Fast urgent battle pulse
  social:      [80],                      // Subtle single tap for kudos & comments
  streak:      [150, 75, 150, 75, 300],   // Urgent streak-saver pulse
  achievement: [120, 80, 120, 80, 250],   // Fanfare cadence for unlocked badges
  goal:        [150, 100, 150],           // Medium double pulse
  system:      [100, 100, 100],           // Standard pulse
};

function getNotificationActions(type) {
  switch (type) {
    case 'alarm':
      return [
        { action: 'start_run', title: '🏃 Start Run' },
        { action: 'snooze', title: '⏰ Snooze 10m' },
      ];
    case 'streak':
      return [
        { action: 'start_run', title: '🔥 Run 1 km' },
      ];
    case 'goal':
      return [{ action: 'view_goal', title: '🎯 View Goal' }];
    case 'challenge':
      return [{ action: 'view_challenge', title: '⚔️ View Challenge' }];
    case 'achievement':
      return [{ action: 'view_achievement', title: '🏆 View Badges' }];
    default:
      return [];
  }
}

// Push event — triggered by InsForge Edge Function even when app is CLOSED
self.addEventListener('push', (event) => {
  if (!event.data) {
    console.warn('[SW] Push event received with no data');
    return;
  }

  let payload;
  try {
    payload = event.data.json();
  } catch {
    payload = {
      title: 'RunWar',
      body: event.data.text(),
      type: 'system',
      url: '/',
    };
  }

  const {
    title = 'RunWar',
    body = '',
    type = 'system',
    url = '/',
    notificationId,
    data = {},
  } = payload;

  const notifType = data?.type || type || 'system';
  const meta = NOTIFICATION_ICONS[notifType] || NOTIFICATION_ICONS.system;
  const vibration = VIBRATION_PATTERNS[notifType] || VIBRATION_PATTERNS.system;

  const options = {
    body,
    icon: meta.icon,
    badge: meta.badge,
    tag: notificationId || `runwar-${notifType}-${Date.now()}`,
    renotify: !!notificationId,
    requireInteraction: notifType === 'alarm' || notifType === 'streak',
    silent: false,
    vibrate: vibration,
    timestamp: Date.now(),
    data: { url, notificationId, type: notifType, ...data },
    actions: getNotificationActions(notifType),
  };

  event.waitUntil(
    self.registration.showNotification(title, options)
      .then(() => {
        console.log('[SW] Notification shown with custom haptics:', title, '| type:', notifType);
      })
      .catch((err) => {
        console.error('[SW] Failed to show notification:', err);
      })
  );
});

// Notification click — open / focus app and navigate to the correct route
self.addEventListener('notificationclick', (event) => {
  const notification = event.notification;
  const action = event.action;
  const { url = '/', notificationId, type } = notification.data || {};

  notification.close();

  // Handle Snooze action directly
  if (action === 'snooze') {
    const notifData = notification.data || {};
    const notifTitle = notification.title || 'Running Reminder';
    const notifBody = notification.body || 'Scheduled running alarm';

    event.waitUntil(
      (async () => {
        // 1. Show immediate confirmation
        await self.registration.showNotification('⏰ Run Alarm Snoozed (10m)', {
          body: 'Taking a 10-minute breather. Lace up soon!',
          icon: '/logo.png',
          badge: '/logo.png',
          tag: 'runwar-snooze-notice',
          vibrate: [100, 50, 100],
        });

        // 2. If alarm_id is present, reschedule the alarm in cloud database for +10 minutes
        if (notifData.alarm_id) {
          try {
            const snoozeUtc = new Date(Date.now() + 10 * 60 * 1000).toISOString();
            await fetch(`https://7p7ewmvi.us-east.insforge.app/api/database/records/alarms?id=eq.${notifData.alarm_id}`, {
              method: 'PATCH',
              headers: {
                'Content-Type': 'application/json',
                'apikey': 'ik_9d2a844d3d742c432e4c93745a27c78d',
                'Authorization': 'Bearer ik_9d2a844d3d742c432e4c93745a27c78d',
              },
              body: JSON.stringify({
                next_trigger_at: snoozeUtc,
                enabled: true,
                updated_at: new Date().toISOString(),
              }),
            });
            console.log('[SW] Snoozed alarm rescheduled in cloud for +10m');
          } catch (cloudErr) {
            console.warn('[SW] Cloud snooze failed, using fallback:', cloudErr);
          }
        }

        // 3. Set local fallback timer (in case app/worker stays alive)
        setTimeout(() => {
          self.registration.showNotification(notifTitle + ' (Snooze Ended)', {
            body: notifBody + ' • 10m snooze complete, let\'s run!',
            icon: '/logo.png',
            badge: '/logo.png',
            tag: `runwar-alarm-snooze-${Date.now()}`,
            vibrate: [200, 100, 200, 100, 500],
            requireInteraction: true,
            data: { url: '/?tab=home&action=start_run', type: 'alarm' },
            actions: [
              { action: 'start_run', title: '🏃 Start Run' },
              { action: 'snooze', title: '⏰ Snooze 10m' },
            ],
          });
        }, 10 * 60 * 1000);
      })()
    );
    return;
  }

  // Map action buttons to specific routes
  let targetUrl = url;
  if (action === 'start_run') targetUrl = '/?tab=home&action=start_run';
  else if (action === 'view_goal') targetUrl = '/?tab=goals';
  else if (action === 'view_challenge') targetUrl = '/?tab=challenges';
  else if (action === 'view_achievement') targetUrl = '/?tab=achievements';

  const absoluteUrl = new URL(targetUrl, self.location.origin).href;

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((windowClients) => {
      // Try to find an existing RunWar window and focus it
      const existingClient = windowClients.find(
        (c) => c.url.startsWith(self.location.origin) && 'focus' in c
      );

      if (existingClient) {
        // Post a message so the React app can navigate internally
        existingClient.postMessage({
          type: 'RUNWAR_NOTIFICATION_CLICK',
          url: targetUrl,
          notificationId,
          notificationType: type,
          action,
        });
        return existingClient.focus();
      }

      // No existing window — open the app
      return clients.openWindow(absoluteUrl);
    })
  );
});

// Notification close — track dismissals (optional analytics)
self.addEventListener('notificationclose', (event) => {
  const { notificationId, type } = event.notification.data || {};
  console.log('[SW] Notification dismissed:', notificationId, '| type:', type);
});
