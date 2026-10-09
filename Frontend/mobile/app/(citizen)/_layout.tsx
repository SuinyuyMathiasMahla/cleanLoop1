import { create } from 'zustand';
import { notificationsApi, Notification, getApiErrorMessage } from '../services/api';

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
  // Placeholder for now: it keeps the layout from crashing ("undefined is not a function").
  // Real push registration needs expo-notifications, a development build with FCM
  // credentials (Android), and a backend endpoint to store the token.
  registerPushToken: async () => {
    // intentionally empty: never throws, never blocks the UI
  },
}));