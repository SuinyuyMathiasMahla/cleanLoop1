// Use cases for tasks: what each endpoint and the reminder job do, in terms of the rules
// and the repository. Nothing here knows about HTTP events.
import { DeleteObjectCommand, S3Client } from '@aws-sdk/client-s3';
import {
  checkUploadedImage,
  getPresignedGetUrl,
  getPresignedPutUrl,
  IMAGE_EXTENSIONS,
} from '../shared/s3';
import { notifyCitizenCommunity, notifyUsers } from '../shared/notifications';
import * as repo from './repository';
import type { Item } from './repository';
import * as rules from './rules';
import { sendDueReminderEmail, sendTaskAssignmentEmail } from './emails';

const s3 = new S3Client({});
const MEDIA_BUCKET = process.env.MEDIA_BUCKET!;
const USERS_TABLE = process.env.USERS_TABLE!;
const NOTIFICATIONS_TABLE = process.env.NOTIFICATIONS_TABLE!;

export class ServiceError extends Error {
  constructor(
    public readonly status: 400 | 403 | 404 | 409,
    message: string,
  ) {
    super(message);
  }
}

export interface Caller {
  userId: string;
  actor: rules.TaskActor;
}

const badRequest = (message: string) => new ServiceError(400, message);
const forbidden = (message = 'Forbidden') => new ServiceError(403, message);
const notFound = () => new ServiceError(404, 'Task not found');

async function loadTask(taskId: string | undefined): Promise<Item> {
  if (!taskId) throw badRequest('taskId required');
  const task = await repo.getTask(taskId);
  if (!task) throw notFound();
  return task;
}

/** Crew may see only tasks they are on. Admins, and other callers, are not limited here. */
function requireCrewOnTask(caller: Caller, task: Item) {
  if (caller.actor === 'crew' && !rules.isOnTask(task, caller.userId)) {
    throw forbidden('Not assigned to this task');
  }
}

/** Errors here are logged, never returned: a failed notice must not fail the request. */
function logFailures(label: string, results: PromiseSettledResult<unknown>[]) {
  for (const result of results) {
    if (result.status === 'rejected') console.error(`${label}:`, result.reason);
  }
}

async function validateCrew(crewLeadId: unknown, crewIds: string[]) {
  const shapeError = rules.checkCrewShape(crewLeadId, crewIds);
  if (shapeError) throw badRequest(shapeError);
  const users = await repo.getUsers([crewLeadId as string, ...crewIds]);
  if ([crewLeadId as string, ...crewIds].some((id) => !rules.isActiveCrewProfile(users.get(id)))) {
    throw badRequest('Select active crew members for the crew lead and companions');
  }
}

// ── Notifications ──────────────────────────────────────────────────────────

async function notifyAssignment(userId: string, task: Item) {
  const isCompanion = !!task.crewLeadId && userId !== task.crewLeadId;
  const [user, lead] = await Promise.all([
    repo.getUser(userId),
    isCompanion ? repo.getUser(task.crewLeadId) : Promise.resolve(undefined),
  ]);
  if (!user) return;
  if (user.email) await sendTaskAssignmentEmail(user.email, user.name, task);

  const scheduled = new Date(task.scheduledAt).toLocaleDateString();
  await notifyUsers(NOTIFICATIONS_TABLE, [{ userId, expoPushToken: user.expoPushToken }], {
    type: 'task_assigned',
    title: isCompanion ? 'Assigned as a task companion' : 'New task assigned',
    body: isCompanion
      ? `You have been assigned to accompany ${lead?.name ?? 'the crew head'} on "${task.title}" scheduled for ${scheduled}.`
      : `You are the crew head for "${task.title}" scheduled for ${scheduled}.`,
    taskId: task.taskId,
  });
}

async function notifyCrew(userIds: string[], title: string, body: string, taskId: string) {
  const now = new Date().toISOString();
  logFailures(
    'Failed to create notification',
    await Promise.allSettled(
      userIds.map((userId) =>
        repo.putNotification({ userId, type: 'task_updated', title, body, taskId }, now),
      ),
    ),
  );
}

async function notifyCommunityTaskCompleted(task: Item, resolvedReports: Item[]) {
  if (resolvedReports.length > 0) {
    await Promise.all(
      resolvedReports.map((report) =>
        notifyCitizenCommunity(USERS_TABLE, NOTIFICATIONS_TABLE, {
          type: 'report_resolved',
          title: 'Report resolved',
          body: `The waste issue reported at ${report.address ?? 'the reported location'} has been resolved.`,
          reportId: report.reportId,
          taskId: task.taskId,
        }),
      ),
    );
    return;
  }

  // A task with no reports: tell citizens and crew that the cleanup happened
  const now = new Date().toISOString();
  await repo.forEachUserWithRole(['CITIZEN', 'citizen', 'CREW', 'crew'], async (users) => {
    logFailures(
      'Failed to create notification',
      await Promise.allSettled(
        users
          .filter((user) => !!user.userId)
          .map((user) =>
            repo.putNotification(
              {
                userId: user.userId,
                type: 'task_updated',
                title: 'Community cleanup completed',
                body: `The crew completed "${task.title}".`,
                taskId: task.taskId,
              },
              now,
            ),
          ),
      ),
    );
  });
}

// ── POST /tasks ────────────────────────────────────────────────────────────

export async function createTask(caller: Caller, body: Record<string, any>) {
  if (caller.actor !== 'admin') throw forbidden('Admin only');

  const { title, description, crewLeadId, scheduledAt, notes } = body;
  const reportIds: string[] = Array.isArray(body.reportIds) ? body.reportIds : [];
  const crewIds = rules.parseCrewIds(body);
  if (crewIds === null) throw badRequest('crewIds must be an array of crew member IDs');
  if (!title || !scheduledAt) throw badRequest('title and scheduledAt are required');
  const dueAt = rules.normalizeTaskDueAt(scheduledAt, body.dueAt);
  if (!dueAt) throw badRequest('scheduledAt and dueAt must be valid dates');
  await validateCrew(crewLeadId, crewIds ?? []);

  const now = new Date().toISOString();
  const task = {
    taskId: crypto.randomUUID(),
    title,
    description: description ?? '',
    reportIds,
    crewIds: crewIds ?? [],
    crewLeadId,
    scheduledAt,
    dueAt,
    status: 'assigned',
    notes: notes ?? '',
    evidencePhotoKeys: [],
    createdBy: caller.userId,
    createdAt: now,
    updatedAt: now,
  };
  await repo.createTask(task);

  for (const reportId of reportIds) {
    await repo
      .assignReport(reportId, task.taskId, now)
      .catch((e) => console.error(`Failed to update report ${reportId}:`, e));
  }
  logFailures(
    'Assignment notice failed',
    await Promise.allSettled(rules.taskMemberIds(task).map((id) => notifyAssignment(id, task))),
  );
  return { task };
}

// ── GET /tasks ─────────────────────────────────────────────────────────────

export async function listTasks(
  caller: Caller,
  query: { status?: string; limit?: string; lastKey?: string },
) {
  if (caller.actor === 'admin') {
    const limit = rules.clampPageLimit(query.limit);
    if (query.status) {
      const startKey = rules.decodeCursor<Record<string, unknown>>(query.lastKey);
      if (query.lastKey && !startKey) throw badRequest('lastKey is not valid');
      const page = await repo.listTasksByStatus(query.status, limit, startKey);
      return {
        tasks: page.items,
        total: page.items.length,
        nextKey: rules.encodeCursor(page.lastKey),
      };
    }
    const cursor = rules.decodeCursor<repo.AllTasksCursor>(query.lastKey);
    if (query.lastKey && typeof cursor?.statusIndex !== 'number') {
      throw badRequest('lastKey is not valid');
    }
    const page = await repo.listAllTasks(limit, cursor);
    return { tasks: page.items, total: page.items.length, nextKey: rules.encodeCursor(page.next) };
  }

  if (caller.actor === 'crew') {
    const tasks = await repo.listTasksForMember(caller.userId);
    return { tasks, total: tasks.length };
  }

  throw forbidden('Only admin or crew can list tasks');
}

// ── GET /tasks/{taskId} ────────────────────────────────────────────────────

export async function getTask(caller: Caller, taskId: string | undefined) {
  const task = await loadTask(taskId);
  requireCrewOnTask(caller, task);

  const memberIds = rules.taskMemberIds(task);
  const users = await repo.getUsers(memberIds);
  const crewRoster = memberIds.map((userId) => ({
    userId,
    name: (users.get(userId)?.name as string | undefined) ?? 'Crew member',
    isLead: userId === task.crewLeadId,
  }));
  return { task: { ...task, crewRoster } };
}

// ── PATCH /tasks/{taskId} ──────────────────────────────────────────────────

export async function updateTask(
  caller: Caller,
  taskId: string | undefined,
  body: Record<string, any>,
) {
  if (caller.actor !== 'admin') throw forbidden('Admin only');
  const before = await loadTask(taskId);

  const crewIds = rules.parseCrewIds(body);
  if (crewIds === null) throw badRequest('crewIds must be an array of crew member IDs');
  if (crewIds !== undefined) body.crewIds = crewIds;
  if (body.crewIds !== undefined || body.crewLeadId !== undefined) {
    const nextCrewIds = body.crewIds ?? before.crewIds ?? [];
    if (!Array.isArray(nextCrewIds))
      throw badRequest('crewIds must be an array of crew member IDs');
    await validateCrew(body.crewLeadId ?? before.crewLeadId, nextCrewIds);
  }

  const updates = rules.pickUpdates(body);
  if (Object.keys(updates).length === 0) throw badRequest('No updatable fields provided');

  const after = await repo.updateTask(before, updates, new Date().toISOString());

  const { added, kept } = rules.crewChanges(before, after);
  await notifyCrew(
    kept,
    'Task updated',
    `The task "${after.title}" has been updated by an administrator.`,
    after.taskId,
  );
  logFailures(
    'Assignment notice failed',
    await Promise.allSettled(added.map((id) => notifyAssignment(id, after))),
  );

  return { taskId: after.taskId, updated: Object.keys(updates) };
}

// ── PATCH /tasks/{taskId}/status ───────────────────────────────────────────

async function checkEvidence(task: Item, body: Record<string, any>) {
  const evidence = rules.checkEvidenceKeys(task.taskId, body.evidencePhotoKeys);
  if ('error' in evidence) throw badRequest(evidence.error);
  for (const key of evidence.keys) {
    const problem = await checkUploadedImage(MEDIA_BUCKET, key);
    if (problem) throw badRequest(`Evidence photo rejected: ${problem}`);
  }

  const attendance = rules.checkCompanionAttendance(task, body.companionAttendance);
  if ('error' in attendance) throw badRequest(attendance.error);
  const companions = rules.companionIds(task);
  const users = await repo.getUsers(companions);
  const markedAt = new Date().toISOString();
  return {
    evidencePhotoKeys: evidence.keys,
    companionAttendance: companions.map((userId) => ({
      userId,
      name: (users.get(userId)?.name as string | undefined) ?? 'Crew member',
      present: attendance.presentById.get(userId)!,
      markedAt,
    })),
  };
}

/** Reports follow their task; a report already moved on is left alone. */
async function moveReports(task: Item, status: rules.TaskStatus, now: string) {
  const reportIds: string[] = task.reportIds ?? [];
  if (status !== 'in_progress' && status !== 'cancelled') return;
  const results = await Promise.allSettled(
    reportIds.map((reportId) =>
      status === 'in_progress'
        ? repo.startReport(reportId, task.taskId, now)
        : repo.releaseReport(reportId, task.taskId, now),
    ),
  );
  results.forEach((result, index) => {
    const name = result.status === 'rejected' ? (result.reason as { name?: string })?.name : '';
    if (result.status === 'rejected' && name !== 'ConditionalCheckFailedException') {
      console.error(`Could not update report ${reportIds[index]}:`, result.reason);
    }
  });
}

async function resolveReports(task: Item, wasCompleted: boolean, now: string) {
  const reportIds: string[] = task.reportIds ?? [];
  const before = await repo.getReports(reportIds);
  const results = await Promise.allSettled(
    reportIds.map((reportId) => repo.resolveReport(reportId, now)),
  );
  const resolvedNow = before.filter(
    (report, index): report is Item =>
      !!report && report.status !== 'resolved' && results[index]?.status === 'fulfilled',
  );
  if (resolvedNow.length > 0 || (!wasCompleted && reportIds.length === 0)) {
    await notifyCommunityTaskCompleted(task, resolvedNow).catch((error) =>
      console.error('Community task-completion notification error:', error),
    );
  }
}

export async function setTaskStatus(
  caller: Caller,
  taskId: string | undefined,
  body: Record<string, any>,
) {
  const task = await loadTask(taskId);
  const status = body.status;
  const problem = rules.checkStatusChange({
    task,
    to: status,
    actor: caller.actor,
    callerId: caller.userId,
    reason: body.reason,
  });
  if (problem) throw new ServiceError(problem.status, problem.message);

  const now = new Date().toISOString();
  let extra: Record<string, unknown> = {};
  if (status === 'completed' && caller.actor === 'crew') {
    extra = await checkEvidence(task, body);
  }
  let reason = '';
  if (status === 'cancelled') {
    reason = rules.normalizeReason(body.reason);
    extra = { cancelReason: reason, cancelledAt: now, cancelledBy: caller.userId };
  }
  await repo.setTaskStatus(task.taskId, status, now, extra);

  await moveReports(task, status, now);
  if (status === 'completed') await resolveReports(task, task.status === 'completed', now);

  const label = rules.STATUS_LABELS[status as rules.TaskStatus] ?? status;
  await notifyCrew(
    rules.taskMemberIds(task).filter((userId) => userId !== caller.userId),
    `Task ${label}`,
    status === 'cancelled'
      ? `"${task.title}" has been cancelled. Reason: ${reason}`
      : `"${task.title}" has been marked as ${label}.`,
    task.taskId,
  );
  return { taskId: task.taskId, status };
}

// ── Evidence photos ────────────────────────────────────────────────────────

export async function getEvidenceUploadUrl(
  caller: Caller,
  taskId: string | undefined,
  contentType = 'image/jpeg',
) {
  const task = await loadTask(taskId);
  if (rules.isClosedStatus(task.status)) {
    throw forbidden('Evidence can only be uploaded while the task is active');
  }
  if (caller.actor !== 'crew' || caller.userId !== task.crewLeadId) {
    throw forbidden('Only the crew head can upload task evidence');
  }
  // The extension comes from the allowed content type, never from the client's filename
  const ext = IMAGE_EXTENSIONS[contentType];
  if (!ext) throw badRequest('contentType must be image/jpeg, image/png or image/webp');
  const key = `${rules.evidencePrefix(task.taskId)}${crypto.randomUUID()}.${ext}`;
  return { url: await getPresignedPutUrl(MEDIA_BUCKET, key, contentType), key };
}

export async function listEvidencePhotos(caller: Caller, taskId: string | undefined) {
  const task = await loadTask(taskId);
  requireCrewOnTask(caller, task);
  const keys: string[] = task.evidencePhotoKeys ?? [];
  const urls = await Promise.all(keys.map((key) => getPresignedGetUrl(MEDIA_BUCKET, key)));
  return { photos: urls.map((url, i) => ({ url, key: keys[i] })) };
}

export async function deleteEvidencePhoto(
  caller: Caller,
  taskId: string | undefined,
  key: unknown,
) {
  if (!taskId || !rules.isEvidenceKeyForTask(taskId, key)) {
    throw badRequest('A valid evidence photo key is required');
  }
  const task = await loadTask(taskId);
  if (caller.actor !== 'admin') {
    if (caller.actor !== 'crew' || caller.userId !== task.crewLeadId) {
      throw forbidden('Only the crew head can manage task evidence');
    }
    if (rules.isClosedStatus(task.status)) {
      throw forbidden('Evidence can only be removed before task completion');
    }
    if ((task.evidencePhotoKeys ?? []).includes(key)) {
      throw forbidden('Submitted task evidence cannot be removed by crew');
    }
  }
  await s3.send(new DeleteObjectCommand({ Bucket: MEDIA_BUCKET, Key: key }));
  return { taskId, key, deleted: true };
}

// ── DELETE /tasks/{taskId} ─────────────────────────────────────────────────

export async function deleteTask(caller: Caller, taskId: string | undefined) {
  if (caller.actor !== 'admin') throw forbidden('Admin only');
  const task = await loadTask(taskId);

  const now = new Date().toISOString();
  for (const reportId of (task.reportIds as string[]) ?? []) {
    await repo
      .unlinkReport(reportId, now)
      .catch((e) => console.error(`Failed to unlink report ${reportId}:`, e));
  }
  await notifyCrew(
    rules.taskMemberIds(task),
    'Task removed',
    `The task "${task.title}" has been removed by an administrator.`,
    task.taskId,
  );
  await repo.deleteTask(task);
  return { taskId: task.taskId, deleted: true };
}

// ── Scheduled reminder (email-reminder function) ──────────────────────────

/** T6: email every crew member on an active task due in the next 24 hours, once. */
export async function sendDueReminders(now: Date): Promise<number> {
  const { from, to } = rules.reminderWindow(now);
  const tasks = (await repo.listTasksDueBetween(from, to)).filter((task) =>
    rules.needsDueReminder(task, now),
  );
  for (const task of tasks) {
    const users = await repo.getUsers(rules.taskMemberIds(task));
    for (const user of users.values()) {
      if (!user.email) continue;
      await sendDueReminderEmail(user.email, user.name, task).catch((e) =>
        console.error(`Failed to send reminder to user ${user.userId} for task ${task.taskId}:`, e),
      );
    }
    // The rule runs every 30 minutes; without this flag each crew member would get a
    // reminder on every run until the task is due. updateTask clears it when dueAt moves.
    await repo
      .markReminderSent(task.taskId, now.toISOString())
      .catch((e) => console.error(`Could not record the reminder for task ${task.taskId}:`, e));
  }
  return tasks.length;
}

/** T7: tell the crew and every admin, once, that an active task passed its due time. */
export async function sendOverdueAlerts(now: Date): Promise<number> {
  const tasks = (await repo.listTasksPastDue(now.toISOString())).filter((task) =>
    rules.needsOverdueAlert(task, now),
  );
  if (tasks.length === 0) return 0;
  const admins = await repo.listUsersWithRole(['ADMIN', 'admin']);

  for (const task of tasks) {
    const recipients = new Set<string>([
      ...rules.taskMemberIds(task),
      ...admins.map((admin) => admin.userId as string),
    ]);
    const results = await Promise.allSettled(
      [...recipients].map((userId) =>
        repo.putNotification(
          {
            // A fixed ID, so a retry never stores the same alert twice
            notificationId: `overdue-${task.taskId}-${userId}`,
            userId,
            type: 'task_overdue',
            title: 'Task overdue',
            body: `Task "${task.title}" passed its due time without being completed.`,
            taskId: task.taskId,
          },
          now.toISOString(),
        ),
      ),
    );
    if (results.every((result) => result.status === 'fulfilled')) {
      await repo.markOverdueAlertSent(task.taskId, now.toISOString());
    } else {
      logFailures(`Overdue alert for task ${task.taskId}`, results);
    }
  }
  return tasks.length;
}
