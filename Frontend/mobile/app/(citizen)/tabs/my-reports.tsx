import React, { useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  FlatList,
  RefreshControl,
  TouchableOpacity,
  StyleSheet,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { ReportCard } from '@/components/citizen/ReportCard';
import { EmptyState } from '@/components/common/EmptyState';
import { LoadingSpinner } from '@/components/common/LoadingSpinner';
import { useReportStore } from '@/store/reportStore';
import { useAuthStore } from '@/store/authStore';
import { colors } from '@/theme/colors';
import { useLocalSearchParams, useRouter } from 'expo-router';

type FilterTab = 'all' | 'pending' | 'assigned' | 'in_progress' | 'resolved';

const PRIMARY = '#1a7a5e';
const DARK    = '#0f1f1a';
const MUTED   = '#6b7c76';

const FILTER_TABS: { key: FilterTab; label: string; icon: string }[] = [
  { key: 'all',         label: 'All',         icon: 'apps-outline' },
  { key: 'pending',     label: 'Pending',     icon: 'time-outline' },
  { key: 'assigned',    label: 'Assigned',    icon: 'person-outline' },
  { key: 'in_progress', label: 'In Progress', icon: 'reload-outline' },
  { key: 'resolved',    label: 'Resolved',    icon: 'checkmark-circle-outline' },
];

const STATUS_COLOR: Record<string, string> = {
  pending:     '#FFC107',
  assigned:    '#2196F3',
  in_progress: '#FF9800',
  resolved:    '#4CAF50',
};

export default function MyReportsScreen() {
  const router = useRouter();
  const { user } = useAuthStore();
  const { status } = useLocalSearchParams<{ status?: string }>();
  const {
    publicReports, publicNextKey, myReports,
    isLoading, fetchPublicReports, loadMorePublicReports, fetchMyReports,
  } = useReportStore();

  const initialTab = FILTER_TABS.some(t => t.key === status) ? status as FilterTab : 'all';
  const [activeTab, setActiveTab] = useState<FilterTab>(initialTab);

  const isSignedIn = !!user;
  const reports = isSignedIn ? publicReports : myReports;

  useEffect(() => {
    if (isSignedIn) {
      fetchPublicReports(activeTab === 'all' ? undefined : activeTab);
    } else {
      fetchMyReports();
    }
  }, [isSignedIn, activeTab]);

  const onRefresh = useCallback(() => {
    if (isSignedIn) {
      fetchPublicReports(activeTab === 'all' ? undefined : activeTab);
    } else {
      fetchMyReports();
    }
  }, [isSignedIn, activeTab]);

  const filtered =
    activeTab === 'all' ? reports : reports.filter(r => r.status === activeTab);

  const activeColor = activeTab !== 'all' ? (STATUS_COLOR[activeTab] ?? PRIMARY) : PRIMARY;

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>

      {/* HEADER */}
      <View style={styles.header}>
        <View style={styles.headerTop}>
          <View>
            <Text style={styles.headerTitle}>
              {isSignedIn ? 'Community Reports' : 'My Reports'}
            </Text>
            <Text style={styles.headerSub}>
              {filtered.length} {filtered.length === 1 ? 'report' : 'reports'}
              {activeTab !== 'all' ? ` · ${activeTab.replace('_', ' ')}` : ' total'}
            </Text>
          </View>
          <View style={[styles.countBadge, { backgroundColor: activeColor + '22', borderColor: activeColor + '55' }]}>
            <Text style={[styles.countBadgeText, { color: activeColor }]}>{filtered.length}</Text>
          </View>
        </View>

        {/* FILTER TABS */}
        <FlatList
          data={FILTER_TABS}
          horizontal
          showsHorizontalScrollIndicator={false}
          keyExtractor={item => item.key}
          contentContainerStyle={styles.tabsRow}
          renderItem={({ item }) => {
            const isActive = activeTab === item.key;
            const tColor = item.key !== 'all' ? (STATUS_COLOR[item.key] ?? PRIMARY) : PRIMARY;
            return (
              <TouchableOpacity
                style={[
                  styles.tab,
                  isActive && { backgroundColor: tColor + '18', borderColor: tColor + '55' },
                ]}
                onPress={() => setActiveTab(item.key)}
                activeOpacity={0.75}
              >
                <Ionicons
                  name={item.icon as any}
                  size={13}
                  color={isActive ? tColor : MUTED}
                />
                <Text style={[styles.tabText, isActive && { color: tColor, fontWeight: '700' }]}>
                  {item.label}
                </Text>
              </TouchableOpacity>
            );
          }}
        />
      </View>

      {/* CONTENT */}
      {isLoading && reports.length === 0 ? (
        <LoadingSpinner fullScreen message="Loading reports..." />
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={(item, index) => item.reportId ?? String(index)}
          renderItem={({ item }) => <ReportCard report={item} />}
          contentContainerStyle={[styles.list, filtered.length === 0 && styles.listEmpty]}
          ListEmptyComponent={
            <EmptyState
              icon="document-outline"
              title={activeTab === 'all' ? 'No reports yet' : `No ${activeTab.replace('_', ' ')} reports`}
              subtitle={
                activeTab === 'all'
                  ? isSignedIn
                    ? 'No reports in your community yet.'
                    : "You haven't submitted any reports yet."
                  : 'No reports with this status.'
              }
              actionLabel={activeTab === 'all' ? 'Report an Issue' : undefined}
              onAction={activeTab === 'all' ? () => router.push('/(citizen)/tabs/report') : undefined}
            />
          }
          refreshControl={
            <RefreshControl
              refreshing={isLoading}
              onRefresh={onRefresh}
              tintColor={PRIMARY}
              colors={[PRIMARY]}
            />
          }
          onEndReached={() => { if (isSignedIn && publicNextKey) loadMorePublicReports(); }}
          onEndReachedThreshold={0.6}
          showsVerticalScrollIndicator={false}
        />
      )}

    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#f0f4f2' },

  // Header
  header: {
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#e4ede8',
    paddingTop: 14,
  },
  headerTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    paddingHorizontal: 18,
    marginBottom: 14,
  },
  headerTitle: { fontSize: 20, fontWeight: '800', color: DARK, letterSpacing: -0.3 },
  headerSub:   { fontSize: 12, color: MUTED, marginTop: 3, fontWeight: '500' },
  countBadge: {
    borderRadius: 4,
    borderWidth: 1,
    paddingHorizontal: 10,
    paddingVertical: 4,
    minWidth: 36,
    alignItems: 'center',
  },
  countBadgeText: { fontSize: 14, fontWeight: '800' },

  // Tabs
  tabsRow: { paddingHorizontal: 14, paddingBottom: 12, gap: 8 },
  tab: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#e4ede8',
    backgroundColor: '#f7faf8',
  },
  tabText: { fontSize: 13, fontWeight: '600', color: MUTED },

  // List
  list:      { paddingTop: 12, paddingBottom: 32 },
  listEmpty: { flex: 1 },
});