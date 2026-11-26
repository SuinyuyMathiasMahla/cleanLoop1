// Pure business rules for tasks. Nothing here reads the clock, the network or a table,
// so every rule is unit tested in rules.test.ts.

export const TASK_STATUSES = [
  'scheduled',
  'assigned',
  'in_progress',
  'completed',
  'cancelled',
] as const;
export type TaskStatus = (typeof TASK_STATUSES)[number];

/** Tasks still waiting on the crew. `scheduled` is legacy: nothing creates it any more. */
export const ACTIVE_TASK_STATUSES: readonly TaskStatus[] = ['assigned', 'scheduled', 'in_progress'];

export const MINIMUM_TASK_DURATION_MS = 2 * 24 * 60 * 60 * 1000;
export const REMINDER_WINDOW_MS = 24 * 60 * 60 * 1000;
export const MAX_COMPANIONS = 3;
export const MIN_COMPANIONS = 1;
export const MAX_CANCEL_REASON_LENGTH = 500;

export const ADMIN_STATUSES: readonly TaskStatus[] = TASK_STATUSES;
export const CREW_STATUSES: readonly TaskStatus[] = ['in_progress', 'completed'];

export const UPDATABLE_FIELDS = [
  'title',
  'description',
  'reportIds',
  'crewIds',
  'crewLeadId',
  'scheduledAt',
  'dueAt',
  'notes',
] as const;

export const STATUS_LABELS: Record<TaskStatus, string> = {
  scheduled: 'Scheduled',
  assigned: 'Assigned',
  in_progress: 'In Progress',
  completed: 'Completed',
  cancelled: 'Cancelled',
};

export interface TaskCrew {
  crewLeadId?: string | null;
  crewIds?: string[] | null;
}

export interface RuleError {
  status: 400 | 403 | 409;
  message: string;
}

export function isTaskStatus(value: unknown): value is TaskStatus {
  return typeof value === 'string' && (TASK_STATUSES as readonly string[]).includes(value);
}

export function isActiveStatus(status: unknown): boolean {
  return isTaskStatus(status) && ACTIVE_TASK_STATUSES.includes(status);
}

/** Completed and cancelled tasks take no more evidence. */
export function isClosedStatus(status: unknown): boolean {
  return status === 'completed' || status === 'cancelled';
}

/**
 * The due date is at least two days after the scheduled start, and exactly that when no
 * due date is asked for. Returns null when either date is not a valid date.
 */
export function normalizeTaskDueAt(scheduledAt: unknown, requestedDueAt?: unknown): string | null {
  if (typeof scheduledAt !== 'string') return null;
  const scheduledTime = new Date(scheduledAt).getTime();
  if (!Number.isFinite(scheduledTime)) return null;
  const earliestDueTime = scheduledTime + MINIMUM_TASK_DURATION_MS;
  if (requestedDueAt === undefined || requestedDueAt === null || requestedDueAt === '') {
    return new Date(earliestDueTime).toISOString();
  }
  if (typeof requestedDueAt !== 'string') return null;
  const requestedDueTime = new Date(requestedDueAt).getTime();
  if (!Number.isFinite(requestedDueTime)) return null;
  return new Date(Math.max(requestedDueTime, earliestDueTime)).toISOString();
}

/** Reads `crewIds` (or its older name `crewMemberIds`); null when it is not a list of IDs. */
export function parseCrewIds(body: Record<string, unknown>): string[] | null | undefined {
  const raw = body.crewIds !== undefined ? body.crewIds : body.crewMemberIds;
  if (raw === undefined) return undefined;
  if (!Array.isArray(raw) || raw.some((id) => typeof id !== 'string')) return null;
  return raw as string[];
}

/** The shape of a crew: a lead, one to three distinct companions, the lead not among them. */
export function checkCrewShape(
  crewLeadId: unknown,
  crewIds: string[],
  minimumCompanions = MIN_COMPANIONS,
): string | null {
  if (typeof crewLeadId !== 'string' || !crewLeadId) return 'A crew lead is required';
  if (crewIds.length < minimumCompanions) return `Select at least ${minimumCompanions} companion`;
  if (crewIds.length > MAX_COMPANIONS) {
    return `A task can have no more than ${MAX_COMPANIONS} companions`;
  }
  if (new Set(crewIds).size !== crewIds.length) return 'Companion crew members must be unique';
  if (crewIds.includes(crewLeadId)) return 'The crew lead cannot also be a companion';
  return null;
}

/** Crew profiles are stored with either spelling of the role. */
export function isActiveCrewProfile(user: Record<string, unknown> | undefined): boolean {
  return !!user && String(user.role).toLowerCase() === 'crew' && user.status !== 'inactive';
}

/** Everyone on the task, lead first, without duplicates. */
export function taskMemberIds(task: TaskCrew): string[] {
  return [...new Set([...(task.crewLeadId ? [task.crewLeadId] : []), ...(task.crewIds ?? [])])];
}

export function companionIds(task: TaskCrew): string[] {
  return [...new Set(task.crewIds ?? [])].filter((userId) => userId !== task.crewLeadId);
}

export function isOnTask(task: TaskCrew, userId: string): boolean {
  return taskMemberIds(task).includes(userId);
}

/**
 * The target task lifecycle from docs/api/state-machines.md. `PATCH /tasks/{id}/status`
 * does not enforce it yet for admins: that needs the team's agreement (SCRUM-47).
 */
const TARGET_TRANSITIONS: Record<TaskStatus, readonly TaskStatus[]> = {
  scheduled: ['assigned', 'in_progress', 'cancelled'],
  assigned: ['assigned', 'in_progress', 'completed', 'cancelled'],
  in_progress: ['completed', 'cancelled'],
  completed: [],
  cancelled: [],
};

export function isTargetTransition(from: unknown, to: TaskStatus): boolean {
  return isTaskStatus(from) && TARGET_TRANSITIONS[from].includes(to);
}

export type TaskActor = 'admin' | 'crew' | 'other';

export interface StatusChange {
  task: TaskCrew & { status?: unknown };
  to: unknown;
  actor: TaskActor;
  callerId: string;
  reason?: unknown;
}

/**
 * Who may set which status. Admins may set any status; crew on the task may start it,
 * and only the lead may complete it. A cancellation always needs a reason.
 */
export function checkStatusChange(change: StatusChange): RuleError | null {
  const { task, to, actor, callerId } = change;
  if (actor === 'admin') {
    if (!isTaskStatus(to) || !ADMIN_STATUSES.includes(to)) {
      return { status: 400, message: `status must be one of: ${ADMIN_STATUSES.join(', ')}` };
    }
  } else if (actor === 'crew') {
    if (!isTaskStatus(to) || !CREW_STATUSES.includes(to)) {
      return { status: 400, message: `crew can only set: ${CREW_STATUSES.join(', ')}` };
    }
    if (!isOnTask(task, callerId)) return { status: 403, message: 'Not assigned to this task' };
    if (to === 'completed' && callerId !== task.crewLeadId) {
      return {
        status: 403,
        message: 'Only the crew head can complete the task and submit evidence',
      };
    }
  } else {
    return { status: 403, message: 'Forbidden' };
  }

  if (to === 'cancelled') {
    const reason = normalizeReason(change.reason);
    if (!reason) return { status: 400, message: 'A reason is required to cancel a task' };
    if (reason.length > MAX_CANCEL_REASON_LENGTH) {
      return {
        status: 400,
        message: `The reason must be ${MAX_CANCEL_REASON_LENGTH} characters or fewer`,
      };
    }
  }
  return null;
}

export function normalizeReason(reason: unknown): string {
  return typeof reason === 'string' ? reason.trim().replace(/\s+/g, ' ') : '';
}

/** Evidence must be at least one photo uploaded under this task's own prefix. */
export function checkEvidenceKeys(
  taskId: string,
  keys: unknown,
): { keys: string[] } | { error: string } {
  const list = Array.isArray(keys) ? keys : [];
  if (list.length === 0) {
    return { error: 'At least one evidence photo is required to complete a task' };
  }
  const prefix = evidencePrefix(taskId);
  for (const key of list) {
    if (typeof key !== 'string' || !key.startsWith(prefix) || key.includes('..')) {
      return { error: 'Evidence photos must be uploaded for this task' };
    }
  }
  return { keys: [...new Set(list as string[])] };
}

export function evidencePrefix(taskId: string): string {
  return `evidence/${taskId}/`;
}

export function isEvidenceKeyForTask(taskId: string, key: unknown): key is string {
  return typeof key === 'string' && key.startsWith(evidencePrefix(taskId)) && !key.includes('..');
}

/** The lead records, once, whether each companion was there. */
export function checkCompanionAttendance(
  task: TaskCrew,
  attendance: unknown,
): { presentById: Map<string, boolean> } | { error: string } {
  if (!Array.isArray(attendance)) {
    return {
      error: 'Record whether each assigned companion was present before completing the task',
    };
  }
  const presentById = new Map<string, boolean>();
  for (const entry of attendance) {
    if (
      !entry ||
      typeof entry.userId !== 'string' ||
      typeof entry.present !== 'boolean' ||
      presentById.has(entry.userId)
    ) {
      return {
        error: 'Companion attendance entries must contain unique userIds and present values',
      };
    }
    presentById.set(entry.userId, entry.present);
  }
  const expected = companionIds(task);
  if (presentById.size !== expected.length || expected.some((id) => !presentById.has(id))) {
    return { error: 'Record attendance for every assigned companion' };
  }
  return { presentById };
}

/** Which crew members an edit adds and removes. */
export function crewChanges(before: TaskCrew, after: TaskCrew) {
  const previous = new Set(taskMemberIds(before));
  const next = taskMemberIds(after);
  return {
    added: next.filter((id) => !previous.has(id)),
    kept: next.filter((id) => previous.has(id)),
    removed: [...previous].filter((id) => !next.includes(id)),
  };
}

/** The fields an admin edit may change, in the order they were allowed. */
export function pickUpdates(body: Record<string, unknown>): Record<string, unknown> {
  const updates: Record<string, unknown> = {};
  for (const key of UPDATABLE_FIELDS) {
    if (key in body) updates[key] = body[key];
  }
  return updates;
}

/** Active, due within the next 24 hours, and not yet reminded. */
export function needsDueReminder(task: Record<string, unknown>, now: Date): boolean {
  if (!isActiveStatus(task.status) || task.reminderSentAt) return false;
  const due = new Date(String(task.dueAt)).getTime();
  return Number.isFinite(due) && due >= now.getTime() && due <= now.getTime() + REMINDER_WINDOW_MS;
}

/** Active, past its due time, and admins not yet alerted. */
export function needsOverdueAlert(task: Record<string, unknown>, now: Date): boolean {
  if (!isActiveStatus(task.status) || task.overdueAlertSentAt) return false;
  const due = new Date(String(task.dueAt)).getTime();
  return Number.isFinite(due) && due <= now.getTime();
}

export function reminderWindow(now: Date): { from: string; to: string } {
  return {
    from: now.toISOString(),
    to: new Date(now.getTime() + REMINDER_WINDOW_MS).toISOString(),
  };
}

export function clampPageLimit(limit: unknown, fallback = 500, maximum = 500): number {
  const parsed = typeof limit === 'string' ? parseInt(limit, 10) : Number(limit);
  return Math.min(Math.max(Number.isFinite(parsed) && parsed > 0 ? parsed : fallback, 1), maximum);
}

export function encodeCursor(value: unknown): string | null {
  return value === undefined || value === null
    ? null
    : Buffer.from(JSON.stringify(value)).toString('base64');
}

export function decodeCursor<T>(cursor: string | undefined): T | undefined {
  if (!cursor) return undefined;
  try {
    return JSON.parse(Buffer.from(cursor, 'base64').toString()) as T;
  } catch {
    return undefined;
  }
}
