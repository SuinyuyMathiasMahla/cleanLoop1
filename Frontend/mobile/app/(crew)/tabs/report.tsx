import React, { useEffect, useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity, StyleSheet, Alert, Image } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '@/theme/colors';
import { api, tasksApi } from '@/services/api';
import { useAuthStore } from '@/store/authStore';

interface Participant {
  id: string;
  name: string;
  isLead: boolean;
  isMe: boolean;
}

/**
 * id -> display name for every crew member we can look up.
 * Used only when a task does not already carry names. If the endpoint is not
 * available to the signed-in crew member, we silently fall back.
 * NOTE: '/crew' is assumed; change it if your list-crew route is different.
 */
async function loadCrewDirectory(): Promise<Record<string, string>> {
  try {
    const { data } = await api.get<{ crew?: { crewId: string; name?: string; email?: string }[] }>('/crew');
    const directory: Record<string, string> = {};
    (data.crew ?? []).forEach((member) => {
      const label = member.name || member.email;
      if (member.crewId && label) directory[member.crewId] = label;
    });
    return directory;
  } catch {
    return {};
  }
}

/** Everyone who took part in a task: the lead plus the other crew members. */
function participantsOf(
  task: any,
  directory: Record<string, string>,
  me?: { userId: string; name: string } | null,
): Participant[] {
  // Names the backend may already include on the task (any of these shapes)
  const embedded: Record<string, string> = {};
  (task.crewMembers ?? []).forEach((m: any) => {
    const id = m.crewId ?? m.id ?? m.userId;
    if (id && m.name) embedded[id] = m.name;
  });

  const ids: string[] = Array.from(
    new Set([task.crewLeadId, ...(task.crewIds ?? [])].filter(Boolean)),
  );

  // Task has only a plain list of names and no ids
  if (ids.length === 0 && Array.isArray(task.crewNames)) {
    return task.crewNames.map((name: string, index: number) => ({
      id: `name-${index}`, name, isLead: false, isMe: false,
    }));
  }

  return ids.map((id) => {
    const isMe = !!me && id === me.userId;
    return {
      id,
      isLead: id === task.crewLeadId,
      isMe,
      name: embedded[id] ?? directory[id] ?? (isMe ? me!.name : '') ?? '',
    };
  }).map((p) => ({ ...p, name: p.name || 'Crew member' }));
}

export default function ReportTab() {
  const insets = useSafeAreaInsets();
  const me = useAuthStore((s) => s.user);
  const [tasks, setTasks] = useState<any[]>([]);
  const [directory, setDirectory] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

  useEffect(() => {
    loadTasks();
  }, []);

  async function loadTasks() {
    setLoading(true);
    try {
      const [{ data }, crewDirectory] = await Promise.all([
        tasksApi.getAll(),
        loadCrewDirectory(),
      ]);
      setDirectory(crewDirectory);

      const assignedTasks = data.tasks ?? [];
      const completedWithPhotos = await Promise.all(assignedTasks.map(async (task: any) => {
        if (task.status !== 'completed' || !task.evidencePhotoKeys?.length) return task;
        const { data: evidence } = await tasksApi.getEvidencePhotos(task.taskId);
        return { ...task, evidencePhotos: evidence.photos.map((photo) => photo.url) };
      }));
      setTasks(completedWithPhotos);
    } catch {
      Alert.alert('Could not load work record', 'Pull to refresh and try again.');
    } finally {
      setLoading(false);
    }
  }

  const monthlyCompleted = tasks.filter(task =>
    task.status === 'completed' && new Date(task.completedAt ?? task.updatedAt) >= monthStart,
  );
  const monthlyAssigned = tasks.filter(task => new Date(task.scheduledAt) >= monthStart);
  const onTimeCompleted = monthlyCompleted.filter(task => task.dueAt && new Date(task.completedAt ?? task.updatedAt) <= new Date(task.dueAt));
  const onTimeRate = monthlyCompleted.length ? Math.round(onTimeCompleted.length / monthlyCompleted.length * 100) : 0;

  return (
    <SafeAreaView style={styles.safe} edges={['bottom']}>
      <View style={[styles.header, { paddingTop: insets.top + 16 }]}>
        <Text style={styles.headerTitle}>Monthly work record</Text>
        <Text style={styles.headerSub}>{now.toLocaleDateString(undefined, { month: 'long', year: 'numeric' })}</Text>
      </View>
      <ScrollView style={styles.scroll} contentContainerStyle={styles.body}>
        <View style={styles.statsRow}>
          <View style={styles.stat}><Text style={styles.statValue}>{monthlyCompleted.length}</Text><Text style={styles.statLabel}>COMPLETED</Text></View>
          <View style={styles.stat}><Text style={styles.statValue}>{monthlyAssigned.length}</Text><Text style={styles.statLabel}>ASSIGNED</Text></View>
          <View style={[styles.stat, styles.statLast]}><Text style={styles.statValue}>{onTimeRate}%</Text><Text style={styles.statLabel}>ON TIME</Text></View>
        </View>
        <View style={styles.listHeader}>
          <Text style={styles.sectionLabel}>COMPLETED TASKS</Text>
          <TouchableOpacity onPress={loadTasks} accessibilityLabel="Refresh work record"><Ionicons name="refresh" size={19} color={colors.primary} /></TouchableOpacity>
        </View>
        {loading ? <Text style={styles.emptyText}>Loading monthly record...</Text> : monthlyCompleted.length === 0 ? (
          <Text style={styles.emptyText}>Completed tasks this month will appear here.</Text>
        ) : monthlyCompleted.map(task => {
          const crew = participantsOf(task, directory, me);
          return (
            <View style={styles.taskCard} key={task.taskId}>
              <View style={styles.taskTop}>
                <View style={styles.taskIcon}><Ionicons name="checkmark" size={18} color="#16804a" /></View>
                <View style={styles.taskCopy}>
                  <Text style={styles.taskTitle}>{task.title}</Text>
                  <Text style={styles.taskDate}>{new Date(task.completedAt ?? task.updatedAt).toLocaleDateString()}</Text>
                </View>
              </View>

              {crew.length > 0 && (
                <View style={styles.crewBlock}>
                  <View style={styles.crewHeading}>
                    <Ionicons name="people-outline" size={15} color={colors.gray[500]} />
                    <Text style={styles.crewHeadingText}>Crew ({crew.length})</Text>
                  </View>
                  <View style={styles.crewChips}>
                    {crew.map((member) => (
                      <View key={member.id} style={[styles.crewChip, member.isLead && styles.crewChipLead]}>
                        <Ionicons
                          name={member.isLead ? 'star' : 'person'}
                          size={12}
                          color={member.isLead ? '#b45309' : colors.gray[500]}
                        />
                        <Text style={[styles.crewChipText, member.isLead && styles.crewChipTextLead]} numberOfLines={1}>
                          {member.name}{member.isMe ? ' (you)' : ''}
                        </Text>
                      </View>
                    ))}
                  </View>
                </View>
              )}

              {!!task.evidencePhotos?.length && <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.photoStrip}>
                {task.evidencePhotos.map((uri: string, index: number) => <Image key={`${task.taskId}-${index}`} source={{ uri }} style={styles.evidencePhoto} />)}
              </ScrollView>}
            </View>
          );
        })}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  header: { backgroundColor: colors.primary, paddingHorizontal: 20, paddingBottom: 24 },
  headerTitle: { fontSize: 26, fontWeight: '800', color: colors.white, letterSpacing: -0.3 },
  headerSub: { fontSize: 13, color: 'rgba(255,255,255,0.65)', marginTop: 2 },
  scroll: { flex: 1 },
  body: { paddingHorizontal: 16, paddingTop: 20, paddingBottom: 24 },
  sectionLabel: { fontSize: 11, fontWeight: '700', color: colors.gray[500], letterSpacing: 0.8, marginBottom: 10, marginTop: 4 },
  statsRow: { flexDirection: 'row', backgroundColor: colors.white, borderRadius: 8, paddingVertical: 16, marginBottom: 22 },
  stat: { flex: 1, alignItems: 'center', borderRightWidth: 1, borderRightColor: colors.gray[100] },
  statLast: { borderRightWidth: 0 },
  statValue: { fontSize: 22, fontWeight: '800', color: colors.gray[900] },
  statLabel: { fontSize: 10, fontWeight: '700', color: colors.gray[500], marginTop: 4 },
  listHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 },
  emptyText: { textAlign: 'center', color: colors.gray[500], paddingVertical: 28 },
  taskCard: { backgroundColor: colors.white, borderRadius: 8, padding: 14, marginBottom: 10 },
  taskTop: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  taskIcon: { width: 34, height: 34, borderRadius: 17, backgroundColor: '#dcfce7', alignItems: 'center', justifyContent: 'center' },
  taskCopy: { flex: 1 },
  taskTitle: { color: colors.gray[900], fontSize: 14, fontWeight: '700' },
  taskDate: { color: colors.gray[500], fontSize: 12, marginTop: 3 },
  crewBlock: { marginTop: 12, paddingTop: 12, borderTopWidth: 1, borderTopColor: colors.gray[100] },
  crewHeading: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 8 },
  crewHeadingText: { fontSize: 12, fontWeight: '700', color: colors.gray[500] },
  crewChips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  crewChip: { flexDirection: 'row', alignItems: 'center', gap: 6, maxWidth: '100%', backgroundColor: colors.gray[100], borderRadius: 999, paddingVertical: 6, paddingHorizontal: 10 },
  crewChipLead: { backgroundColor: '#fef3c7' },
  crewChipText: { fontSize: 13, fontWeight: '600', color: colors.gray[700], flexShrink: 1 },
  crewChipTextLead: { color: '#92400e' },
  photoStrip: { marginTop: 12 },
  evidencePhoto: { width: 112, height: 92, borderRadius: 6, marginRight: 8, backgroundColor: colors.gray[100] },
});
