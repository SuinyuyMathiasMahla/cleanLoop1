import { create } from 'zustand';
import { Platform } from 'react-native';
import * as Device from 'expo-device';
import Constants from 'expo-constants';
import { notificationsApi, Notification, getApiErrorMessage } from '../services/api';

// expo-notifications THROWS when it is merely imported inside Expo Go on Android (removed in SDK 53).
// A top-level `import` therefore crashed every route that touched this store. Load it lazily instead,
// and skip it in Expo Go. Push notifications work in a development build / production build.
const isExpoGo =
  Constants.executionEnvironment === 'storeClient' || Constants.appOwnership === 'expo';

type NotificationsModule = typeof import('expo-notifications');
let Notifications: NotificationsModule | null = null;

if (!(isExpoGo && Platform.OS === 'android') && Platform.OS !== 'web') {
  try {
    // Optional native module: loaded lazily so the app still runs where it is missing.
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    Notifications = require('expo-notifications') as NotificationsModule;
  } catch (err) {
    console.log('expo-notifications unavailable, push disabled:', err);
  }
}

// Show notifications while the app is open. Guarded so a missing native module can't crash startup.
try {
  Notifications?.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowBanner: true,
      shouldShowList: true,
      shouldPlaySound: false,
      shouldSetBadge: false,
    }),
  });
} catch (err) {
  console.log('Notification handler not set:', err);
}

// Avoid re-sending the same token every time the layout re-renders
let lastRegisteredToken: string | null = null;

interface NotificationState {
  notifications: Notification[];
  unreadCount: number;
  isLoading: boolean;
  error: string | null;

  fetchNotifications: () => Promise<void>;
  markRead: (id: string) => Promise<void>;
  markAllRead: () => Promise<void>;
  remove: (id: string) => Promise<void>;
  reset: () => void;
  registerPushToken: () => Promise<void>;
  clearError: () => void;
}

export const useNotificationStore = create<NotificationState>((set, get) => ({
  notifications: [],
  unreadCount: 0,
  isLoading: false,
  error: null,

  clearError: () => set({ error: null }),

  fetchNotifications: async () => {
    set({ isLoading: true, error: null });
    try {
      const response = await notificationsApi.getAll();

      // Lambda returns { data: [...], notifications: [...] } — check all shapes
      const notifications: Notification[] =
        response.data?.data ?? response.data?.notifications ?? response.data?.items ?? [];

      const unreadCount = notifications.filter((n) => !n.read).length;
      set({ notifications, unreadCount, isLoading: false });
    } catch (err) {
      set({ isLoading: false, error: getApiErrorMessage(err) });
    }
  },

  markRead: async (id: string) => {
    try {
      await notificationsApi.markRead(id);
      set((state) => {
        const notifications = state.notifications.map((n) =>
          (n.notificationId ?? n.id) === id ? { ...n, read: true } : n,
        );
        return { notifications, unreadCount: notifications.filter((n) => !n.read).length };
      });
    } catch (err) {
      set({ error: getApiErrorMessage(err) });
    }
  },

  remove: async (id: string) => {
    const previous = get().notifications;
    const notifications = previous.filter((n) => (n.notificationId ?? n.id) !== id);
    set({ notifications, unreadCount: notifications.filter((n) => !n.read).length });
    try {
      await notificationsApi.delete(id);
    } catch (err) {
      // Roll back the optimistic removal
      set({
        notifications: previous,
        unreadCount: previous.filter((n) => !n.read).length,
        error: getApiErrorMessage(err),
      });
    }
  },

  reset: () => set({ notifications: [], unreadCount: 0, error: null }),

  markAllRead: async () => {
    try {
      await notificationsApi.markAllRead();
      set((state) => ({
        notifications: state.notifications.map((n) => ({ ...n, read: true })),
        unreadCount: 0,
      }));
    } catch (err) {
      set({ error: getApiErrorMessage(err) });
    }
  },

  // Called from app/(citizen)/_layout.tsx once the user is signed in.
  // Gets the device's Expo push token and sends it to POST /notifications/register-push-token.
  // Never throws: push is a nice-to-have and must not break the app.
  registerPushToken: async () => {
    try {
      // Needs a real phone and a build where expo-notifications is available (not Expo Go on Android).
      if (!Notifications || Platform.OS === 'web' || !Device.isDevice) return;

      const existing = await Notifications.getPermissionsAsync();
      let status = existing.status;
      if (status !== 'granted') {
        status = (await Notifications.requestPermissionsAsync()).status;
      }
      if (status !== 'granted') return;

      if (Platform.OS === 'android') {
        await Notifications.setNotificationChannelAsync('default', {
          name: 'Default',
          importance: Notifications.AndroidImportance.MAX,
        });
      }

      const projectId =
        Constants.expoConfig?.extra?.eas?.projectId ?? Constants.easConfig?.projectId;
      const { data: token } = await Notifications.getExpoPushTokenAsync(
        projectId ? { projectId } : undefined,
      );

      if (!token || token === lastRegisteredToken) return;
      await notificationsApi.registerPushToken(token);
      lastRegisteredToken = token;
    } catch (err) {
      console.log('Push token registration skipped:', err);
    }
  },
}));
