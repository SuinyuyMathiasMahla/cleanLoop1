// DynamoDB access for the tasks domain. Every read is a Get, a BatchGet or a Query on an
// index from docs/api/access-patterns.md; there is no Scan here.
import { dbBatchGet, dbGet, dbPut, dbQuery, dbTransactWrite, dbUpdate } from '../shared/dynamo';
import { ACTIVE_TASK_STATUSES, TASK_STATUSES, TaskStatus, taskMemberIds } from './rules';

const TASKS_TABLE = process.env.TASKS_TABLE!;
const TASK_ASSIGNMENTS_TABLE = process.env.TASK_ASSIGNMENTS_TABLE!;
const REPORTS_TABLE = process.env.REPORTS_TABLE!;
const USERS_TABLE = process.env.USERS_TABLE!;
const NOTIFICATIONS_TABLE = process.env.NOTIFICATIONS_TABLE!;

export type Item = Record<string, any>;
type Key = Record<string, unknown>;

export interface Page {
  items: Item[];
  lastKey?: Key;
}

/** Where a walk across the status partitions stopped. */
export interface AllTasksCursor {
  statusIndex: number;
  lastKey?: Key;
}

// ── Tasks ───────────────────────────────────────────────────────────────────

export async function getTask(taskId: string): Promise<Item | undefined> {
  return dbGet({ TableName: TASKS_TABLE, Key: { taskId } });
}

function assignmentItem(task: Item, userId: string) {
  return {
    taskId: task.taskId,
    userId,
    role: userId === task.crewLeadId ? 'lead' : 'companion',
    scheduledAt: task.scheduledAt,
  };
}

/** Writes the task and one assignment item per crew member in one transaction. */
export async function createTask(task: Item): Promise<void> {
  await dbTransactWrite({
    TransactItems: [
      {
        Put: {
          TableName: TASKS_TABLE,
          Item: task,
          ConditionExpression: 'attribute_not_exists(taskId)',
        },
      },
      ...taskMemberIds(task).map((userId) => ({
        Put: { TableName: TASK_ASSIGNMENTS_TABLE, Item: assignmentItem(task, userId) },
      })),
    ],
  });
}

/**
 * Applies an admin edit and brings the assignment items in line with the new crew, in one
 * transaction. A new due date clears the reminder flag so the crew is reminded again.
 */
export async function updateTask(
  before: Item,
  updates: Record<string, unknown>,
  now: string,
): Promise<Item> {
  const names: Record<string, string> = {};
  const values: Record<string, unknown> = { ':now': now };
  const sets = Object.keys(updates).map((key) => {
    names[`#${key}`] = key;
    values[`:${key}`] = updates[key];
    return `#${key} = :${key}`;
  });
  sets.push('updatedAt = :now');

  const after = { ...before, ...updates, updatedAt: now };
  const previous = new Set(taskMemberIds(before));
  const next = taskMemberIds(after);
  const scheduleMoved = 'scheduledAt' in updates || 'crewLeadId' in updates;

  await dbTransactWrite({
    TransactItems: [
      {
        Update: {
          TableName: TASKS_TABLE,
          Key: { taskId: before.taskId },
          UpdateExpression: `SET ${sets.join(', ')}${'dueAt' in updates ? ' REMOVE reminderSentAt' : ''}`,
          ExpressionAttributeNames: names,
          ExpressionAttributeValues: values,
          ConditionExpression: 'attribute_exists(taskId)',
        },
      },
      ...next
        .filter((userId) => scheduleMoved || !previous.has(userId))
        .map((userId) => ({
          Put: { TableName: TASK_ASSIGNMENTS_TABLE, Item: assignmentItem(after, userId) },
        })),
      ...[...previous]
        .filter((userId) => !next.includes(userId))
        .map((userId) => ({
          Delete: { TableName: TASK_ASSIGNMENTS_TABLE, Key: { taskId: before.taskId, userId } },
        })),
    ],
  });
  return after;
}

export async function deleteTask(task: Item): Promise<void> {
  await dbTransactWrite({
    TransactItems: [
      { Delete: { TableName: TASKS_TABLE, Key: { taskId: task.taskId } } },
      ...taskMemberIds(task).map((userId) => ({
        Delete: { TableName: TASK_ASSIGNMENTS_TABLE, Key: { taskId: task.taskId, userId } },
      })),
    ],
  });
}

export async function setTaskStatus(
  taskId: string,
  status: TaskStatus,
  now: string,
  extra: Record<string, unknown> = {},
): Promise<void> {
  const names: Record<string, string> = { '#s': 'status' };
  const values: Record<string, unknown> = { ':s': status, ':now': now };
  const sets = ['#s = :s', 'updatedAt = :now'];
  if (status === 'completed') sets.push('completedAt = :now');
  for (const [key, value] of Object.entries(extra)) {
    names[`#${key}`] = key;
    values[`:${key}`] = value;
    sets.push(`#${key} = :${key}`);
  }
  await dbUpdate({
    TableName: TASKS_TABLE,
    Key: { taskId },
    UpdateExpression: `SET ${sets.join(', ')}`,
    ExpressionAttributeNames: names,
    ExpressionAttributeValues: values,
    ConditionExpression: 'attribute_exists(taskId)',
  });
}

/** T2: tasks in one status, on StatusIndex. */
export async function listTasksByStatus(
  status: string,
  limit: number,
  startKey?: Key,
): Promise<Page> {
  return dbQuery({
    TableName: TASKS_TABLE,
    IndexName: 'StatusIndex',
    KeyConditionExpression: '#s = :s',
    ExpressionAttributeNames: { '#s': 'status' },
    ExpressionAttributeValues: { ':s': status },
    Limit: limit,
    ...(startKey ? { ExclusiveStartKey: startKey } : {}),
  });
}

/**
 * T3: every task, by walking StatusIndex one status at a time. The cursor remembers the
 * status and the key where the page stopped, so `nextKey` works as before.
 */
export async function listAllTasks(
  limit: number,
  cursor: AllTasksCursor = { statusIndex: 0 },
): Promise<{ items: Item[]; next?: AllTasksCursor }> {
  const items: Item[] = [];
  let { statusIndex, lastKey } = cursor;
  while (statusIndex < TASK_STATUSES.length && items.length < limit) {
    const page = await listTasksByStatus(TASK_STATUSES[statusIndex], limit - items.length, lastKey);
    items.push(...page.items);
    if (page.lastKey) {
      lastKey = page.lastKey;
    } else {
      statusIndex += 1;
      lastKey = undefined;
    }
  }
  return {
    items,
    next: statusIndex < TASK_STATUSES.length ? { statusIndex, lastKey } : undefined,
  };
}

async function queryAll(params: Parameters<typeof dbQuery>[0]): Promise<Item[]> {
  const items: Item[] = [];
  let lastKey: Key | undefined;
  do {
    const page = await dbQuery({ ...params, ...(lastKey ? { ExclusiveStartKey: lastKey } : {}) });
    items.push(...page.items);
    lastKey = page.lastKey;
  } while (lastKey);
  return items;
}

/**
 * T4 and T5: tasks a crew member leads or accompanies. Assignment items cover tasks made
 * through this API; CrewIndex still covers tasks the automatic assignment creates, which
 * have a lead and no assignment items until reports moves onto the tasks service.
 */
export async function listTasksForMember(userId: string): Promise<Item[]> {
  const [led, assignments] = await Promise.all([
    queryAll({
      TableName: TASKS_TABLE,
      IndexName: 'CrewIndex',
      KeyConditionExpression: 'crewLeadId = :uid',
      ExpressionAttributeValues: { ':uid': userId },
    }),
    queryAll({
      TableName: TASK_ASSIGNMENTS_TABLE,
      IndexName: 'MemberIndex',
      KeyConditionExpression: 'userId = :uid',
      ExpressionAttributeValues: { ':uid': userId },
    }),
  ]);
  const ledIds = new Set(led.map((task) => task.taskId as string));
  const otherIds = [...new Set(assignments.map((a) => a.taskId as string))].filter(
    (taskId) => !ledIds.has(taskId),
  );
  const others = await dbBatchGet(
    TASKS_TABLE,
    otherIds.map((taskId) => ({ taskId })),
  );
  return [...led, ...others];
}

/** T6 and T7: active tasks by due date, on DueIndex, one query per active status. */
async function queryActiveByDue(
  keyCondition: string,
  values: Record<string, unknown>,
  filter: string,
): Promise<Item[]> {
  const pages = await Promise.all(
    ACTIVE_TASK_STATUSES.map((status) =>
      queryAll({
        TableName: TASKS_TABLE,
        IndexName: 'DueIndex',
        KeyConditionExpression: `#s = :s AND ${keyCondition}`,
        FilterExpression: filter,
        ExpressionAttributeNames: { '#s': 'status' },
        ExpressionAttributeValues: { ':s': status, ...values },
      }),
    ),
  );
  return pages.flat();
}

export function listTasksDueBetween(from: string, to: string): Promise<Item[]> {
  return queryActiveByDue(
    'dueAt BETWEEN :from AND :to',
    { ':from': from, ':to': to },
    'attribute_not_exists(reminderSentAt)',
  );
}

export function listTasksPastDue(now: string): Promise<Item[]> {
  return queryActiveByDue(
    'dueAt <= :now',
    { ':now': now },
    'attribute_not_exists(overdueAlertSentAt)',
  );
}

export async function markReminderSent(taskId: string, now: string): Promise<void> {
  await dbUpdate({
    TableName: TASKS_TABLE,
    Key: { taskId },
    UpdateExpression: 'SET reminderSentAt = :now',
    ExpressionAttributeValues: { ':now': now },
  });
}

export async function markOverdueAlertSent(taskId: string, now: string): Promise<void> {
  await dbUpdate({
    TableName: TASKS_TABLE,
    Key: { taskId },
    UpdateExpression: 'SET overdueAlertSentAt = :now',
    ExpressionAttributeValues: { ':now': now },
  });
}

// ── Reports that follow their task ─────────────────────────────────────────

export async function getReports(reportIds: string[]): Promise<(Item | undefined)[]> {
  return Promise.all(
    reportIds.map((reportId) => dbGet({ TableName: REPORTS_TABLE, Key: { reportId } })),
  );
}

export async function assignReport(reportId: string, taskId: string, now: string): Promise<void> {
  await dbUpdate({
    TableName: REPORTS_TABLE,
    Key: { reportId },
    UpdateExpression: 'SET #s = :s, assignedTaskId = :tid, updatedAt = :now',
    ExpressionAttributeNames: { '#s': 'status' },
    ExpressionAttributeValues: { ':s': 'assigned', ':tid': taskId, ':now': now },
  });
}

/** Only reports still waiting on this task move; a resolved report is never reopened. */
export async function startReport(reportId: string, taskId: string, now: string): Promise<void> {
  await dbUpdate({
    TableName: REPORTS_TABLE,
    Key: { reportId },
    UpdateExpression: 'SET #s = :inProgress, updatedAt = :now',
    ExpressionAttributeNames: { '#s': 'status' },
    ExpressionAttributeValues: {
      ':inProgress': 'in_progress',
      ':assigned': 'assigned',
      ':taskId': taskId,
      ':now': now,
    },
    ConditionExpression: '#s = :assigned AND assignedTaskId = :taskId',
  });
}

export async function releaseReport(reportId: string, taskId: string, now: string): Promise<void> {
  await dbUpdate({
    TableName: REPORTS_TABLE,
    Key: { reportId },
    UpdateExpression: 'SET #s = :pending, updatedAt = :now REMOVE assignedTaskId',
    ExpressionAttributeNames: { '#s': 'status' },
    ExpressionAttributeValues: {
      ':pending': 'pending',
      ':resolved': 'resolved',
      ':taskId': taskId,
      ':now': now,
    },
    ConditionExpression: '#s <> :resolved AND assignedTaskId = :taskId',
  });
}

/** Used when a task is deleted: its reports go back to pending whatever their state. */
export async function unlinkReport(reportId: string, now: string): Promise<void> {
  await dbUpdate({
    TableName: REPORTS_TABLE,
    Key: { reportId },
    UpdateExpression: 'SET #s = :s, updatedAt = :now REMOVE assignedTaskId',
    ExpressionAttributeNames: { '#s': 'status' },
    ExpressionAttributeValues: { ':s': 'pending', ':now': now },
  });
}

export async function resolveReport(reportId: string, now: string): Promise<void> {
  await dbUpdate({
    TableName: REPORTS_TABLE,
    Key: { reportId },
    UpdateExpression: 'SET #s = :resolved, completedAt = :now, updatedAt = :now',
    ExpressionAttributeNames: { '#s': 'status' },
    ExpressionAttributeValues: { ':resolved': 'resolved', ':now': now },
    ConditionExpression: 'attribute_exists(reportId)',
  });
}

// ── Users ──────────────────────────────────────────────────────────────────

export async function getUser(userId: string): Promise<Item | undefined> {
  return dbGet({ TableName: USERS_TABLE, Key: { userId } });
}

export async function getUsers(userIds: string[]): Promise<Map<string, Item>> {
  const users = await dbBatchGet(
    USERS_TABLE,
    [...new Set(userIds)].map((userId) => ({ userId })),
  );
  return new Map(users.map((user) => [user.userId as string, user as Item]));
}

/**
 * U5 and U6: users with any of the given roles, on RoleIndex, one page at a time. Roles
 * are stored in both spellings today (`CREW` and `crew`), so callers pass both.
 */
export async function forEachUserWithRole(
  roles: string[],
  visit: (users: Item[]) => Promise<void>,
): Promise<void> {
  for (const role of roles) {
    let lastKey: Key | undefined;
    do {
      const page = await dbQuery({
        TableName: USERS_TABLE,
        IndexName: 'RoleIndex',
        KeyConditionExpression: '#r = :r',
        ExpressionAttributeNames: { '#r': 'role' },
        ExpressionAttributeValues: { ':r': role },
        Limit: 100,
        ...(lastKey ? { ExclusiveStartKey: lastKey } : {}),
      });
      if (page.items.length > 0) await visit(page.items);
      lastKey = page.lastKey;
    } while (lastKey);
  }
}

export async function listUsersWithRole(roles: string[]): Promise<Item[]> {
  const users: Item[] = [];
  await forEachUserWithRole(roles, async (page) => {
    users.push(...page);
  });
  return users;
}

// ── Notifications ──────────────────────────────────────────────────────────

export interface InAppNotification {
  notificationId?: string;
  userId: string;
  type: string;
  title: string;
  body: string;
  taskId?: string;
  reportId?: string;
}

export async function putNotification(notification: InAppNotification, now: string): Promise<void> {
  await dbPut({
    TableName: NOTIFICATIONS_TABLE,
    Item: {
      notificationId: notification.notificationId ?? crypto.randomUUID(),
      userId: notification.userId,
      type: notification.type,
      title: notification.title,
      body: notification.body,
      read: false,
      taskId: notification.taskId ?? null,
      reportId: notification.reportId ?? null,
      createdAt: now,
    },
  });
}
