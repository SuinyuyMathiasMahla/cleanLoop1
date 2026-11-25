import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useAuthStore } from '@/store/authStore';
import { useNotificationStore } from '@/store/notificationStore';
import { initialsOf } from '@/utils/format';
import { colors } from '@/theme/colors';

export type AppRole = 'citizen' | 'crew';

const SUBTITLE: Record<AppRole, string> = {
  citizen: 'Cleaner communities',
  crew: 'Crew workspace',
};

/** Forest-green top bar shared by every citizen and crew screen. */
export function AppHeader({ role }: { role: AppRole }) {
  const router = useRouter();
  const user = useAuthStore((s) => s.user);
  const unreadCount = useNotificationStore((s) => s.unreadCount);

  return (
    <View style={styles.header}>
      <View style={styles.left}>
        <View style={styles.logo}>
          <Ionicons name="leaf" size={19} color={colors.primary} />
        </View>
        <View>
          <Text style={styles.brand}>CleanLoop</Text>
          <Text style={styles.sub}>{SUBTITLE[role]}</Text>
        </View>
      </View>

      <View style={styles.right}>
        <TouchableOpacity
          style={styles.bell}
          onPress={() => router.navigate(`/(${role})/tabs/notifications` as any)}
          activeOpacity={0.8}
          accessibilityLabel={
            unreadCount > 0 ? `Notifications, ${unreadCount} unread` : 'Notifications'
          }
        >
          <Ionicons name="notifications-outline" size={20} color="#fff" />
          {unreadCount > 0 && <View style={styles.dot} />}
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.avatar}
          onPress={() => router.navigate(`/(${role})/tabs/profile` as any)}
          activeOpacity={0.8}
          accessibilityLabel="Open profile"
        >
          <Text style={styles.avatarText}>{initialsOf(user?.name, 'CL')}</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 18,
    paddingTop: 10,
    paddingBottom: 14,
  },
  left: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  logo: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
  },
  brand: { fontSize: 18, fontWeight: '800', color: '#fff', letterSpacing: -0.3 },
  sub: { fontSize: 10, color: colors.mint, marginTop: 1 },
  right: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  bell: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: 'rgba(255,255,255,0.12)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  dot: {
    position: 'absolute',
    top: 8,
    right: 9,
    width: 9,
    height: 9,
    borderRadius: 5,
    backgroundColor: colors.accent,
    borderWidth: 1.5,
    borderColor: colors.primary,
  },
  avatar: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: { fontSize: 13, fontWeight: '800', color: colors.primary },
});
