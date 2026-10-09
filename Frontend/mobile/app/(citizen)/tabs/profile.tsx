import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { Button } from '@/components/common/Button';
import { useAuthStore } from '@/store/authStore';
import { colors } from '@/theme/colors';

const PRIMARY   = '#1a7a5e';
const PRIMARY_L = '#edf7f3';
const BG        = '#f0f4f2';

function getInitials(name: string): string {
  return name.split(' ').map((n) => n[0]).join('').toUpperCase().slice(0, 2);
}

export default function CitizenProfile() {
  const { user, logout, isLoading } = useAuthStore();

  function handleSignOut() {
    Alert.alert('Sign Out', 'Are you sure you want to sign out?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Sign Out', style: 'destructive', onPress: logout },
    ]);
  }

  if (!user) return null;

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      {/* ── green hero header ── */}
      <View style={styles.hero}>
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>{getInitials(user.name)}</Text>
        </View>
        <Text style={styles.name}>{user.name}</Text>
        <View style={styles.badge}>
          <Ionicons name="person-circle-outline" size={13} color={PRIMARY} />
          <Text style={styles.badgeText}>Citizen</Text>
        </View>
      </View>

      {/* ── body ── */}
      <View style={styles.body}>
        {/* info card */}
        <View style={styles.card}>
          <Text style={styles.cardLabel}>Account Details</Text>

          <View style={styles.infoRow}>
            <View style={styles.iconBox}>
              <Ionicons name="mail-outline" size={18} color={PRIMARY} />
            </View>
            <View style={styles.infoContent}>
              <Text style={styles.infoLabel}>Email</Text>
              <Text style={styles.infoValue}>{user.email}</Text>
            </View>
          </View>

          <View style={styles.divider} />

          <View style={styles.infoRow}>
            <View style={styles.iconBox}>
              <Ionicons name="shield-checkmark-outline" size={18} color={PRIMARY} />
            </View>
            <View style={styles.infoContent}>
              <Text style={styles.infoLabel}>Account Type</Text>
              <Text style={styles.infoValue}>Citizen</Text>
            </View>
          </View>
        </View>

        {/* sign out */}
        <Button
          title="Sign Out"
          onPress={handleSignOut}
          variant="danger"
          loading={isLoading}
        />
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: PRIMARY },

  hero: {
    backgroundColor: PRIMARY,
    alignItems: 'center',
    paddingTop: 12,
    paddingBottom: 32,
    gap: 8,
  },
  avatar: {
    width: 88,
    height: 88,
    borderRadius: 44,
    backgroundColor: 'rgba(255,255,255,0.2)',
    borderWidth: 3,
    borderColor: 'rgba(255,255,255,0.5)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
  },
  avatarText: { fontSize: 30, fontWeight: '800', color: '#fff' },
  name:       { fontSize: 22, fontWeight: '800', color: '#fff' },
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: '#fff',
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 5,
  },
  badgeText: { fontSize: 13, fontWeight: '700', color: PRIMARY },

  body: {
    flex: 1,
    backgroundColor: BG,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    marginTop: -16,
    padding: 20,
    gap: 16,
  },

  card: {
    backgroundColor: '#fff',
    borderRadius: 14,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 2,
  },
  cardLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: '#888',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    marginBottom: 12,
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    gap: 12,
  },
  iconBox: {
    width: 38,
    height: 38,
    borderRadius: 10,
    backgroundColor: PRIMARY_L,
    alignItems: 'center',
    justifyContent: 'center',
  },
  infoContent: { flex: 1 },
  infoLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: '#888',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 2,
  },
  infoValue: { fontSize: 14, fontWeight: '600', color: '#111' },
  divider: { height: 1, backgroundColor: '#f0f0f0', marginHorizontal: 2 },
});