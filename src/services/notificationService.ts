import { insforge } from '../lib/insforge';
import { AppNotification, PushSubscriptionRecord } from '../types';

const INSFORGE_URL = import.meta.env.VITE_INSFORGE_URL || 'https://7p7ewmvi.us-east.insforge.app';
const FUNCTIONS_URL = import.meta.env.VITE_INSFORGE_FUNCTIONS_URL || 'https://7p7ewmvi.function2.insforge.app';
const VAPID_PUBLIC_KEY = import.meta.env.VITE_VAPID_PUBLIC_KEY || '';

// ── Browser Feature Detection ─────────────────────────────────────────────────

export function isPushSupported(): boolean {
  return (
    'Notification' in window &&
    'serviceWorker' in navigator &&
    'PushManager' in window
  );
}

export function getPermissionStatus(): NotificationPermission {
  if (!('Notification' in window)) return 'denied';
  return Notification.permission;
}

export function isIOS(): boolean {
  return /iPad|iPhone|iPod/.test(navigator.userAgent) && !(window as any).MSStream;
}

export function isStandalonePWA(): boolean {
  return window.matchMedia('(display-mode: standalone)').matches ||
    (navigator as any).standalone === true;
}

// ── VAPID Key Conversion ──────────────────────────────────────────────────────

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = window.atob(base64);
  return Uint8Array.from([...rawData].map((c) => c.charCodeAt(0)));
}

// ── Subscription Helpers ──────────────────────────────────────────────────────

async function getActiveServiceWorkerRegistration(): Promise<ServiceWorkerRegistration> {
  const reg = await navigator.serviceWorker.getRegistration('/');
  if (reg) return reg;
  return navigator.serviceWorker.register('/sw.js');
}

function extractSubscriptionKeys(sub: PushSubscription): { p256dh: string; auth: string } {
  const rawKey = sub.getKey('p256dh');
  const rawAuth = sub.getKey('auth');
  if (!rawKey || !rawAuth) throw new Error('Push subscription keys are missing');
  return {
    p256dh: btoa(String.fromCharCode(...new Uint8Array(rawKey))),
    auth: btoa(String.fromCharCode(...new Uint8Array(rawAuth))),
  };
}

function getDeviceInfo(): Record<string, string> {
  const ua = navigator.userAgent;
  const isChrome = ua.includes('Chrome');
  const isFirefox = ua.includes('Firefox');
  const isSafari = ua.includes('Safari') && !isChrome;
  const isEdge = ua.includes('Edg');
  return {
    browser: isEdge ? 'Edge' : isChrome ? 'Chrome' : isFirefox ? 'Firefox' : isSafari ? 'Safari' : 'Other',
    platform: navigator.platform || 'Unknown',
    language: navigator.language || 'en',
  };
}

// ── Main Service ──────────────────────────────────────────────────────────────

export const notificationService = {
  /**
   * Request browser notification permission.
   * Returns: 'granted' | 'denied' | 'default'
   */
  async requestPermission(): Promise<NotificationPermission> {
    if (!isPushSupported()) return 'denied';
    if (Notification.permission === 'granted') return 'granted';
    if (Notification.permission === 'denied') return 'denied';
    const result = await Notification.requestPermission();
    console.log('[notificationService] Permission result:', result);
    return result;
  },

  /**
   * Subscribe to push notifications and store subscription in InsForge.
   * Returns the stored subscription record, or null on failure.
   */
  async subscribe(userId: string): Promise<PushSubscriptionRecord | null> {
    if (!isPushSupported()) {
      console.warn('[notificationService] Push not supported in this browser');
      return null;
    }

    if (!VAPID_PUBLIC_KEY) {
      console.error('[notificationService] VITE_VAPID_PUBLIC_KEY is not set in .env.local');
      throw new Error('VAPID public key not configured. Add VITE_VAPID_PUBLIC_KEY to .env.local');
    }

    if (Notification.permission !== 'granted') {
      throw new Error('Notification permission not granted');
    }

    const reg = await getActiveServiceWorkerRegistration();

    // Wait for SW to be active (important on first load)
    await new Promise<void>((resolve) => {
      if (reg.active) { resolve(); return; }
      const sw = reg.installing || reg.waiting;
      if (sw) {
        sw.addEventListener('statechange', () => {
          if (sw.state === 'activated') resolve();
        });
      } else {
        resolve();
      }
    });

    const applicationServerKey = urlBase64ToUint8Array(VAPID_PUBLIC_KEY);
    const pushSub = await reg.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: applicationServerKey as unknown as BufferSource,
    });

    const { p256dh, auth } = extractSubscriptionKeys(pushSub);
    const deviceInfo = getDeviceInfo();

    const record = {
      user_id: userId,
      endpoint: pushSub.endpoint,
      p256dh,
      auth,
      device_info: deviceInfo,
      user_agent: navigator.userAgent.slice(0, 500),
      last_seen_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    // Upsert by (user_id, endpoint) to avoid duplicates
    const { data, error } = await insforge.database
      .from('push_subscriptions')
      .upsert([record], { onConflict: 'user_id,endpoint' })
      .select()
      .single();

    if (error) {
      console.error('[notificationService] Failed to store subscription:', error.message);
      throw new Error('Failed to save push subscription: ' + error.message);
    }

    console.log('[notificationService] Subscribed and stored:', (data as PushSubscriptionRecord).id);
    return data as PushSubscriptionRecord;
  },

  /**
   * Unsubscribe from push and revoke the subscription in DB
   */
  async unsubscribe(userId: string): Promise<void> {
    try {
      const reg = await navigator.serviceWorker.getRegistration('/');
      if (reg) {
        const sub = await reg.pushManager.getSubscription();
        if (sub) {
          await sub.unsubscribe();
          // Mark revoked in DB
          await insforge.database
            .from('push_subscriptions')
            .update({ revoked_at: new Date().toISOString(), updated_at: new Date().toISOString() })
            .eq('user_id', userId)
            .eq('endpoint', sub.endpoint);
          console.log('[notificationService] Unsubscribed and revoked');
        }
      }
    } catch (err: any) {
      console.warn('[notificationService] Unsubscribe error:', err?.message);
    }
  },

  /**
   * Check if the current browser is actively subscribed
   */
  async isSubscribed(): Promise<boolean> {
    try {
      const reg = await navigator.serviceWorker.getRegistration('/');
      if (!reg) return false;
      const sub = await reg.pushManager.getSubscription();
      return !!sub;
    } catch {
      return false;
    }
  },

  /**
   * Get count of active (non-revoked) subscriptions for a user
   */
  async getSubscriptionCount(userId: string): Promise<number> {
    try {
      const { data } = await insforge.database
        .from('push_subscriptions')
        .select('id')
        .eq('user_id', userId)
        .is('revoked_at', null);
      return (data || []).length;
    } catch {
      return 0;
    }
  },

  /**
   * Get all active push subscriptions for a user (devices linked)
   */
  async getActiveSubscriptions(userId: string): Promise<PushSubscriptionRecord[]> {
    try {
      const { data, error } = await insforge.database
        .from('push_subscriptions')
        .select('*')
        .eq('user_id', userId)
        .is('revoked_at', null)
        .order('created_at', { ascending: false });

      if (error) {
        console.warn('[notificationService] getActiveSubscriptions error:', error.message);
        return [];
      }
      return (data as PushSubscriptionRecord[]) || [];
    } catch {
      return [];
    }
  },

  /**
   * Get the current browser's push endpoint string (if subscribed)
   */
  async getCurrentEndpoint(): Promise<string | null> {
    try {
      const reg = await navigator.serviceWorker.getRegistration('/');
      if (!reg) return null;
      const sub = await reg.pushManager.getSubscription();
      return sub ? sub.endpoint : null;
    } catch {
      return null;
    }
  },

  /**
   * Revoke a specific subscription (device)
   */
  async revokeSubscription(userId: string, subscriptionId: string): Promise<boolean> {
    try {
      // If the subscription being revoked is the current browser, unsubscribe locally too
      const currentEndpoint = await this.getCurrentEndpoint();
      const { data: subData } = await insforge.database
        .from('push_subscriptions')
        .select('endpoint')
        .eq('id', subscriptionId)
        .maybeSingle();

      if (subData && currentEndpoint && subData.endpoint === currentEndpoint) {
        const reg = await navigator.serviceWorker.getRegistration('/');
        if (reg) {
          const sub = await reg.pushManager.getSubscription();
          if (sub) await sub.unsubscribe();
        }
      }

      const { error } = await insforge.database
        .from('push_subscriptions')
        .update({ revoked_at: new Date().toISOString(), updated_at: new Date().toISOString() })
        .eq('id', subscriptionId)
        .eq('user_id', userId);

      if (error) throw error;
      return true;
    } catch (err: any) {
      console.warn('[notificationService] revokeSubscription error:', err?.message);
      return false;
    }
  },

  // ── Notifications ───────────────────────────────────────────────────────────

  /**
   * Fetch recent notifications for a user (unread first)
   */
  async getNotifications(userId: string, limit = 50): Promise<AppNotification[]> {
    try {
      const { data, error } = await insforge.database
        .from('notifications')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .limit(limit);

      if (error) {
        console.warn('[notificationService] getNotifications error:', error.message);
        return [];
      }
      return (data as AppNotification[]) || [];
    } catch (err: any) {
      console.warn('[notificationService] getNotifications exception:', err?.message);
      return [];
    }
  },

  /**
   * Get count of unread notifications
   */
  async getUnreadCount(userId: string): Promise<number> {
    try {
      const { data } = await insforge.database
        .from('notifications')
        .select('id')
        .eq('user_id', userId)
        .is('read_at', null)
        .eq('status', 'sent');
      return (data || []).length;
    } catch {
      return 0;
    }
  },

  /**
   * Mark a single notification as read
   */
  async markAsRead(notificationId: string): Promise<void> {
    try {
      await insforge.database
        .from('notifications')
        .update({ read_at: new Date().toISOString(), updated_at: new Date().toISOString() })
        .eq('id', notificationId)
        .is('read_at', null);
    } catch (err: any) {
      console.warn('[notificationService] markAsRead error:', err?.message);
    }
  },

  /**
   * Mark all notifications as read for a user
   */
  async markAllAsRead(userId: string): Promise<void> {
    try {
      await insforge.database
        .from('notifications')
        .update({ read_at: new Date().toISOString(), updated_at: new Date().toISOString() })
        .eq('user_id', userId)
        .is('read_at', null);
    } catch (err: any) {
      console.warn('[notificationService] markAllAsRead error:', err?.message);
    }
  },

  /**
   * Delete a notification
   */
  async deleteNotification(notificationId: string): Promise<void> {
    try {
      await insforge.database
        .from('notifications')
        .delete()
        .eq('id', notificationId);
    } catch (err: any) {
      console.warn('[notificationService] deleteNotification error:', err?.message);
    }
  },

  /**
   * Delete all notifications for a user
   */
  async deleteAllNotifications(userId: string): Promise<void> {
    try {
      await insforge.database
        .from('notifications')
        .delete()
        .eq('user_id', userId);
    } catch (err: any) {
      console.warn('[notificationService] deleteAllNotifications error:', err?.message);
    }
  },

  /**
   * Create an immediate (non-alarm) notification in DB — for goals, social, etc.
   * The cron processor picks this up and sends it as a push.
   */
  async createNotification(payload: {
    userId: string;
    type: string;
    subtype?: string;
    title: string;
    message: string;
    data?: Record<string, any>;
    url?: string;
  }): Promise<AppNotification | null> {
    try {
      // 1. Check user notification preferences before inserting
      try {
        const { data: userPref } = await insforge.database
          .from('user_settings')
          .select('notifications_enabled, notif_running_reminders, notif_goals, notif_challenges, notif_social, notif_achievements, notif_system')
          .eq('user_id', payload.userId)
          .maybeSingle();

        if (userPref && payload.subtype !== 'test') {
          // Master notification toggle
          if (userPref.notifications_enabled === false) {
            console.log('[notificationService] Master notifications disabled for user, skipping notification');
            return null;
          }

          // Category mapping
          const catMap: Record<string, string> = {
            alarm: 'notif_running_reminders',
            workout: 'notif_running_reminders',
            goal: 'notif_goals',
            challenge: 'notif_challenges',
            duel: 'notif_challenges',
            social: 'notif_social',
            kudos: 'notif_social',
            achievement: 'notif_achievements',
            badge: 'notif_achievements',
            system: 'notif_system',
          };
          const prefKey = catMap[payload.type];
          if (prefKey && (userPref as any)[prefKey] === false) {
            console.log(`[notificationService] Category '${prefKey}' disabled for user, skipping notification`);
            return null;
          }
        }
      } catch (prefErr) {
        console.warn('[notificationService] Error verifying preferences:', prefErr);
      }

      const record = {
        user_id: payload.userId,
        type: payload.type,
        subtype: payload.subtype || null,
        title: payload.title,
        message: payload.message,
        data: { url: payload.url || '/', ...(payload.data || {}) },
        alarm_id: null,
        scheduled_for: new Date().toISOString(),
        occurrence_key: null,
        status: 'pending',
        sent_at: null,
        read_at: null,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

      const { data, error } = await insforge.database
        .from('notifications')
        .insert([record])
        .select()
        .single();

      if (error) {
        console.warn('[notificationService] createNotification error:', error.message);
        return null;
      }

      // Broadcast to realtime channel if available
      try {
        if (data && insforge.realtime && typeof (insforge.realtime as any).publish === 'function') {
          (insforge.realtime as any).publish(`notifications:${payload.userId}`, 'message', {
            channel: `notifications:${payload.userId}`,
            table: 'notifications',
            eventType: 'INSERT',
            payload: { new: data },
          }).catch(() => {});
        }
      } catch {}

      return data as AppNotification;
    } catch (err: any) {
      console.warn('[notificationService] createNotification exception:', err?.message);
      return null;
    }
  },

  /**
   * Subscribe to realtime notification inserts for a user.
   * Returns unsubscribe function.
   */
  subscribeToRealtime(userId: string, onNew: (n: AppNotification) => void): () => void {
    try {
      const channelName = `notifications:${userId}`;
      if (insforge.realtime && typeof (insforge.realtime as any).subscribe === 'function') {
        (insforge.realtime as any).subscribe(channelName).catch(() => {});

        const handler = (msg: any) => {
          if (msg?.channel === channelName || msg?.table === 'notifications' || msg?.user_id === userId) {
            const rec = msg?.payload?.new || msg?.payload || msg?.data || msg?.notification;
            if (rec && rec.user_id === userId) {
              onNew(rec as AppNotification);
            }
          }
        };

        if (typeof (insforge.realtime as any).on === 'function') {
          (insforge.realtime as any).on('message', handler);
        }

        return () => {
          try {
            if (typeof (insforge.realtime as any).off === 'function') {
              (insforge.realtime as any).off('message', handler);
            }
            if (typeof (insforge.realtime as any).unsubscribe === 'function') {
              (insforge.realtime as any).unsubscribe(channelName);
            }
          } catch {}
        };
      }
      return () => {};
    } catch (err) {
      console.warn('[notificationService] realtime subscribe error:', err);
      return () => {};
    }
  },

  /**
   * Send a test push notification via the InsForge edge function
   */
  async sendTestNotification(userId: string, delaySeconds: number = 0): Promise<void> {
    // First create a notification record
    const notif = await this.createNotification({
      userId,
      type: 'system',
      subtype: 'test',
      title: '🔔 RunWar Chrome Push',
      message: delaySeconds > 0
        ? `Delivered via Google Chrome! (Cloud delay: ${delaySeconds}s) Web Push works even with the app closed.`
        : 'Push notifications are working! You will receive RunWar alerts even when the app is closed.',
      url: '/',
    });

    if (!notif) throw new Error('Failed to create test notification');

    // Trigger the edge function to send push immediately
    const anonKey = import.meta.env.VITE_INSFORGE_ANON_KEY || '';
    const res = await fetch(`${FUNCTIONS_URL}/send-push-notification`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${anonKey}`,
        'apikey': anonKey,
      },
      body: JSON.stringify({
        notificationId: notif.id,
        userId,
        title: notif.title,
        body: notif.message,
        url: '/',
        type: 'system',
        delaySeconds,
      }),
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err?.error || `Edge function returned ${res.status}`);
    }

    console.log('[notificationService] Test notification sent');
  },
};
