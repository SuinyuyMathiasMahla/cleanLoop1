import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  RefreshControl,
  Platform,
  StatusBar,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useFocusEffect } from 'expo-router';
import { AppHeader } from '@/components/common/AppHeader';
import { Rings } from '@/components/common/Rings';
import { LoadingSpinner } from '@/components/common/LoadingSpinner';
import { ReportCard } from '@/components/citizen/ReportCard';
import { tasksApi, Task, getApiErrorMessage } from '@/services/api';
import { useAuthStore } from '@/store/authStore';
import { useReportStore } from '@/store/reportStore';
import { firstName, greeting } from '@/utils/format';
import {
  isMine,
  isOpen,
  isOverdue,
  onTimeRate,
  sortBySchedule,
  taskIdOf,
} from '@/utils/tasks';
import { colors } from '@/theme/colors';

// react-native-maps crashes on web — load only on native
let MapView: any = null;
let Marker: any = null;
let UrlTile: any = null;
if (Platform.OS !== 'web') {
  // react-native-maps has no web build, so it is only loaded on native platforms.
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const maps = require('react-native-maps');
  MapView = maps.default;
  Marker = maps.Marker;
  UrlTile = maps.UrlTile;
}

const REPORT_TABS = [
  { key: 'pending', label: 'Pending' },
  { key: 'assigned', label: 'Assigned' },
  { key: 'in_progress', label: 'In progress' },
  { key: 'resolved', label: 'Completed' },
] as const;
type ReportTab = (typeof REPORT_TABS)[number]['key'];

const MARKER_COLOR: Record<string, string> = {
  pending: '#ef4444',
  assigned: '#3b82f6',
  in_progress: '#f97316',
  resolved: '#22c55e',
};

export default function CrewHome() {
  const user = useAuthStore((s) => s.user);
  const { allReports, fetchAllReports } = useReportStore();
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState('');
  const [reportTab, setReportTab] = useState<ReportTab>('pending');
  const mapRef = useRef<any>(null);

  const userId = user?.userId ?? '';

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const { data } = await tasksApi.getAll();
      setTasks(data.tasks ?? []);
      await fetchAllReports();
    } catch (err) {
      setError(getApiErrorMessage(err));
    } finally {
      setLoading(false);
      setLoaded(true);
    }
  }, [fetchAllReports]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  const myTasks = useMemo(() => tasks.filter((t) => isMine(t, userId)), [tasks, userId]);
  const openTasks = useMemo(() => sortBySchedule(myTasks.filter(isOpen)), [myTasks]);
  const nextTask = openTasks[0] ?? null;

  const now = new Date();
  const todayCount = myTasks.filter(
    (t) => new Date(t.scheduledAt).toDateString() === now.toDateString(),
  ).length;
  const weekStart = new Date(now.getFullYear(), now.getMonth(), now.getDate() - now.getDay());
  const weekCount = myTasks.filter((t) => new Date(t.scheduledAt) >= weekStart).length;
  const rate = onTimeRate(myTasks);

  // Map: locations of reports belonging to my open tasks
  const assignedReportIds = useMemo(
    () => new Set(openTasks.flatMap((t) => t.reportIds ?? [])),
    [openTasks],
  );
  const mapReports = useMemo(
    () =>
      (allReports ?? []).filter(
        (r: any) =>
          assignedReportIds.has(r.reportId ?? r.id) &&
          r.status !== 'resolved' &&
          Number.isFinite(Number(r.lat)) &&
          Number.isFinite(Number(r.lng)) &&
          r.lat !== null &&
          r.lng !== null,
      ),
    [allReports, assignedReportIds],
  );
  const mapKey = mapReports.map((r: any) => `${r.reportId ?? r.id}:${r.lat},${r.lng}`).join('|');

  useEffect(() => {
    if (!mapRef.current || mapReports.length === 0) return;
    if (mapReports.length > 1) {
      mapRef.current.fitToCoordinates(
        mapReports.map((r: any) => ({ latitude: Number(r.lat), longitude: Number(r.lng) })),
        { edgePadding: { top: 48, right: 48, bottom: 48, left: 48 }, animated: true },
      );
    } else {
      mapRef.current.animateToRegion(
        {
          latitude: Number(mapReports[0].lat),
          longitude: Number(mapReports[0].lng),
          latitudeDelta: 0.015,
          longitudeDelta: 0.015,
        },
        350,
      );
    }
  }, [mapKey]);

  const reportCounts = REPORT_TABS.reduce((acc, tab) => {
    acc[tab.key] = (allReports ?? []).filter((r: any) => r.status === tab.key).length;
    return acc;
  }, {} as Record<ReportTab, number>);
  const filteredReports = (allReports ?? []).filter((r: any) => r.status === reportTab);

  if (!loaded && loading) return <LoadingSpinner fullScreen message="Loading dashboard..." />;

  const first = mapReports[0];

  return (
    <View style={styles.root}>
      <StatusBar barStyle="light-content" backgroundColor={colors.primary} />
      <SafeAreaView edges={['top']} style={styles.safe}>
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.scroll}
          refreshControl={
            <RefreshControl
              refreshing={loading}
              onRefresh={load}
              tintColor={colors.primary}
              colors={[colors.primary]}
            />
          }
        >
          {/* HERO */}
          <View style={styles.hero}>
            <Rings />
            <AppHeader role="crew" />
            <View style={styles.heroBody}>
              <View style={styles.badgeRow}>
                <View style={styles.heroBadge}>
                  <Ionicons name="construct-outline" size={13} color={colors.mint} />
                  <Text style={styles.heroBadgeText}>Crew</Text>
                </View>
                {!!(user as any)?.zone && (
                  <View style={styles.heroBadge}>
                    <Ionicons name="location-outline" size={13} color={colors.mint} />
                    <Text style={styles.heroBadgeText}>{(user as any).zone}</Text>
                  </View>
                )}
              </View>
              <Text style={styles.hello}>{greeting()}, {firstName(user?.name, 'Crew')} 👋</Text>
              <Text style={styles.heroTitle}>
                {openTasks.length > 0
                  ? `${openTasks.length} ${openTasks.length === 1 ? 'task' : 'tasks'}\nwaiting for you.`
                  : "You're all\ncaught up."}
              </Text>
              <Text style={styles.heroSub}>
                {openTasks.length > 0
                  ? 'Open a task, clean the site and upload photo evidence to complete it.'
                  : 'New assignments will show up here and in your alerts.'}
              </Text>
            </View>
          </View>

          {/* SHEET */}
          <View style={styles.sheet}>
            {!!error && (
              <TouchableOpacity style={styles.errorBanner} onPress={load} activeOpacity={0.8}>
                <Ionicons name="cloud-offline-outline" size={18} color={colors.danger} />
                <Text style={styles.errorText} numberOfLines={2}>{error}</Text>
                <Text style={styles.errorRetry}>Retry</Text>
              </TouchableOpacity>
            )}

            {/* Stats */}
            <View style={styles.statsCard}>
              <Stat value={todayCount} label="TODAY" />
              <View style={styles.statDivider} />
              <Stat value={weekCount} label="THIS WEEK" />
              <View style={styles.statDivider} />
              <Stat value={rate === null ? '—' : `${rate}%`} label="ON TIME" />
            </View>

            {/* Up next */}
            {nextTask ? (
              <TouchableOpacity
                style={styles.nextCard}
                activeOpacity={0.88}
                onPress={() => router.push(`/(crew)/task/${taskIdOf(nextTask)}` as any)}
              >
                <View style={styles.nextTop}>
                  <View style={styles.liveRow}>
                    <View style={styles.liveDot} />
                    <Text style={styles.liveText}>
                      {nextTask.status === 'in_progress' ? 'IN PROGRESS' : 'UP NEXT'}
                    </Text>
                  </View>
                  {isOverdue(nextTask) && (
                    <View style={styles.overduePill}>
                      <Text style={styles.overdueText}>Overdue</Text>
                    </View>
                  )}
                </View>
                <Text style={styles.nextTitle} numberOfLines={2}>{nextTask.title}</Text>
                <View style={styles.nextMeta}>
                  <Ionicons name="calendar-outline" size={14} color={colors.gray[500]} />
                  <Text style={styles.nextMetaText}>
                    {new Date(nextTask.scheduledAt).toLocaleString(undefined, {
                      weekday: 'short',
                      month: 'short',
                      day: 'numeric',
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </Text>
                </View>
                {!!nextTask.addresses?.[0] && (
                  <View style={styles.nextMeta}>
                    <Ionicons name="location-outline" size={14} color={colors.gray[500]} />
                    <Text style={styles.nextMetaText} numberOfLines={1}>{nextTask.addresses[0]}</Text>
                  </View>
                )}
                <View style={styles.nextButton}>
                  <Text style={styles.nextButtonText}>
                    {nextTask.status === 'in_progress' ? 'Continue task' : 'Open task'}
                  </Text>
                  <Ionicons name="arrow-forward" size={17} color="#fff" />
                </View>
              </TouchableOpacity>
            ) : (
              <View style={styles.allClear}>
                <View style={styles.allClearIcon}>
                  <Ionicons name="checkmark-done" size={24} color={colors.primary} />
                </View>
                <Text style={styles.allClearTitle}>No open tasks</Text>
                <Text style={styles.allClearText}>Enjoy the break — we'll alert you when work is assigned.</Text>
              </View>
            )}

            {openTasks.length > 1 && (
              <TouchableOpacity
                style={styles.linkRow}
                onPress={() => router.navigate('/(crew)/tabs/tasks' as any)}
                activeOpacity={0.8}
              >
                <Text style={styles.linkText}>+{openTasks.length - 1} more open {openTasks.length - 1 === 1 ? 'task' : 'tasks'}</Text>
                <Ionicons name="arrow-forward" size={15} color={colors.primary} />
              </TouchableOpacity>
            )}

            {/* Map */}
            <Text style={styles.sectionTitle}>Work areas</Text>
            <Text style={styles.sectionSub}>Locations of reports in your open tasks</Text>
            <View style={styles.mapCard}>
              {MapView ? (
                <View>
                  <MapView
                    ref={mapRef}
                    style={styles.map}
                    mapType="none"
                    initialRegion={{
                      latitude: first ? Number(first.lat) : 4.155,
                      longitude: first ? Number(first.lng) : 9.241,
                      latitudeDelta: mapReports.length > 1 ? 0.06 : 0.015,
                      longitudeDelta: mapReports.length > 1 ? 0.06 : 0.015,
                    }}
                    rotateEnabled={false}
                    pitchEnabled={false}
                  >
                    {UrlTile ? (
                      <UrlTile
                        urlTemplate="https://tile.openstreetmap.org/{z}/{x}/{y}.png"
                        maximumZ={19}
                        tileSize={256}
                      />
                    ) : null}
                    {mapReports.map((r: any) => (
                      <Marker
                        key={r.reportId ?? r.id}
                        coordinate={{ latitude: Number(r.lat), longitude: Number(r.lng) }}
                        title={r.address ?? 'Assigned report'}
                        description={r.description ?? ''}
                        pinColor={MARKER_COLOR[r.status] ?? '#6b7280'}
                      />
                    ))}
                  </MapView>
                  <View style={styles.osmBadge}>
                    <Text style={styles.osmText}>© OpenStreetMap</Text>
                  </View>
                </View>
              ) : (
                <View style={styles.mapEmpty}>
                  <Ionicons name="map-outline" size={30} color={colors.gray[300]} />
                  <Text style={styles.mapEmptyText}>Map is available in the mobile app</Text>
                </View>
              )}
              <View style={styles.mapFooter}>
                <Ionicons name="navigate-circle-outline" size={16} color={colors.primary} />
                <Text style={styles.mapFooterText}>
                  {mapReports.length > 0
                    ? `${mapReports.length} assigned location${mapReports.length === 1 ? '' : 's'}`
                    : 'Newly assigned report locations will appear here'}
                </Text>
              </View>
            </View>

            {/* Reports */}
            <View style={styles.reportsHeader}>
              <Text style={styles.sectionTitle}>Community reports</Text>
              <Text style={styles.count}>{(allReports ?? []).length} total</Text>
            </View>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.chipRow}
              style={{ marginBottom: 12 }}
            >
              {REPORT_TABS.map((tab) => {
                const active = reportTab === tab.key;
                return (
                  <TouchableOpacity
                    key={tab.key}
                    style={[styles.chip, active && styles.chipActive]}
                    onPress={() => setReportTab(tab.key)}
                    activeOpacity={0.8}
                  >
                    <Text style={[styles.chipText, active && styles.chipTextActive]}>{tab.label}</Text>
                    {reportCounts[tab.key] > 0 && (
                      <View style={[styles.chipBadge, active && styles.chipBadgeActive]}>
                        <Text style={[styles.chipBadgeText, active && { color: '#fff' }]}>
                          {reportCounts[tab.key]}
                        </Text>
                      </View>
                    )}
                  </TouchableOpacity>
                );
              })}
            </ScrollView>

            {filteredReports.length === 0 ? (
              <View style={styles.emptyCard}>
                <Ionicons name="checkmark-circle-outline" size={38} color={colors.gray[300]} />
                <Text style={styles.emptyTitle}>
                  No {REPORT_TABS.find((t) => t.key === reportTab)?.label.toLowerCase()} reports
                </Text>
                <Text style={styles.emptyText}>Reports with this status will appear here</Text>
              </View>
            ) : (
              filteredReports.slice(0, 20).map((report: any) => (
                <ReportCard
                  key={report.reportId ?? report.id}
                  report={report}
                  style={{ marginHorizontal: 0 }}
                />
              ))
            )}
          </View>
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}

function Stat({ value, label }: { value: number | string; label: string }) {
  return (
    <View style={styles.stat}>
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}


const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.primary },
  safe: { flex: 1, backgroundColor: colors.primary },
  scroll: { flexGrow: 1, backgroundColor: colors.background, paddingBottom: 24 },

  hero: { backgroundColor: colors.primary, paddingBottom: 56, overflow: 'hidden' },
  heroBody: { paddingHorizontal: 22, zIndex: 2 },
  badgeRow: { flexDirection: 'row', gap: 8, marginTop: 6, marginBottom: 18 },
  heroBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: 'rgba(255,255,255,0.10)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.14)',
    borderRadius: 20,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  heroBadgeText: { fontSize: 10.5, fontWeight: '600', color: colors.mint },
  hello: { fontSize: 14, fontWeight: '600', color: colors.mint, marginBottom: 6 },
  heroTitle: { fontSize: 34, lineHeight: 40, fontWeight: '800', color: '#fff', letterSpacing: -0.8, marginBottom: 10 },
  heroSub: { maxWidth: 330, fontSize: 14, lineHeight: 21, color: colors.mint },

  sheet: {
    backgroundColor: colors.background,
    marginTop: -12,
    borderTopLeftRadius: 1,
    borderTopRightRadius: 1,
    paddingHorizontal: 18,
    paddingTop: 22,
    minHeight: 420,
  },

  errorBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: '#fef2f2',
    borderWidth: 1,
    borderColor: '#fecaca',
    borderRadius: 1,
    padding: 12,
    marginBottom: 14,
  },
  errorText: { flex: 1, fontSize: 13, color: colors.danger },
  errorRetry: { fontSize: 13, fontWeight: '800', color: colors.danger },

  statsCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderRadius: 1,
    borderWidth: 1,
    borderColor: colors.border,
    paddingVertical: 16,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.06,
    shadowRadius: 12,
    elevation: 3,
  },
  stat: { flex: 1, alignItems: 'center' },
  statDivider: { width: 1, height: 32, backgroundColor: colors.border },
  statValue: { fontSize: 26, fontWeight: '800', color: colors.gray[900] },
  statLabel: { fontSize: 10, fontWeight: '800', color: colors.gray[500], letterSpacing: 0.8, marginTop: 2 },

  nextCard: {
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 1,
    padding: 18,
    marginBottom: 12,
  },
  nextTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 },
  liveRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  liveDot: { width: 7, height: 7, borderRadius: 4, backgroundColor: colors.accent },
  liveText: { fontSize: 10, fontWeight: '800', color: '#22a05a', letterSpacing: 0.9 },
  overduePill: { backgroundColor: '#fee2e2', borderRadius: 6, paddingHorizontal: 9, paddingVertical: 3 },
  overdueText: { fontSize: 10.5, fontWeight: '800', color: '#b91c1c' },
  nextTitle: { fontSize: 19, fontWeight: '800', color: colors.gray[900], letterSpacing: -0.3, marginBottom: 10 },
  nextMeta: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 5 },
  nextMetaText: { flex: 1, fontSize: 13, color: colors.gray[500] },
  nextButton: {
    height: 50,
    borderRadius: 6,
    backgroundColor: colors.primary,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 9,
    marginTop: 12,
  },
  nextButtonText: { fontSize: 15, fontWeight: '700', color: '#fff' },

  allClear: {
    alignItems: 'center',
    backgroundColor: '#fff',
    borderRadius: 1,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 24,
    marginBottom: 12,
  },
  allClearIcon: {
    width: 54,
    height: 54,
    borderRadius: 27,
    backgroundColor: colors.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 10,
  },
  allClearTitle: { fontSize: 16, fontWeight: '800', color: colors.gray[900], marginBottom: 4 },
  allClearText: { fontSize: 13, color: colors.gray[500], textAlign: 'center' },

  linkRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    height: 44,
    borderRadius: 6,
    backgroundColor: colors.primaryLight,
    marginBottom: 6,
  },
  linkText: { fontSize: 13.5, fontWeight: '700', color: colors.primary },

  sectionTitle: { fontSize: 20, fontWeight: '800', color: colors.gray[900], letterSpacing: -0.3, marginTop: 20 },
  sectionSub: { fontSize: 12.5, color: colors.gray[500], marginTop: 3, marginBottom: 12 },
  mapCard: {
    backgroundColor: '#fff',
    borderRadius: 1,
    borderWidth: 1,
    borderColor: colors.border,
    overflow: 'hidden',
  },
  map: { height: 190, width: '100%' },
  osmBadge: {
    position: 'absolute',
    top: 10,
    right: 10,
    backgroundColor: 'rgba(0,0,0,0.55)',
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  osmText: { fontSize: 9.5, fontWeight: '700', color: '#fff' },
  mapEmpty: { height: 150, alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: '#f1f5f3' },
  mapEmptyText: { fontSize: 13, color: colors.gray[500] },
  mapFooter: { flexDirection: 'row', alignItems: 'center', gap: 8, padding: 14 },
  mapFooterText: { flex: 1, fontSize: 13, fontWeight: '600', color: colors.gray[700] },

  reportsHeader: { flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between', marginBottom: 12 },
  count: { fontSize: 12, fontWeight: '700', color: colors.primary, marginBottom: 2 },
  chipRow: { gap: 8, paddingRight: 8 },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: '#fff',
  },
  chipActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  chipText: { fontSize: 13, fontWeight: '600', color: colors.gray[700] },
  chipTextActive: { color: '#fff' },
  chipBadge: {
    minWidth: 20,
    height: 20,
    borderRadius: 6,
    paddingHorizontal: 5,
    backgroundColor: colors.gray[100],
    alignItems: 'center',
    justifyContent: 'center',
  },
  chipBadgeActive: { backgroundColor: 'rgba(255,255,255,0.25)' },
  chipBadgeText: { fontSize: 11, fontWeight: '800', color: colors.gray[700] },

  emptyCard: {
    alignItems: 'center',
    paddingVertical: 34,
    backgroundColor: '#fff',
    borderRadius: 1,
    borderWidth: 1,
    borderColor: colors.border,
    gap: 6,
  },
  emptyTitle: { fontSize: 15, fontWeight: '700', color: colors.gray[700] },
  emptyText: { fontSize: 12.5, color: colors.gray[500], textAlign: 'center', paddingHorizontal: 24 },
});
