export interface TaskLike {
  taskId?: string;
  id?: string;
  status?: string;
  scheduledAt?: string;
  dueAt?: string;
  completedAt?: string;
  updatedAt?: string;
  crewIds?: string[];
  crewMemberIds?: string[];
  crewLeadId?: string;
  reportIds?: string[];
}

/** Backend already scopes tasks to the caller; this is a client-side safety net. */
export function isMine<T extends TaskLike>(task: T, userId: string): boolean {
  const crew = task.crewIds ?? task.crewMemberIds ?? [];
  return crew.includes(userId) || task.crewLeadId === userId;
}

export function taskIdOf(task: TaskLike): string {
  return task.taskId ?? task.id ?? '';
}

export function isOpen(task: TaskLike): boolean {
  return task.status !== 'completed' && task.status !== 'cancelled';
}

export function isOverdue(task: TaskLike, now = new Date()): boolean {
  if (!isOpen(task) || !task.scheduledAt) return false;
  return new Date(task.dueAt ?? task.scheduledAt) < now;
}

/** Tasks that have not been started yet. */
export function isNotStarted(task: TaskLike): boolean {
  return task.status === 'assigned' || task.status === 'pending' || task.status === 'scheduled';
}

/** Share of completed tasks that were finished on or before their due date. */
export function onTimeRate(tasks: TaskLike[]): number | null {
  const done = tasks.filter((t) => t.status === 'completed' && t.dueAt);
  if (done.length === 0) return null;
  const onTime = done.filter(
    (t) => new Date(t.completedAt ?? t.updatedAt ?? 0) <= new Date(t.dueAt!),
  );
  return Math.round((onTime.length / done.length) * 100);
}

export function sortBySchedule<T extends TaskLike>(tasks: T[]): T[] {
  return [...tasks].sort((a, b) => {
    if (a.status === 'in_progress' && b.status !== 'in_progress') return -1;
    if (b.status === 'in_progress' && a.status !== 'in_progress') return 1;
    return new Date(a.scheduledAt ?? 0).getTime() - new Date(b.scheduledAt ?? 0).getTime();
  });
}

export const TASK_STATUS: Record<string, { label: string; bg: string; color: string; icon: any }> =
  {
    scheduled: { label: 'Scheduled', bg: '#fef3c7', color: '#92400e', icon: 'time' },
    pending: { label: 'Pending', bg: '#fef3c7', color: '#92400e', icon: 'time' },
    assigned: { label: 'Assigned', bg: '#dbeafe', color: '#1e40af', icon: 'person-circle' },
    in_progress: { label: 'In progress', bg: '#d9f2e3', color: '#0f3d2e', icon: 'play-circle' },
    completed: { label: 'Done', bg: '#d1fae5', color: '#065f46', icon: 'checkmark-circle' },
    cancelled: { label: 'Cancelled', bg: '#f1f5f3', color: '#6b7c76', icon: 'close-circle' },
    overdue: { label: 'Overdue', bg: '#fee2e2', color: '#b91c1c', icon: 'alert-circle' },
  };
