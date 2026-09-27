import { useState, useEffect, useCallback, useRef } from 'react';
import { AppNotification } from '../types';
import { notificationService } from '../services/notificationService';

interface UseNotificationsReturn {
  notifications: AppNotification[];
  unreadCount: number;
  isLoading: boolean;
  markAsRead: (id: string) => void;
  markAllAsRead: () => void;
  deleteNotification: (id: string) => void;
  deleteAllNotifications: () => void;
  refresh: () => Promise<void>;
}

export function useNotifications(userId: string | null): UseNotificationsReturn {
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const unsubRef = useRef<(() => void) | null>(null);

  const unreadCount = notifications.filter(
    (n) => !n.read_at && n.status === 'sent'
  ).length;

  const refresh = useCallback(async () => {
    if (!userId) return;
    setIsLoading(true);
    try {
      const data = await notificationService.getNotifications(userId, 60);
      setNotifications(data);
    } catch (err) {
      console.warn('[useNotifications] refresh error:', err);
    } finally {
      setIsLoading(false);
    }
  }, [userId]);

  // Initial load + realtime subscription
  useEffect(() => {
    if (!userId) return;

    refresh();

    // Subscribe to realtime inserts
    unsubRef.current = notificationService.subscribeToRealtime(userId, (newNotif) => {
      setNotifications((prev) => {
        // Don't duplicate
        if (prev.some((n) => n.id === newNotif.id)) return prev;
        return [newNotif, ...prev];
      });
    });

    // Polling fallback every 30 seconds
    const interval = setInterval(() => {
      refresh();
    }, 30000);

    const onFocus = () => {
      if (document.visibilityState === 'visible') {
        refresh();
      }
    };
    window.addEventListener('focus', onFocus);
    document.addEventListener('visibilitychange', onFocus);

    return () => {
      clearInterval(interval);
      window.removeEventListener('focus', onFocus);
      document.removeEventListener('visibilitychange', onFocus);
      unsubRef.current?.();
      unsubRef.current = null;
    };
  }, [userId, refresh]);

  const markAsRead = useCallback((id: string) => {
    setNotifications((prev) =>
      prev.map((n) => n.id === id ? { ...n, read_at: new Date().toISOString() } : n)
    );
    notificationService.markAsRead(id).catch(() => {});
  }, []);

  const markAllAsRead = useCallback(() => {
    if (!userId) return;
    const now = new Date().toISOString();
    setNotifications((prev) => prev.map((n) => ({ ...n, read_at: n.read_at || now })));
    notificationService.markAllAsRead(userId).catch(() => {});
  }, [userId]);

  const deleteNotification = useCallback((id: string) => {
    setNotifications((prev) => prev.filter((n) => n.id !== id));
    notificationService.deleteNotification(id).catch(() => {});
  }, []);

  const deleteAllNotifications = useCallback(() => {
    if (!userId) return;
    setNotifications([]);
    notificationService.deleteAllNotifications(userId).catch(() => {});
  }, [userId]);

  return {
    notifications,
    unreadCount,
    isLoading,
    markAsRead,
    markAllAsRead,
    deleteNotification,
    deleteAllNotifications,
    refresh,
  };
}
