import React, { useCallback, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Modal,
  Alert,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from 'expo-router';
import { ScreenShell } from './ScreenShell';
import { AppRole } from './AppHeader';
import { profileApi, getApiErrorMessage } from '@/services/api';
import { useAuthStore } from '@/store/authStore';
import { initialsOf } from '@/utils/format';
import { colors } from '@/theme/colors';

export interface ProfileStat {
  label: string;
  value: string | number;
}

interface ProfileViewProps {
  role: AppRole;
  stats: ProfileStat[];
}

export function ProfileView({ role, stats }: ProfileViewProps) {
  const { user, logout, isLoading, updateUser } = useAuthStore();
  const [phone, setPhone] = useState('');
  const [editing, setEditing] = useState(false);
  const [nameDraft, setNameDraft] = useState('');
  const [phoneDraft, setPhoneDraft] = useState('');
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState('');

  const isCitizen = role === 'citizen';

  useFocusEffect(
    useCallback(() => {
      let active = true;
      profileApi
        .get()
        .then(({ data }) => {
          if (!active) return;
          setPhone(data.phone ?? '');
          if (data.name && data.name !== user?.name) updateUser({ name: data.name });
        })
        .catch(() => {
          // Profile details are optional — the token already carries name & email
        });
      return () => {
        active = false;
      };
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []),
  );

  if (!user) return null;

  function openEditor() {
    setNameDraft(user!.name);
    setPhoneDraft(phone);
    setFormError('');
    setEditing(true);
  }

  async function save() {
    const name = nameDraft.trim();
    const nextPhone = phoneDraft.trim();
    if (!name) return setFormError('Enter your name');
    if (nextPhone && !/^\+?[\d\s\-()]{8,20}$/.test(nextPhone)) {
      return setFormError('Enter a valid phone number, e.g. +237 6XX XXX XXX');
    }
    setSaving(true);
    setFormError('');
    try {
      await profileApi.update({
        name,
        ...(nextPhone ? { phone: nextPhone } : {}),
      });
      await updateUser({ name });
      setPhone(nextPhone);
      setEditing(false);
    } catch (err) {
      setFormError(getApiErrorMessage(err));
    } finally {
      setSaving(false);
    }
  }

  function confirmSignOut() {
    Alert.alert('Sign out', 'Are you sure you want to sign out?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Sign out', style: 'destructive', onPress: logout },
    ]);
  }

  return (
    <ScreenShell role={role} title="Profile" subtitle="Your account and activity">
      <ScrollView
        contentContainerStyle={styles.scroll}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {/* Identity card */}
        <View style={styles.identity}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>{initialsOf(user.name)}</Text>
          </View>
          <Text style={styles.name}>{user.name}</Text>
          <View style={styles.roleBadge}>
            <Ionicons
              name={isCitizen ? 'person-circle-outline' : 'construct-outline'}
              size={13}
              color={colors.primary}
            />
            <Text style={styles.roleText}>{isCitizen ? 'Citizen' : 'Crew member'}</Text>
          </View>
        </View>

        {/* Stats */}
        {stats.length > 0 && (
          <View style={styles.statsRow}>
            {stats.map((s, i) => (
              <View key={s.label} style={[styles.stat, i < stats.length - 1 && styles.statDivider]}>
                <Text style={styles.statValue}>{s.value}</Text>
                <Text style={styles.statLabel}>{s.label}</Text>
              </View>
            ))}
          </View>
        )}

        {/* Details */}
        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <Text style={styles.cardLabel}>ACCOUNT DETAILS</Text>
            {isCitizen && (
              <TouchableOpacity onPress={openEditor} style={styles.editBtn} activeOpacity={0.8}>
                <Ionicons name="create-outline" size={14} color={colors.primary} />
                <Text style={styles.editText}>Edit</Text>
              </TouchableOpacity>
            )}
          </View>
          <Row icon="mail-outline" label="Email" value={user.email} />
          {isCitizen && <Row icon="call-outline" label="Phone" value={phone || 'Not added yet'} muted={!phone} />}
          <Row
            icon="shield-checkmark-outline"
            label="Account type"
            value={isCitizen ? 'Citizen' : 'Crew member'}
          />
          {!isCitizen && <Row icon="finger-print-outline" label="User ID" value={user.userId} mono last />}
        </View>

        {!isCitizen && (
          <View style={styles.notice}>
            <Ionicons name="information-circle-outline" size={18} color={colors.info} />
            <Text style={styles.noticeText}>
              Your account was created by an admin. Contact your supervisor for account changes.
            </Text>
          </View>
        )}

        <TouchableOpacity
          style={[styles.signOut, isLoading && { opacity: 0.6 }]}
          onPress={confirmSignOut}
          disabled={isLoading}
          activeOpacity={0.85}
        >
          <Ionicons name="log-out-outline" size={19} color={colors.danger} />
          <Text style={styles.signOutText}>Sign out</Text>
        </TouchableOpacity>

        <Text style={styles.version}>CleanLoop · Cleaner communities</Text>
      </ScrollView>

      {/* Edit modal */}
      <Modal visible={editing} transparent animationType="slide" onRequestClose={() => setEditing(false)}>
        <KeyboardAvoidingView
          style={styles.modalShade}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
          <View style={styles.modal}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Edit profile</Text>
              <TouchableOpacity onPress={() => setEditing(false)} accessibilityLabel="Close">
                <Ionicons name="close" size={24} color={colors.gray[700]} />
              </TouchableOpacity>
            </View>

            <Text style={styles.fieldLabel}>Full name</Text>
            <TextInput
              style={styles.input}
              value={nameDraft}
              onChangeText={setNameDraft}
              autoCapitalize="words"
              placeholder="Jane Smith"
              placeholderTextColor={colors.gray[500]}
            />

            <Text style={styles.fieldLabel}>Phone number</Text>
            <TextInput
              style={styles.input}
              value={phoneDraft}
              onChangeText={setPhoneDraft}
              keyboardType="phone-pad"
              placeholder="+237 6XX XXX XXX"
              placeholderTextColor={colors.gray[500]}
            />

            {!!formError && <Text style={styles.formError}>{formError}</Text>}

            <TouchableOpacity
              style={[styles.saveBtn, saving && { opacity: 0.7 }]}
              onPress={save}
              disabled={saving}
              activeOpacity={0.85}
            >
              {saving ? <ActivityIndicator color="#fff" /> : <Text style={styles.saveText}>Save changes</Text>}
            </TouchableOpacity>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </ScreenShell>
  );
}

function Row({
  icon,
  label,
  value,
  mono,
  muted,
  last,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  value: string;
  mono?: boolean;
  muted?: boolean;
  last?: boolean;
}) {
  return (
    <View style={[styles.row, !last && styles.rowBorder]}>
      <View style={styles.rowIcon}>
        <Ionicons name={icon} size={18} color={colors.primary} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={styles.rowLabel}>{label}</Text>
        <Text
          style={[styles.rowValue, mono && styles.mono, muted && { color: colors.gray[300] }]}
          numberOfLines={1}
          ellipsizeMode="middle"
        >
          {value}
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  scroll: { padding: 20, paddingBottom: 36, gap: 16 },
  identity: { alignItems: 'center', paddingTop: 4, gap: 8 },
  avatar: {
    width: 84,
    height: 84,
    borderRadius: 42,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 4,
    borderColor: colors.mint,
  },
  avatarText: { fontSize: 28, fontWeight: '800', color: '#fff' },
  name: { fontSize: 21, fontWeight: '800', color: colors.gray[900], letterSpacing: -0.3 },
  roleBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: colors.primaryLight,
    borderRadius: 6,
    paddingHorizontal: 12,
    paddingVertical: 5,
  },
  roleText: { fontSize: 12.5, fontWeight: '700', color: colors.primary },

  statsRow: {
    flexDirection: 'row',
    backgroundColor: '#fff',
    borderRadius: 1,
    borderWidth: 1,
    borderColor: colors.border,
    paddingVertical: 16,
  },
  stat: { flex: 1, alignItems: 'center' },
  statDivider: { borderRightWidth: 1, borderRightColor: colors.border },
  statValue: { fontSize: 22, fontWeight: '800', color: colors.gray[900] },
  statLabel: { fontSize: 10, fontWeight: '700', color: colors.gray[500], letterSpacing: 0.6, marginTop: 3 },

  card: {
    backgroundColor: '#fff',
    borderRadius: 1,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  cardHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 },
  cardLabel: { fontSize: 11, fontWeight: '800', color: colors.gray[500], letterSpacing: 0.9 },
  editBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: colors.primaryLight,
    borderRadius: 6,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  editText: { fontSize: 12, fontWeight: '700', color: colors.primary },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 12 },
  rowBorder: { borderBottomWidth: 1, borderBottomColor: colors.gray[100] },
  rowIcon: {
    width: 38,
    height: 38,
    borderRadius: 6,
    backgroundColor: colors.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rowLabel: { fontSize: 10.5, fontWeight: '700', color: colors.gray[500], letterSpacing: 0.5, textTransform: 'uppercase' },
  rowValue: { fontSize: 14.5, fontWeight: '600', color: colors.gray[900], marginTop: 2 },
  mono: { fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace', fontSize: 12 },

  notice: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    backgroundColor: '#eff6ff',
    borderRadius: 1,
    padding: 14,
  },
  noticeText: { flex: 1, fontSize: 13, lineHeight: 18, color: colors.info },

  signOut: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    height: 52,
    borderRadius: 6,
    borderWidth: 1.5,
    borderColor: '#fecaca',
    backgroundColor: '#fef2f2',
  },
  signOutText: { fontSize: 15, fontWeight: '700', color: colors.danger },
  version: { textAlign: 'center', fontSize: 11.5, color: colors.gray[300], marginTop: 4 },

  modalShade: { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'flex-end' },
  modal: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 6,
    borderTopRightRadius: 6,
    padding: 22,
    paddingBottom: 32,
  },
  modalHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 18 },
  modalTitle: { fontSize: 19, fontWeight: '800', color: colors.gray[900] },
  fieldLabel: { fontSize: 13.5, fontWeight: '600', color: colors.gray[700], marginBottom: 7 },
  input: {
    height: 52,
    borderRadius: 6,
    borderWidth: 1.5,
    borderColor: colors.gray[200],
    backgroundColor: '#f8faf9',
    paddingHorizontal: 14,
    fontSize: 16,
    color: colors.gray[900],
    marginBottom: 16,
  },
  formError: { fontSize: 13, color: colors.danger, marginBottom: 12 },
  saveBtn: {
    height: 52,
    borderRadius: 6,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  saveText: { fontSize: 15.5, fontWeight: '700', color: '#fff' },
});
