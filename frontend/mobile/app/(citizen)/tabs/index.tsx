import React, { useCallback, useMemo } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
  ActivityIndicator,
  StyleSheet,
  StatusBar,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useFocusEffect } from 'expo-router';
import { AppHeader } from '@/components/common/AppHeader';
import { Rings } from '@/components/common/Rings';
import { ReportCard } from '@/components/citizen/ReportCard';
import { useAuthStore } from '@/store/authStore';
import { useReportStore } from '@/store/reportStore';
import { firstName, greeting } from '@/utils/format';
import { colors } from '@/theme/colors';

export default function CitizenHome() {
  const router = useRouter();
  const user = useAuthStore((s) => s.user);
  const { publicReports, myReports, isLoading, fetchPublicReports, fetchMyReports } =
    useReportStore();

  const load = useCallback(() => {
    fetchPublicReports();
    fetchMyReports();
  }, [fetchPublicReports, fetchMyReports]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  const completed = useMemo(
    () => publicReports.filter((r) => r.status === 'resolved'),
    [publicReports],
  );

  const open = myReports.filter((r) => r.status !== 'resolved').length;
  const resolved = myReports.filter((r) => r.status === 'resolved').length;

  return (
    <View style={styles.root}>
      <StatusBar barStyle="light-content" backgroundColor={colors.primary} />
      <SafeAreaView edges={['top']} style={styles.safe}>
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.scroll}
          stickyHeaderIndices={[0]}
          refreshControl={
            <RefreshControl
              refreshing={isLoading}
              onRefresh={load}
              tintColor={colors.primary}
              colors={[colors.primary]}
            />
          }
        >
          {/* HERO */}
          <View style={styles.hero}>
            <Rings />
            <AppHeader role="citizen" />
          </View>

          <View style={styles.heroCopy}>
            <Text style={styles.hello}>
              {greeting()}, {firstName(user?.name)}
            </Text>
            <Text style={styles.heroTitle}>
              Report waste.{'\n'}Keep your city{'\n'}clean.
            </Text>
            <Text style={styles.heroSub}>
              Help make your neighbourhood cleaner by reporting overflowing bins and illegal
              dumping.
            </Text>
          </View>

          {/* SHEET */}
          <View style={styles.sheet}>
            {/* Quick report */}
            <View style={styles.actionCard}>
              <View style={styles.actionHeader}>
                <View style={{ flex: 1 }}>
                  <View style={styles.liveRow}>
                    <View style={styles.liveDot} />
                    <Text style={styles.liveText}>QUICK REPORT</Text>
                  </View>
                  <Text style={styles.actionTitle}>Report Waste Now</Text>
                </View>
                <View style={styles.cameraChip}>
                  <Ionicons name="camera-outline" size={16} color={colors.primary} />
                  <Text style={styles.cameraChipText}>Camera</Text>
                </View>
              </View>
              <Text style={styles.actionDescription}>
                Snap a photo, tag your location, and our cleanup crews will handle the rest.
              </Text>
              <TouchableOpacity
                style={styles.reportButton}
                onPress={() => router.navigate('/(citizen)/tabs/report' as any)}
                activeOpacity={0.85}
              >
                <Ionicons name="camera" size={18} color="#fff" />
                <Text style={styles.reportButtonText}>Report Waste Now</Text>
                <Ionicons name="arrow-forward" size={18} color="#fff" />
              </TouchableOpacity>
            </View>

            {/* My activity */}
            <View style={styles.statsRow}>
              <StatTile
                label="My reports"
                value={myReports.length}
                icon="document-text-outline"
                onPress={() => router.navigate('/(citizen)/tabs/my-reports' as any)}
              />
              <StatTile
                label="In progress"
                value={open}
                icon="reload-outline"
                onPress={() => router.navigate('/(citizen)/tabs/my-reports' as any)}
              />
              <StatTile
                label="Resolved"
                value={resolved}
                icon="checkmark-circle-outline"
                onPress={() => router.navigate('/(citizen)/tabs/my-reports' as any)}
              />
            </View>

            {/* Community feed */}
            <View style={styles.sectionHeader}>
              <View style={{ flex: 1 }}>
                <Text style={styles.sectionTitle}>Community Feed</Text>
                <Text style={styles.sectionSub}>Completed cleanups from your area</Text>
              </View>
              <View style={styles.sectionIcon}>
                <Ionicons name="people-outline" size={19} color={colors.primary} />
              </View>
            </View>

            {isLoading && completed.length === 0 ? (
              <ActivityIndicator color={colors.primary} style={{ marginVertical: 30 }} />
            ) : completed.length === 0 ? (
              <View style={styles.emptyFeed}>
                <View style={styles.emptyIcon}>
                  <Ionicons name="leaf-outline" size={28} color={colors.primary} />
                </View>
                <Text style={styles.emptyTitle}>No completed cleanups yet</Text>
                <Text style={styles.emptyText}>Community cleanup activity will appear here.</Text>
              </View>
            ) : (
              <>
                {completed.slice(0, 5).map((report) => (
                  <ReportCard
                    key={report.reportId ?? report.id}
                    report={report as any}
                    style={styles.feedCard}
                  />
                ))}
                {completed.length > 5 && (
                  <TouchableOpacity
                    style={styles.seeAll}
                    onPress={() => router.navigate('/(citizen)/tabs/my-reports' as any)}
                    activeOpacity={0.8}
                  >
                    <Text style={styles.seeAllText}>See all reports</Text>
                    <Ionicons name="arrow-forward" size={15} color={colors.primary} />
                  </TouchableOpacity>
                )}
              </>
            )}
          </View>
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}

function StatTile({
  label,
  value,
  icon,
  onPress,
}: {
  label: string;
  value: number;
  icon: keyof typeof Ionicons.glyphMap;
  onPress: () => void;
}) {
  return (
    <TouchableOpacity style={styles.stat} onPress={onPress} activeOpacity={0.8}>
      <View style={styles.statIcon}>
        <Ionicons name={icon} size={17} color={colors.primary} />
      </View>
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.primary },
  safe: { flex: 1, backgroundColor: colors.primary },
  scroll: { flexGrow: 1, backgroundColor: colors.background, paddingBottom: 24 },

  hero: { backgroundColor: colors.primary, overflow: 'hidden' },
  heroCopy: {
    backgroundColor: colors.primary,
    paddingHorizontal: 22,
    paddingTop: 8,
    paddingBottom: 30,
  },
  hello: { fontSize: 14, fontWeight: '600', color: colors.mint, marginBottom: 6 },
  heroTitle: {
    fontSize: 34,
    lineHeight: 40,
    fontWeight: '800',
    color: '#fff',
    letterSpacing: -0.8,
    marginBottom: 10,
  },
  heroSub: { maxWidth: 330, fontSize: 14, lineHeight: 21, color: colors.mint },

  sheet: {
    backgroundColor: colors.background,
    paddingHorizontal: 18,
    paddingTop: 18,
    minHeight: 420,
  },

  actionCard: {
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 1,
    padding: 16,
    marginBottom: 14,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.07,
    shadowRadius: 12,
    elevation: 3,
  },
  actionHeader: { flexDirection: 'row', alignItems: 'flex-start', marginBottom: 9 },
  liveRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 5 },
  liveDot: { width: 7, height: 7, borderRadius: 4, backgroundColor: colors.accent },
  liveText: { fontSize: 10, fontWeight: '800', color: '#22a05a', letterSpacing: 0.9 },
  actionTitle: { fontSize: 20, fontWeight: '800', color: colors.gray[900], letterSpacing: -0.3 },
  cameraChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: colors.primaryLight,
    borderRadius: 6,
    paddingHorizontal: 10,
    paddingVertical: 7,
  },
  cameraChipText: { fontSize: 10.5, fontWeight: '700', color: colors.primary },
  actionDescription: { fontSize: 13.5, lineHeight: 20, color: colors.gray[500], marginBottom: 16 },
  reportButton: {
    height: 52,
    borderRadius: 6,
    backgroundColor: colors.primary,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 9,
  },
  reportButtonText: { fontSize: 15, fontWeight: '700', color: '#fff', letterSpacing: 0.1 },

  statsRow: { flexDirection: 'row', gap: 10, marginBottom: 26 },
  stat: {
    flex: 1,
    backgroundColor: '#fff',
    borderRadius: 1,
    borderWidth: 1,
    borderColor: colors.border,
    paddingVertical: 12,
    alignItems: 'center',
  },
  statIcon: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: colors.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 6,
  },
  statValue: { fontSize: 20, fontWeight: '800', color: colors.gray[900] },
  statLabel: { fontSize: 11, fontWeight: '600', color: colors.gray[500], marginTop: 1 },

  sectionHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 14 },
  sectionTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: colors.gray[900],
    letterSpacing: -0.3,
    marginBottom: 3,
  },
  sectionSub: { fontSize: 12.5, color: colors.gray[500] },
  sectionIcon: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: colors.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  feedCard: { marginHorizontal: 0 },
  seeAll: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    height: 48,
    borderRadius: 6,
    backgroundColor: colors.primaryLight,
    marginTop: 2,
  },
  seeAllText: { fontSize: 14, fontWeight: '700', color: colors.primary },

  emptyFeed: {
    alignItems: 'center',
    paddingVertical: 34,
    paddingHorizontal: 20,
    borderRadius: 1,
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: colors.border,
  },
  emptyIcon: {
    width: 58,
    height: 58,
    borderRadius: 29,
    backgroundColor: colors.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  emptyTitle: { fontSize: 15, fontWeight: '700', color: colors.gray[900], marginBottom: 5 },
  emptyText: { fontSize: 12.5, color: colors.gray[500], textAlign: 'center', lineHeight: 18 },
});
