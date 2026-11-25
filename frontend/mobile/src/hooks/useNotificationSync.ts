import { useEffect } from 'react';
import { AppState } from 'react-native';
import { useAuthStore } from '@/store/authStore';
import { useNotificationStore } from '@/store/notificationStore';

const POLL_MS = 60_000;

/**
 * Keeps the unread badge fresh: fetches on sign-in, every minute while the app
 * is in the foreground and whenever the app returns from the background.
 * Also registers the device for push notifications once per session.
 */
export function useNotificationSync() {
  const user = useAuthStore((s) => s.user);
  const fetchNotifications = useNotificationStore((s) => s.fetchNotifications);
  const registerPushToken = useNotificationStore((s) => s.registerPushToken);

  useEffect(() => {
    if (!user) return;

    fetchNotifications();
    registerPushToken();

    const timer = setInterval(fetchNotifications, POLL_MS);
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active') fetchNotifications();
    });

    return () => {
      clearInterval(timer);
      sub.remove();
    };
  }, [user?.userId]);
}
