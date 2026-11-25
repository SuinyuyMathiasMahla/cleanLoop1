import React, { useCallback, useMemo, useState } from 'react';
import { View, Text, FlatList, RefreshControl, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useFocusEffect } from 'expo-router';
import { ScreenShell } from '@/components/common/ScreenShell';
import { ReportCard } from '@/components/citizen/ReportCard';
import { EmptyState } from '@/components/common/EmptyState';
import { LoadingSpinner } from '@/components/common/LoadingSpinner';
import { useReportStore } from '@/store/reportStore';
import { colors } from '@/theme/colors';

type Scope = 'mine' | 'community';
type FilterKey = 'all' | 'pending' | 'assigned' | 'in_progress' | 'resolved';

const FILTERS: { key: FilterKey; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'pending', label: 'Pending' },
  { key: 'assigned', label: 'Assigned' },
  { key: 'in_progress', label: 'In progress' },
  { key: 'resolved', label: 'Resolved' },
];

export default function MyReportsScreen() {
  const router = useRouter();
  const {
    publicReports,
    publicNextKey,
    myReports,
    myNextKey,
    isLoading,
    fetchPublicReports,
    loadMorePublicReports,
    fetchMyReports,
    loadMoreMyReports,
  } = useReportStore();

  const [scope, setScope] = useState<Scope>('mine');
  const [filter, setFilter] = useState<FilterKey>('all');

  const load = useCallback(() => {
    if (scope === 'mine') fetchMyReports();
    else fetchPublicReports(filter === 'all' ? undefined : filter);
  }, [scope, filter, fetchMyReports, fetchPublicReports]);

  // Reload whenever the tab is focused (e.g. right after submitting a report)
  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  const source = scope === 'mine' ? myReports : publicReports;
  const filtered = useMemo(
    () => (filter === 'all' ? source : source.filter((r) => r.status === filter)),
    [source, filter],
  );

  const filterLabel = FILTERS.find((f) => f.key === filter)?.label.toLowerCase() ?? '';

  const header = (
    <>
      <View style={styles.segment}>
        {(['mine', 'community'] as Scope[]).map((s) => {
          const active = scope === s;
          return (
            <TouchableOpacity
              key={s}
              style={[styles.segmentBtn, active && styles.segmentBtnActive]}
              onPress={() => setScope(s)}
              activeOpacity={0.85}
            >
              <Ionicons
                name={s === 'mine' ? 'person-outline' : 'people-outline'}
                size={15}
                color={active ? colors.primary : colors.mint}
              />
              <Text style={[styles.segmentText, active && styles.segmentTextActive]}>
                {s === 'mine' ? 'My reports' : 'Community'}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>
    </>
  );

  return (
    <ScreenShell
      role="citizen"
      title={scope === 'mine' ? 'My Reports' : 'Community Reports'}
      subtitle={`${filtered.length} ${filtered.length === 1 ? 'report' : 'reports'}${
        filter !== 'all' ? ` · ${filterLabel}` : ''
      }`}
      headerExtra={header}
    >
      <View style={styles.filterBar}>
        <FlatList
          data={FILTERS}
          horizontal
          showsHorizontalScrollIndicator={false}
          keyExtractor={(item) => item.key}
          contentContainerStyle={styles.filterRow}
          renderItem={({ item }) => {
            const active = filter === item.key;
            return (
              <TouchableOpacity
                style={[styles.chip, active && styles.chipActive]}
                onPress={() => setFilter(item.key)}
                activeOpacity={0.8}
              >
                <Text style={[styles.chipText, active && styles.chipTextActive]}>{item.label}</Text>
              </TouchableOpacity>
            );
          }}
        />
      </View>

      {isLoading && source.length === 0 ? (
        <LoadingSpinner fullScreen message="Loading reports..." />
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={(item, index) => item.reportId ?? item.id ?? String(index)}
          renderItem={({ item }) => <ReportCard report={item as any} style={styles.card} />}
          contentContainerStyle={[styles.list, filtered.length === 0 && { flex: 1 }]}
          ListEmptyComponent={
            <EmptyState
              icon="document-outline"
              title={filter === 'all' ? 'No reports yet' : `No ${filterLabel} reports`}
              subtitle={
                filter !== 'all'
                  ? 'No reports with this status.'
                  : scope === 'mine'
                    ? "You haven't submitted any reports yet."
                    : 'No reports in your community yet.'
              }
              actionLabel={filter === 'all' && scope === 'mine' ? 'Report an issue' : undefined}
              onAction={
                filter === 'all' && scope === 'mine'
                  ? () => router.navigate('/(citizen)/tabs/report' as any)
                  : undefined
              }
            />
          }
          refreshControl={
            <RefreshControl
              refreshing={isLoading}
              onRefresh={load}
              tintColor={colors.primary}
              colors={[colors.primary]}
            />
          }
          onEndReached={() => {
            if (scope === 'community' && publicNextKey) loadMorePublicReports();
            if (scope === 'mine' && myNextKey) loadMoreMyReports();
          }}
          onEndReachedThreshold={0.6}
          showsVerticalScrollIndicator={false}
        />
      )}
    </ScreenShell>
  );
}

const styles = StyleSheet.create({
  segment: {
    flexDirection: 'row',
    marginHorizontal: 20,
    marginTop: 14,
    backgroundColor: 'rgba(255,255,255,0.10)',
    borderRadius: 6,
    padding: 4,
  },
  segmentBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 10,
    borderRadius: 6,
  },
  segmentBtnActive: { backgroundColor: '#fff' },
  segmentText: { fontSize: 13, fontWeight: '700', color: colors.mint },
  segmentTextActive: { color: colors.primary },

  filterBar: { paddingTop: 16, paddingBottom: 4 },
  filterRow: { paddingHorizontal: 16, gap: 8 },
  chip: {
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

  list: { paddingTop: 12, paddingBottom: 28 },
  card: { marginHorizontal: 16 },
});
