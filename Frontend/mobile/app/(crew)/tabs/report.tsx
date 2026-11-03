import React, { useCallback, useMemo, useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity, Image, RefreshControl, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useFocusEffect } from 'expo-router';
import { ScreenShell } from '@/components/common/ScreenShell';
import { EmptyState } from '@/components/common/EmptyState';
import { api, tasksApi, Task } from '@/services/api';
import { useAuthStore } from '@/store/authStore';
import { isMine, onTimeRate, taskIdOf } from '@/utils/tasks';
import { colors } from '@/theme/colors';

interface Participant {
  id: string;
  name: string;
  isLead: boolean;
  isMe: boolean;
}

type RecordTask = Task & { evidencePhotos?: string[]; completedAt?: string; updatedAt?: string; [k: string]: any };

/** id -> display name for every crew member we can look up (best effort). */
async function loadCrewDirectory(): Promise<Record<string, string>> {
  try {
    const { data } = await api.get<{ crew?: { crewId: string; name?: string; email?: string }[] }>('/crew');
    const directory: Record<string, string> = {};
    (data.crew ?? []).forEach((m) => {
      const label = m.name || m.email;
      if (m.crewId && label) directory[m.crewId] = label;
    });
    return directory;
  } catch {
    return {};
  }
}

function participantsOf(
  task: any,
  directory: Record<string, string>,
  me?: { userId: string; name: string } | null,
): Participant[] {
  const embedded: Record<string, string> = {};
  (task.crewMembers ?? []).forEach((m: any) => {
    const id = m.crewId ?? m.id ?? m.userId;
    if (id && m.name) embedded[id] = m.name;
  });

  const ids: string[] = Array.from(
    new Set([task.crewLeadId, ...(task.crewIds ?? [])].filter(Boolean)),
  );

  if (ids.length === 0 && Array.isArray(task.crewNames)) {
    return task.crewNames.map((name: string, i: number) => ({
      id: `name-${i}`,
      name,
      isLead: false,
      isMe: false,
    }));
  }

  return ids.map((id) => {
    const isMe = !!me && id === me.userId;
    return {
      id,
      isLead: id === task.crewLeadId,
      isMe,
      name: embedded[id] || directory[id] || (isMe ? me!.name : '') || 'Crew member',
    };
  });
}

export default function CrewRecord() {
  const me = useAuthStore((s) => s.user);
  const [tasks, setTasks] = useState<RecordTask[]>([]);
  const [directory, setDirectory] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);

  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

  const load = useCallback(async () => {
    setLoading(true);
    setError(false);
    try {
      const [{ data }, crewDirectory] = await Promise.all([tasksApi.getAll(), loadCrewDirectory()]);
      setDirectory(crewDirectory);
      const assigned = data.tasks ?? [];
      const withPhotos = await Promise.all(
        assigned.map(async (task: any) => {
          if (task.status !== 'completed' || !task.evidencePhotoKeys?.length) return task;
          try {
            const { data: evidence } = await tasksApi.getEvidencePhotos(task.taskId);
            return { ...task, evidencePhotos: evidence.photos.map((p) => p.url) };
          } catch {
            return task;
          }
        }),
      );
      setTasks(withPhotos);
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  const mine = useMemo(() => tasks.filter((t) => isMine(t, me?.userId ?? '')), [tasks, me?.userId]);
  const finishedAt = (t: RecordTask) => new Date(t.completedAt ?? t.updatedAt ?? 0);
  const monthlyCompleted = mine
    .filter((t) => t.status === 'completed' && finishedAt(t) >= monthStart)
    .sort((a, b) => finishedAt(b).getTime() - finishedAt(a).getTime());
  const monthlyAssigned = mine.filter((t) => new Date(t.scheduledAt) >= monthStart);
  const rate = onTimeRate(monthlyCompleted);

  return (
    <ScreenShell
      role="crew"
      title="Work Record"
      subtitle={now.toLocaleDateString(undefined, { month: 'long', year: 'numeric' })}
    >
      <ScrollView
        contentContainerStyle={styles.body}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={loading}
            onRefresh={load}
            tintColor={colors.primary}
            colors={[colors.primary]}
          />
        }
      >
        <View style={styles.statsRow}>
          <Stat value={monthlyCompleted.length} label="COMPLETED" />
          <Stat value={monthlyAssigned.length} label="ASSIGNED" divider />
          <Stat value={rate === null ? '—' : `${rate}%`} label="ON TIME" divider />
        </View>

        <Text style={styles.sectionLabel}>COMPLETED THIS MONTH</Text>

        {error ? (
          <EmptyState
            icon="cloud-offline-outline"
            title="Could not load your record"
            subtitle="Check your connection and try again."
            actionLabel="Try again"
            onAction={load}
          />
        ) : monthlyCompleted.length === 0 ? (
          <View style={styles.empty}>
            <Ionicons name="document-text-outline" size={34} color={colors.gray[300]} />
            <Text style={styles.emptyText}>
              {loading ? 'Loading monthly record…' : 'Completed tasks this month will appear here.'}
            </Text>
          </View>
        ) : (
          monthlyCompleted.map((task) => {
            const crew = participantsOf(task, directory, me);
            return (
              <TouchableOpacity
                key={taskIdOf(task)}
                style={styles.card}
                activeOpacity={0.85}
                onPress={() => router.push(`/(crew)/task/${taskIdOf(task)}` as any)}
              >
                <View style={styles.cardTop}>
                  <View style={styles.doneIcon}>
                    <Ionicons name="checkmark" size={18} color="#065f46" />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.cardTitle} numberOfLines={1}>{task.title}</Text>
                    <Text style={styles.cardDate}>{finishedAt(task).toLocaleDateString()}</Text>
                  </View>
                  <Ionicons name="chevron-forward" size={16} color={colors.gray[300]} />
                </View>

                {crew.length > 0 && (
                  <View style={styles.crewBlock}>
                    <View style={styles.crewHeading}>
                      <Ionicons name="people-outline" size={15} color={colors.gray[500]} />
                      <Text style={styles.crewHeadingText}>Crew ({crew.length})</Text>
                    </View>
                    <View style={styles.crewChips}>
                      {crew.map((m) => (
                        <View key={m.id} style={[styles.crewChip, m.isLead && styles.crewChipLead]}>
                          <Ionicons
                            name={m.isLead ? 'star' : 'person'}
                            size={12}
                            color={m.isLead ? '#b45309' : colors.gray[500]}
                          />
                          <Text
                            style={[styles.crewChipText, m.isLead && { color: '#92400e' }]}
                            numberOfLines={1}
                          >
                            {m.name}
                            {m.isMe ? ' (you)' : ''}
                          </Text>
                        </View>
                      ))}
                    </View>
                  </View>
                )}

                {!!task.evidencePhotos?.length && (
                  <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.photoStrip}>
                    {task.evidencePhotos.map((uri, i) => (
                      <Image key={`${taskIdOf(task)}-${i}`} source={{ uri }} style={styles.photo} />
                    ))}
                  </ScrollView>
                )}
              </TouchableOpacity>
            );
          })
        )}
      </ScrollView>
    </ScreenShell>
  );
}

function Stat({ value, label, divider }: { value: number | string; label: string; divider?: boolean }) {
  return (
    <View style={[styles.stat, divider && styles.statDivider]}>
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  body: { padding: 18, paddingBottom: 32 },
  statsRow: {
    flexDirection: 'row',
    backgroundColor: '#fff',
    borderRadius: 1,
    borderWidth: 1,
    borderColor: colors.border,
    paddingVertical: 16,
    marginBottom: 22,
  },
  stat: { flex: 1, alignItems: 'center' },
  statDivider: { borderLeftWidth: 1, borderLeftColor: colors.border },
  statValue: { fontSize: 24, fontWeight: '800', color: colors.gray[900] },
  statLabel: { fontSize: 10, fontWeight: '800', color: colors.gray[500], letterSpacing: 0.8, marginTop: 3 },

  sectionLabel: { fontSize: 11, fontWeight: '800', color: colors.gray[500], letterSpacing: 0.9, marginBottom: 10 },
  empty: {
    alignItems: 'center',
    gap: 8,
    paddingVertical: 36,
    backgroundColor: '#fff',
    borderRadius: 1,
    borderWidth: 1,
    borderColor: colors.border,
  },
  emptyText: { fontSize: 13, color: colors.gray[500], textAlign: 'center', paddingHorizontal: 24 },

  card: {
    backgroundColor: '#fff',
    borderRadius: 1,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 14,
    marginBottom: 10,
  },
  cardTop: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  doneIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#d1fae5',
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardTitle: { fontSize: 14.5, fontWeight: '800', color: colors.gray[900] },
  cardDate: { fontSize: 12, color: colors.gray[500], marginTop: 2 },
  crewBlock: { marginTop: 12, paddingTop: 12, borderTopWidth: 1, borderTopColor: colors.gray[100] },
  crewHeading: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 8 },
  crewHeadingText: { fontSize: 12, fontWeight: '700', color: colors.gray[500] },
  crewChips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  crewChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    maxWidth: '100%',
    backgroundColor: colors.gray[100],
    borderRadius: 999,
    paddingVertical: 6,
    paddingHorizontal: 10,
  },
  crewChipLead: { backgroundColor: '#fef3c7' },
  crewChipText: { fontSize: 13, fontWeight: '600', color: colors.gray[700], flexShrink: 1 },
  photoStrip: { marginTop: 12 },
  photo: { width: 112, height: 92, borderRadius: 1, marginRight: 8, backgroundColor: colors.gray[100] },
});
