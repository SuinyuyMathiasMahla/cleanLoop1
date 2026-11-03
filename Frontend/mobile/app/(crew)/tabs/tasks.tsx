import React, { useCallback, useMemo, useState } from 'react';
import { View, Text, FlatList, TouchableOpacity, StyleSheet, RefreshControl } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useFocusEffect } from 'expo-router';
import { ScreenShell } from '@/components/common/ScreenShell';
import { EmptyState } from '@/components/common/EmptyState';
import { LoadingSpinner } from '@/components/common/LoadingSpinner';
import { tasksApi, Task, getApiErrorMessage } from '@/services/api';
import { useAuthStore } from '@/store/authStore';
import {
  isMine,
  isNotStarted,
  isOpen,
  isOverdue,
  sortBySchedule,
  taskIdOf,
  TASK_STATUS,
} from '@/utils/tasks';
import { colors } from '@/theme/colors';

type FilterKey = 'all' | 'pending' | 'in_progress' | 'completed';

const FILTERS: { key: FilterKey; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'pending', label: 'To do' },
  { key: 'in_progress', label: 'In progress' },
  { key: 'completed', label: 'Done' },
];

export default function TasksList() {
  const userId = useAuthStore((s) => s.user?.userId ?? '');
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState('');
  const [filter, setFilter] = useState<FilterKey>('all');

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const { data } = await tasksApi.getAll();
      setTasks(data.tasks ?? []);
    } catch (err) {
      setError(getApiErrorMessage(err));
    } finally {
      setLoading(false);
      setLoaded(true);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  const mine = useMemo(() => tasks.filter((t) => isMine(t, userId)), [tasks, userId]);
  const todo = mine.filter((t) => isNotStarted(t));
  const inProgress = mine.filter((t) => t.status === 'in_progress');
  const done = mine.filter((t) => !isOpen(t));

  const visible = useMemo(() => {
    const list =
      filter === 'all' ? mine : filter === 'pending' ? todo : filter === 'in_progress' ? inProgress : done;
    return sortBySchedule(list);
  }, [filter, mine, todo, inProgress, done]);

  const counts: Record<FilterKey, number> = {
    all: mine.length,
    pending: todo.length,
    in_progress: inProgress.length,
    completed: done.length,
  };

  if (!loaded && loading) return <LoadingSpinner fullScreen message="Loading tasks..." />;

  return (
    <ScreenShell
      role="crew"
      title="My Tasks"
      subtitle={`${mine.length} assigned · ${todo.length + inProgress.length} open`}
    >
      <View style={styles.filterBar}>
        <FlatList
          data={FILTERS}
          horizontal
          showsHorizontalScrollIndicator={false}
          keyExtractor={(f) => f.key}
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
                <View style={[styles.chipBadge, active && styles.chipBadgeActive]}>
                  <Text style={[styles.chipBadgeText, active && { color: '#fff' }]}>{counts[item.key]}</Text>
                </View>
              </TouchableOpacity>
            );
          }}
        />
      </View>

      <FlatList
        data={visible}
        keyExtractor={(t) => taskIdOf(t)}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[styles.list, visible.length === 0 && { flex: 1 }]}
        refreshControl={
          <RefreshControl
            refreshing={loading}
            onRefresh={load}
            tintColor={colors.primary}
            colors={[colors.primary]}
          />
        }
        ListEmptyComponent={
          <EmptyState
            icon={error ? 'cloud-offline-outline' : 'checkmark-done-outline'}
            title={error ? 'Could not load tasks' : 'No tasks here'}
            subtitle={error || 'Tasks assigned to you will appear in this list.'}
            actionLabel={error ? 'Try again' : undefined}
            onAction={error ? load : undefined}
          />
        }
        renderItem={({ item: task }) => {
          const overdue = isOverdue(task);
          const status = TASK_STATUS[overdue ? 'overdue' : task.status] ?? TASK_STATUS.pending;
          return (
            <TouchableOpacity
              style={styles.card}
              activeOpacity={0.85}
              onPress={() => router.push(`/(crew)/task/${taskIdOf(task)}` as any)}
            >
              <View style={[styles.icon, { backgroundColor: status.bg }]}>
                <Ionicons name={status.icon} size={21} color={status.color} />
              </View>
              <View style={{ flex: 1 }}>
                <View style={styles.cardTop}>
                  <Text style={styles.title} numberOfLines={1}>
                    {task.title ?? 'Untitled task'}
                  </Text>
                  <View style={[styles.badge, { backgroundColor: status.bg }]}>
                    <Text style={[styles.badgeText, { color: status.color }]}>{status.label}</Text>
                  </View>
                </View>
                <Text style={styles.address} numberOfLines={1}>
                  {task.addresses?.[0] ?? 'No location'}
                </Text>
                <View style={styles.metaRow}>
                  <Meta icon="calendar-outline" text={new Date(task.scheduledAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })} danger={overdue} />
                  <Meta icon="time-outline" text={new Date(task.scheduledAt).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })} />
                  <Meta icon="document-text-outline" text={`${(task.reportIds ?? []).length} rep.`} />
                </View>
              </View>
              <Ionicons name="chevron-forward" size={17} color={colors.gray[300]} />
            </TouchableOpacity>
          );
        }}
      />
    </ScreenShell>
  );
}

function Meta({ icon, text, danger }: { icon: any; text: string; danger?: boolean }) {
  return (
    <View style={[styles.meta, danger && styles.metaDanger]}>
      <Ionicons name={icon} size={11} color={danger ? '#b91c1c' : colors.gray[500]} />
      <Text style={[styles.metaText, danger && { color: '#b91c1c' }]}>{text}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  filterBar: { paddingTop: 16, paddingBottom: 4 },
  filterRow: { paddingHorizontal: 16, gap: 8 },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 1,
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
    borderRadius: 10,
    paddingHorizontal: 5,
    backgroundColor: colors.gray[100],
    alignItems: 'center',
    justifyContent: 'center',
  },
  chipBadgeActive: { backgroundColor: 'rgba(255,255,255,0.25)' },
  chipBadgeText: { fontSize: 11, fontWeight: '800', color: colors.gray[700] },

  list: { paddingHorizontal: 16, paddingTop: 12, paddingBottom: 28 },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: '#fff',
    borderRadius: 1,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 14,
    marginBottom: 10,
  },
  icon: { width: 46, height: 46, borderRadius: 15, alignItems: 'center', justifyContent: 'center' },
  cardTop: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 3 },
  title: { flex: 1, fontSize: 14.5, fontWeight: '800', color: colors.gray[900] },
  badge: { borderRadius: 9, paddingHorizontal: 8, paddingVertical: 3 },
  badgeText: { fontSize: 10.5, fontWeight: '800' },
  address: { fontSize: 12.5, color: colors.gray[500], marginBottom: 8 },
  metaRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  meta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: colors.gray[50],
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.gray[100],
    paddingHorizontal: 7,
    paddingVertical: 3,
  },
  metaDanger: { backgroundColor: '#fee2e2', borderColor: '#fecaca' },
  metaText: { fontSize: 11, fontWeight: '600', color: colors.gray[500] },
});
