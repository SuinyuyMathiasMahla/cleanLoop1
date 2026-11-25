import React, { useCallback, useMemo } from 'react';
import {
  View,
  Text,
  SectionList,
  TouchableOpacity,
  RefreshControl,
  StyleSheet,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useFocusEffect } from 'expo-router';
import { ScreenShell } from './ScreenShell';
import { AppRole } from './AppHeader';
import { EmptyState } from './EmptyState';
import { LoadingSpinner } from './LoadingSpinner';
import { Notification } from '@/services/api';
import { useNotificationStore } from '@/store/notificationStore';
import { timeAgo } from '@/utils/format';
import { colors } from '@/theme/colors';

const TYPE_STYLE: Record<string, { icon: any; bg: string; color: string }> = {
  task_assigned: { icon: 'clipboard', bg: '#d1fae5', color: '#065f46' },
  task_updated: { icon: 'create', bg: '#dbeafe', color: '#1e40af' },
  report_new: { icon: 'alert-circle', bg: '#fef3c7', color: '#92400e' },
  report_resolved: { icon: 'checkmark-circle', bg: '#d1fae5', color: '#065f46' },
  task_overdue: { icon: 'time', bg: '#fee2e2', color: '#b91c1c' },
  general: { icon: 'megaphone', bg: colors.primaryLight, color: colors.primary },
};

function idOf(n: Notification) {
  return n.notificationId ?? n.id;
}

function groupByDate(items: Notification[]) {
  const today = new Date().toDateString();
  const yesterday = new Date(Date.now() - 86400000).toDateString();
  const groups = new Map<string, Notification[]>();
  items.forEach((n) => {
    const d = new Date(n.createdAt);
    const label =
      d.toDateString() === today
        ? 'Today'
        : d.toDateString() === yesterday
          ? 'Yesterday'
          : d.toLocaleDateString(undefined, { month: 'long', day: 'numeric' });
    groups.set(label, [...(groups.get(label) ?? []), n]);
  });
  return Array.from(groups, ([title, data]) => ({ title, data }));
}

export function NotificationsView({ role }: { role: AppRole }) {
  const router = useRouter();
  const {
    notifications,
    unreadCount,
    isLoading,
    error,
    fetchNotifications,
    markRead,
    markAllRead,
    remove,
  } = useNotificationStore();

  // Refresh whenever the tab gains focus so the list and badge stay current
  useFocusEffect(
    useCallback(() => {
      fetchNotifications();
    }, [fetchNotifications]),
  );

  const sections = useMemo(
    () =>
      groupByDate(
        [...notifications].sort(
          (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
        ),
      ),
    [notifications],
  );

  async function open(n: Notification) {
    if (!n.read) markRead(idOf(n));
    if (role === 'crew' && n.taskId) {
      router.push(`/(crew)/task/${n.taskId}` as any);
    } else if (role === 'citizen' && n.reportId) {
      router.navigate('/(citizen)/tabs/my-reports' as any);
    }
  }

  const markAll = unreadCount > 0 && (
    <TouchableOpacity style={styles.markAll} onPress={markAllRead} activeOpacity={0.8}>
      <Ionicons name="checkmark-done" size={15} color="#fff" />
      <Text style={styles.markAllText}>Read all</Text>
    </TouchableOpacity>
  );

  return (
    <ScreenShell
      role={role}
      title="Alerts"
      subtitle={
        unreadCount > 0
          ? `${unreadCount} unread ${unreadCount === 1 ? 'notification' : 'notifications'}`
          : "You're all caught up"
      }
      titleRight={markAll || undefined}
    >
      {isLoading && notifications.length === 0 ? (
        <LoadingSpinner fullScreen message="Loading alerts..." />
      ) : (
        <SectionList
          sections={sections}
          keyExtractor={(item) => idOf(item)}
          stickySectionHeadersEnabled={false}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={[styles.list, sections.length === 0 && { flex: 1 }]}
          refreshControl={
            <RefreshControl
              refreshing={isLoading}
              onRefresh={fetchNotifications}
              tintColor={colors.primary}
              colors={[colors.primary]}
            />
          }
          renderSectionHeader={({ section }) => (
            <Text style={styles.sectionLabel}>{section.title}</Text>
          )}
          renderItem={({ item }) => {
            const t = TYPE_STYLE[item.type] ?? TYPE_STYLE.general;
            return (
              <TouchableOpacity
                style={[styles.card, !item.read && styles.cardUnread]}
                onPress={() => open(item)}
                activeOpacity={0.8}
              >
                <View style={[styles.icon, { backgroundColor: t.bg }]}>
                  <Ionicons name={t.icon} size={19} color={t.color} />
                </View>
                <View style={styles.body}>
                  <View style={styles.topRow}>
                    <Text
                      style={[styles.title, !item.read && styles.titleUnread]}
                      numberOfLines={1}
                    >
                      {item.title}
                    </Text>
                    <Text style={styles.time}>{timeAgo(item.createdAt)}</Text>
                  </View>
                  <Text style={styles.message} numberOfLines={2}>
                    {item.body}
                  </Text>
                  {role === 'crew' && !!item.taskId && (
                    <View style={styles.link}>
                      <Text style={styles.linkText}>View task</Text>
                      <Ionicons name="arrow-forward" size={12} color={colors.primary} />
                    </View>
                  )}
                </View>
                {!item.read && <View style={styles.unreadDot} />}
                <TouchableOpacity
                  onPress={() => remove(idOf(item))}
                  hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                  accessibilityLabel="Dismiss notification"
                >
                  <Ionicons name="close" size={16} color={colors.gray[300]} />
                </TouchableOpacity>
              </TouchableOpacity>
            );
          }}
          ListEmptyComponent={
            <EmptyState
              icon="notifications-outline"
              title={error ? 'Could not load alerts' : 'No alerts yet'}
              subtitle={
                error ??
                (role === 'crew'
                  ? "You'll be notified here when new tasks are assigned to you."
                  : "You'll be notified here about new community reports and resolved cleanups.")
              }
              actionLabel={error ? 'Try again' : undefined}
              onAction={error ? fetchNotifications : undefined}
            />
          }
        />
      )}
    </ScreenShell>
  );
}

const styles = StyleSheet.create({
  list: { paddingHorizontal: 16, paddingTop: 18, paddingBottom: 28 },
  sectionLabel: {
    fontSize: 11,
    fontWeight: '800',
    color: colors.gray[500],
    letterSpacing: 0.9,
    textTransform: 'uppercase',
    marginTop: 6,
    marginBottom: 10,
  },
  markAll: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: 'rgba(255,255,255,0.14)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.25)',
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  markAllText: { fontSize: 12, fontWeight: '700', color: '#fff' },
  card: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    backgroundColor: '#fff',
    borderRadius: 1,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 14,
    marginBottom: 10,
  },
  cardUnread: { borderColor: '#bfe5cf', backgroundColor: '#f7fcf9' },
  icon: { width: 42, height: 42, borderRadius: 6, alignItems: 'center', justifyContent: 'center' },
  body: { flex: 1 },
  topRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 3 },
  title: { flex: 1, fontSize: 14, fontWeight: '600', color: colors.gray[700] },
  titleUnread: { fontWeight: '800', color: colors.gray[900] },
  time: { fontSize: 11, color: colors.gray[500] },
  message: { fontSize: 13, lineHeight: 18, color: colors.gray[500] },
  link: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 7 },
  linkText: { fontSize: 12, fontWeight: '700', color: colors.primary },
  unreadDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: colors.accent, marginTop: 6 },
});
