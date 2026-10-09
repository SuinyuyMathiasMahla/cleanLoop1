import { create } from 'zustand';
import { Platform } from 'react-native';
import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import Constants from 'expo-constants';
import { notificationsApi, Notification, getApiErrorMessage } from '../services/api';

// Show notifications while the app is open. Guarded so a missing native module can't crash startup.
try {
  Notifications.setNotificationHandler({
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
        response.data?.data ??
        response.data?.notifications ??
        response.data?.items ??
        [];

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
          n.id === id || n.notificationId === id ? { ...n, read: true } : n
        );
        return { notifications, unreadCount: notifications.filter((n) => !n.read).length };
      });
    } catch (err) {
      set({ error: getApiErrorMessage(err) });
    }
  },

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
      if (Platform.OS === 'web' || !Device.isDevice) return; // needs a real phone

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
        projectId ? { projectId } : undefined
      );

      if (!token || token === lastRegisteredToken) return;
      await notificationsApi.registerPushToken(token);
      lastRegisteredToken = token;
    } catch (err) {
      console.log('Push token registration skipped:', err);
    }
  },
}));