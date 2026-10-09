import React, { useEffect, useCallback, useRef, useState } from 'react';
import {
  View,
  Text,
  FlatList,
  RefreshControl,
  TouchableOpacity,
  StyleSheet,
  Animated,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Swipeable } from 'react-native-gesture-handler';
import { Ionicons } from '@expo/vector-icons';
import { NotificationItem } from '@/components/citizen/NotificationItem';
import { EmptyState } from '@/components/common/EmptyState';
import { LoadingSpinner } from '@/components/common/LoadingSpinner';
import { useNotificationStore } from '@/store/notificationStore';
import { colors } from '@/theme/colors';

const PRIMARY = '#1a7a5e';
const DARK    = '#0f1f1a';
const MUTED   = '#6b7c76';

function SwipeableNotification({
  item,
  onPress,
  onHide,
}: {
  item: any;
  onPress: () => void;
  onHide: (id: string) => void;
}) {
  const swipeRef = useRef<Swipeable>(null);

  const renderLeftActions = (
    progress: Animated.AnimatedInterpolation<number>
  ) => {
    const translateX = progress.interpolate({
      inputRange: [0, 1],
      outputRange: [-80, 0],
    });
    return (
      <Animated.View style={[styles.swipeAction, { transform: [{ translateX }] }]}>
        <Ionicons name="eye-off-outline" size={20} color="#fff" />
        <Text style={styles.swipeActionText}>Hide</Text>
      </Animated.View>
    );
  };

  return (
    <Swipeable
      ref={swipeRef}
      renderLeftActions={renderLeftActions}
      leftThreshold={60}
      onSwipeableOpen={(direction) => {
        if (direction === 'left') {
          swipeRef.current?.close();
          onHide(item.id);
        }
      }}
      friction={2}
      overshootLeft={false}
    >
      <NotificationItem notification={item} onPress={onPress} />
    </Swipeable>
  );
}

export default function NotificationsScreen() {
  const { notifications, unreadCount, isLoading, fetchNotifications, markRead, markAllRead } =
    useNotificationStore();

  const [hiddenIds, setHiddenIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    fetchNotifications();
  }, []);

  const onRefresh = useCallback(() => {
    fetchNotifications();
  }, []);

  const handleHide = useCallback((id: string) => {
    setHiddenIds(prev => new Set([...prev, id]));
  }, []);

  const visible = notifications.filter(n => !hiddenIds.has(n.id));
  const visibleUnread = visible.filter(n => !n.read).length;

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>

      {/* HEADER — green */}
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <Text style={styles.headerTitle}>Notifications</Text>
          <Text style={styles.headerSub}>
            {visible.length} total · {visibleUnread} unread
          </Text>
        </View>
        {visibleUnread > 0 && (
          <TouchableOpacity style={styles.markAllBtn} onPress={markAllRead} activeOpacity={0.75}>
            <Ionicons name="checkmark-done-outline" size={14} color="#fff" />
            <Text style={styles.markAllText}>Mark all read</Text>
          </TouchableOpacity>
        )}
      </View>

      {/* UNREAD BANNER */}
      {visibleUnread > 0 && (
        <View style={styles.unreadBanner}>
          <View style={styles.unreadDot} />
          <Text style={styles.unreadBannerText}>
            {visibleUnread} unread {visibleUnread === 1 ? 'notification' : 'notifications'}
          </Text>
          <Text style={styles.swipeHint}>← swipe right to hide</Text>
        </View>
      )}

      {/* LIST */}
      {isLoading && notifications.length === 0 ? (
        <LoadingSpinner fullScreen message="Loading notifications..." />
      ) : (
        <FlatList
          data={visible}
          keyExtractor={item => item.id}
          renderItem={({ item }) => (
            <SwipeableNotification
              item={item}
              onPress={() => markRead(item.id)}
              onHide={handleHide}
            />
          )}
          ItemSeparatorComponent={() => <View style={styles.separator} />}
          ListEmptyComponent={
            <EmptyState
              icon="notifications-outline"
              title="No notifications"
              subtitle="You'll be notified here when your reports are updated."
            />
          }
          contentContainerStyle={[
            styles.list,
            visible.length === 0 && styles.listEmpty,
          ]}
          refreshControl={
            <RefreshControl
              refreshing={isLoading}
              onRefresh={onRefresh}
              tintColor={PRIMARY}
              colors={[PRIMARY]}
            />
          }
          showsVerticalScrollIndicator={false}
        />
      )}

    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: PRIMARY },

  // Header — green
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    backgroundColor: PRIMARY,
    paddingHorizontal: 18,
    paddingTop: 10,
    paddingBottom: 16,
  },
  headerLeft:  {},
  headerTitle: { fontSize: 20, fontWeight: '800', color: '#fff', letterSpacing: -0.3 },
  headerSub:   { fontSize: 12, color: 'rgba(255,255,255,0.65)', marginTop: 3, fontWeight: '500' },

  markAllBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: 'rgba(255,255,255,0.15)',
    borderRadius: 4,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.25)',
    paddingHorizontal: 10,
    paddingVertical: 6,
    marginTop: 2,
  },
  markAllText: { fontSize: 12, fontWeight: '700', color: '#fff' },

  // Unread banner
  unreadBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#f0f4f2',
    paddingHorizontal: 16,
    paddingVertical: 9,
    borderBottomWidth: 1,
    borderBottomColor: '#e4ede8',
  },
  unreadDot:        { width: 7, height: 7, borderRadius: 4, backgroundColor: PRIMARY },
  unreadBannerText: { fontSize: 12, fontWeight: '600', color: PRIMARY, flex: 1 },
  swipeHint:        { fontSize: 11, color: MUTED, fontWeight: '500' },

  // Swipe action (revealed on swipe right)
  swipeAction: {
    backgroundColor: '#e53935',
    justifyContent: 'center',
    alignItems: 'center',
    width: 80,
    gap: 4,
  },
  swipeActionText: { fontSize: 11, fontWeight: '700', color: '#fff' },

  // Separator between items
  separator: {
    height: 8,
    backgroundColor: '#f0f4f2',
  },

  // List
  list:      { paddingTop: 8, paddingBottom: 32, backgroundColor: '#f0f4f2' },
  listEmpty: { flex: 1 },
});