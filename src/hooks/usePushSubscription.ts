import { useState, useEffect, useCallback } from 'react';
import {
  notificationService,
  isPushSupported,
  getPermissionStatus,
  isIOS,
  isStandalonePWA,
} from '../services/notificationService';
import { PushSubscriptionRecord } from '../types';

interface UsePushSubscriptionReturn {
  isSupported: boolean;
  permission: NotificationPermission;
  isSubscribed: boolean;
  isLoading: boolean;
  subscriptionCount: number;
  subscriptions: PushSubscriptionRecord[];
  currentEndpoint: string | null;
  isIOSDevice: boolean;
  needsIOSInstall: boolean;
  error: string | null;
  subscribe: () => Promise<void>;
  unsubscribe: () => Promise<void>;
  revokeDevice: (subscriptionId: string) => Promise<boolean>;
  requestPermission: () => Promise<NotificationPermission>;
  refresh: () => Promise<void>;
}

export function usePushSubscription(userId: string | null): UsePushSubscriptionReturn {
  const [isSubscribed, setIsSubscribed] = useState(false);
  const [permission, setPermission] = useState<NotificationPermission>('default');
  const [isLoading, setIsLoading] = useState(false);
  const [subscriptionCount, setSubscriptionCount] = useState(0);
  const [subscriptions, setSubscriptions] = useState<PushSubscriptionRecord[]>([]);
  const [currentEndpoint, setCurrentEndpoint] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const supported = isPushSupported();
  const iosDevice = isIOS();
  const standalone = isStandalonePWA();

  const refresh = useCallback(async () => {
    if (!supported) return;
    setPermission(getPermissionStatus());
    const subscribed = await notificationService.isSubscribed();
    setIsSubscribed(subscribed);

    const endpoint = await notificationService.getCurrentEndpoint();
    setCurrentEndpoint(endpoint);

    if (userId) {
      const activeSubs = await notificationService.getActiveSubscriptions(userId);
      setSubscriptions(activeSubs);
      setSubscriptionCount(activeSubs.length);
    }
  }, [supported, userId]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const requestPermission = useCallback(async (): Promise<NotificationPermission> => {
    const result = await notificationService.requestPermission();
    setPermission(result);
    return result;
  }, []);

  const subscribe = useCallback(async () => {
    if (!userId) { setError('You must be logged in to enable notifications'); return; }
    if (!supported) { setError('Push notifications are not supported in this browser'); return; }

    setIsLoading(true);
    setError(null);
    try {
      let perm = getPermissionStatus();
      if (perm === 'denied') {
        setError('Notification permission denied. Please enable it in your browser settings and try again.');
        return;
      }
      if (perm !== 'granted') {
        perm = await notificationService.requestPermission();
        setPermission(perm);
      }
      if (perm !== 'granted') {
        setError('Permission not granted. Please allow notifications when prompted.');
        return;
      }

      await notificationService.subscribe(userId);
      setIsSubscribed(true);
      const count = await notificationService.getSubscriptionCount(userId);
      setSubscriptionCount(count);
    } catch (err: any) {
      const msg = err?.message || 'Failed to enable push notifications';
      setError(msg);
      console.error('[usePushSubscription] subscribe error:', err);
    } finally {
      setIsLoading(false);
    }
  }, [userId, supported]);

  const unsubscribe = useCallback(async () => {
    if (!userId) return;
    setIsLoading(true);
    setError(null);
    try {
      await notificationService.unsubscribe(userId);
      setIsSubscribed(false);
      setSubscriptionCount(0);
    } catch (err: any) {
      setError(err?.message || 'Failed to disable push notifications');
    } finally {
      setIsLoading(false);
    }
  }, [userId]);

  const revokeDevice = useCallback(async (subscriptionId: string): Promise<boolean> => {
    if (!userId) return false;
    try {
      const ok = await notificationService.revokeSubscription(userId, subscriptionId);
      if (ok) {
        await refresh();
      }
      return ok;
    } catch (err: any) {
      setError(err?.message || 'Failed to remove device');
      return false;
    }
  }, [userId, refresh]);

  return {
    isSupported: supported,
    permission,
    isSubscribed,
    isLoading,
    subscriptionCount,
    subscriptions,
    currentEndpoint,
    isIOSDevice: iosDevice,
    needsIOSInstall: iosDevice && !standalone,
    error,
    subscribe,
    unsubscribe,
    revokeDevice,
    requestPermission,
    refresh,
  };
}
