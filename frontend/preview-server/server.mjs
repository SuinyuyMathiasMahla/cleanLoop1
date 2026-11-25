// Preview server: a stand-in for the CleanLoop backend and Cognito, holding fictional
// data in memory. It follows docs/api/openapi.yaml so the apps run their real code
// against it. Nothing is sent to AWS, and restarting the server resets the data.
//
// Run through `node frontend/preview-server/start.mjs` (see README.md in this folder).

import http from 'node:http';
import { randomUUID } from 'node:crypto';
import { createSeed } from './seed.mjs';

export const PORT = Number(process.env.PREVIEW_PORT ?? 4010);
const BASE = `http://127.0.0.1:${PORT}`;
const MAX_IMAGE_BYTES = 10 * 1024 * 1024;
const IMAGE_TYPES = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp' };
const MAX_ASSIGN_KM = 25;

let db = createSeed();
const now = () => new Date().toISOString();

// ── HTTP helpers ──────────────────────────────────────────────────────────────
const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type,Authorization,X-Amz-Target,X-Amz-User-Agent',
  'Access-Control-Allow-Methods': 'GET,POST,PATCH,PUT,DELETE,OPTIONS',
};
class HttpError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}
const fail = (status, message) => {
  throw new HttpError(status, message);
};
const send = (res, status, body, type = 'application/json') => {
  res.writeHead(status, { ...CORS, 'Content-Type': type });
  res.end(type === 'application/json' ? JSON.stringify(body) : body);
};
const readBody = (req) =>
  new Promise((resolve, reject) => {
    const chunks = [];
    req.on('data', (c) => chunks.push(c));
    req.on('end', () => resolve(Buffer.concat(chunks)));
    req.on('error', reject);
  });
const json = (buf) => {
  try {
    return buf.length ? JSON.parse(buf.toString('utf8')) : {};
  } catch {
    fail(400, 'Body must be JSON');
  }
};

// ── Tokens: unsigned JWT-shaped strings the apps can decode ───────────────────
const b64 = (o) => Buffer.from(JSON.stringify(o)).toString('base64url');
function tokensFor(user) {
  const claims = {
    sub: user.userId,
    email: user.email,
    name: user.name,
    'custom:role': user.role,
    'cognito:groups': user.role === 'CITIZEN' ? [] : [user.role],
    token_use: 'id',
    iss: 'cleanloop-preview',
    exp: Math.floor(Date.now() / 1000) + 30 * 24 * 3600,
  };
  const id = `${b64({ alg: 'none', typ: 'JWT' })}.${b64(claims)}.preview`;
  return {
    IdToken: id,
    AccessToken: id,
    RefreshToken: `preview-refresh.${user.userId}`,
    ExpiresIn: 3600,
    TokenType: 'Bearer',
  };
}
function callerOf(req) {
  const token = (req.headers.authorization ?? '').replace(/^Bearer\s+/i, '');
  if (!token) return null;
  try {
    const claims = JSON.parse(Buffer.from(token.split('.')[1], 'base64url').toString());
    const user = db.users.find((u) => u.userId === claims.sub);
    return user ? { userId: user.userId, role: user.role, email: user.email } : null;
  } catch {
    return null;
  }
}
const isAdmin = (c) => c?.role === 'ADMIN';
const isCrew = (c) => c?.role === 'CREW';

// ── Cognito stand-in (only the actions the apps call) ─────────────────────────
const pendingSignUps = new Map();
function cognito(target, body) {
  const err = (type, message) => {
    const e = new HttpError(400, message);
    e.cognitoType = type;
    throw e;
  };
  const byEmail = (email) =>
    db.users.find((u) => u.email.toLowerCase() === String(email ?? '').toLowerCase());
  switch (target) {
    case 'InitiateAuth': {
      if (body.AuthFlow === 'REFRESH_TOKEN_AUTH') {
        const userId = String(body.AuthParameters?.REFRESH_TOKEN ?? '').split('.')[1];
        const user = db.users.find((u) => u.userId === userId);
        if (!user) err('NotAuthorizedException', 'Refresh token is not valid');
        const { RefreshToken: _refresh, ...rest } = tokensFor(user);
        return { AuthenticationResult: rest };
      }
      const user = byEmail(body.AuthParameters?.USERNAME);
      if (!user) err('UserNotFoundException', 'User does not exist.');
      if (!body.AuthParameters?.PASSWORD)
        err('NotAuthorizedException', 'Incorrect username or password.');
      return { AuthenticationResult: tokensFor(user) };
    }
    case 'SignUp': {
      if (byEmail(body.Username))
        err('UsernameExistsException', 'An account with the given email already exists.');
      const attrs = Object.fromEntries((body.UserAttributes ?? []).map((a) => [a.Name, a.Value]));
      pendingSignUps.set(body.Username.toLowerCase(), {
        userId: `u-${randomUUID().slice(0, 8)}`,
        email: body.Username,
        name: attrs.name ?? body.Username.split('@')[0],
        phone: attrs.phone_number ?? '',
        role: 'CITIZEN',
        status: 'active',
      });
      return { UserConfirmed: false, UserSub: randomUUID() };
    }
    case 'ConfirmSignUp': {
      const pending = pendingSignUps.get(String(body.Username).toLowerCase());
      if (!pending) err('UserNotFoundException', 'User does not exist.');
      if (body.ConfirmationCode !== '123456')
        err('CodeMismatchException', 'Preview mode: the code is 123456.');
      db.users.push(pending);
      pendingSignUps.delete(String(body.Username).toLowerCase());
      return {};
    }
    case 'ResendConfirmationCode':
    case 'ForgotPassword':
      return {
        CodeDeliveryDetails: { Destination: 'preview (code 123456)', DeliveryMedium: 'EMAIL' },
      };
    case 'ConfirmForgotPassword':
    case 'GlobalSignOut':
      return {};
    default:
      err('InvalidParameterException', `Preview mode does not support ${target}`);
  }
}

// ── Domain helpers, mirroring the Lambda handlers ─────────────────────────────
const findReport = (id) =>
  db.reports.find((r) => r.reportId === id) ?? fail(404, 'Report not found');
const findTask = (id) => db.tasks.find((t) => t.taskId === id) ?? fail(404, 'Task not found');
const userName = (id) => db.users.find((u) => u.userId === id)?.name;
const fileUrl = (key) => (key ? `${BASE}/__files/${key}` : null);

function notify(userId, type, title, body, extra = {}) {
  db.notifications.unshift({
    notificationId: `n-${randomUUID().slice(0, 8)}`,
    userId,
    type,
    title,
    body,
    taskId: extra.taskId ?? null,
    reportId: extra.reportId ?? null,
    read: false,
    createdAt: now(),
  });
}
const notifyRole = (role, ...args) =>
  db.users.filter((u) => u.role === role).forEach((u) => notify(u.userId, ...args));

function presentReport(r, viewerId) {
  const task = r.assignedTaskId ? db.tasks.find((t) => t.taskId === r.assignedTaskId) : null;
  const { reportId, type, status, ward, address, lat, lng, description, createdAt } = r;
  return {
    reportId,
    type,
    status,
    ward,
    address,
    lat,
    lng,
    description,
    createdAt,
    submitterName:
      userName(r.submittedBy) ?? r.submittedByName ?? r.guestName ?? 'Community member',
    photoUrl: fileUrl(r.photoKey),
    evidencePhotoUrls: (task?.evidencePhotoKeys ?? []).map(fileUrl),
    completedAt: task?.completedAt ?? r.completedAt ?? null,
    likeCount: r.likedBy.length,
    likedByMe: viewerId ? r.likedBy.includes(viewerId) : false,
    comments: r.comments,
  };
}

// Offset-based paging with an opaque token, like DynamoDB's LastEvaluatedKey
function page(items, query, defaultLimit = 50) {
  const limit = Math.min(Math.max(Number(query.get('limit')) || defaultLimit, 1), 500);
  const start = query.get('lastKey')
    ? Number(Buffer.from(query.get('lastKey'), 'base64').toString())
    : 0;
  const slice = items.slice(start, start + limit);
  const next =
    start + limit < items.length ? Buffer.from(String(start + limit)).toString('base64') : null;
  return { slice, nextKey: next };
}
const newestFirst = (a, b) => (a.createdAt < b.createdAt ? 1 : -1);

function haversineKm(aLat, aLng, bLat, bLng) {
  const rad = (d) => (d * Math.PI) / 180;
  const h =
    Math.sin(rad(bLat - aLat) / 2) ** 2 +
    Math.cos(rad(aLat)) * Math.cos(rad(bLat)) * Math.sin(rad(bLng - aLng) / 2) ** 2;
  return 6371 * 2 * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h));
}

function autoAssign(report) {
  const crew = db.users.filter(
    (u) => u.role === 'CREW' && u.status === 'active' && u.locationLat != null,
  );
  const ranked = crew
    .map((c) => ({ c, km: haversineKm(report.lat, report.lng, c.locationLat, c.locationLng) }))
    .sort((a, b) => a.km - b.km);
  if (report.lat == null || !ranked.length || ranked[0].km > MAX_ASSIGN_KM) {
    notifyRole(
      'ADMIN',
      'general',
      'Manual assignment required',
      `Report ${report.reportId} at ${report.address} needs a crew.`,
      { reportId: report.reportId },
    );
    return;
  }
  const { c, km } = ranked[0];
  const task = {
    taskId: `t-${randomUUID().slice(0, 8)}`,
    title: `Clean ${report.type === 'overflow' ? 'overflowing bin' : 'illegal dumping'}`,
    description: report.address,
    reportIds: [report.reportId],
    crewLeadId: c.userId,
    crewIds: [],
    scheduledAt: now(),
    dueAt: new Date(Date.now() + 48 * 3600_000).toISOString(),
    status: 'assigned',
    notes: '',
    evidencePhotoKeys: [],
    createdBy: 'automatic-assignment',
    createdAt: now(),
    updatedAt: now(),
  };
  db.tasks.unshift(task);
  Object.assign(report, { status: 'assigned', assignedTaskId: task.taskId, updatedAt: now() });
  notify(
    c.userId,
    'task_assigned',
    'New task assigned',
    `You have been assigned to a report near ${report.address} (${km.toFixed(1)} km).`,
    { taskId: task.taskId, reportId: report.reportId },
  );
}

async function checkUpload(key, prefix) {
  if (typeof key !== 'string' || !key.startsWith(prefix) || key.includes('..')) {
    fail(400, 'photo key was not issued to this uploader');
  }
  const file = db.uploads.get(key);
  if (!file) fail(400, 'photo not found; upload it first');
  if (file.body.length > MAX_IMAGE_BYTES) fail(400, 'photo is larger than 10 MB');
  if (!IMAGE_TYPES[file.type]) fail(400, 'photo must be JPEG, PNG or WebP');
}

const uploadLink = (prefix, contentType) => {
  const ext = IMAGE_TYPES[contentType ?? 'image/jpeg'];
  if (!ext) fail(400, 'contentType must be image/jpeg, image/png or image/webp');
  const key = `${prefix}${randomUUID()}.${ext}`;
  return { url: `${BASE}/__files/${key}`, key };
};

// ── Routes ────────────────────────────────────────────────────────────────────
const routes = [];
const route = (method, pattern, fn) =>
  routes.push({ method, re: new RegExp(`^${pattern.replace(/\{(\w+)\}/g, '(?<$1>[^/]+)')}$`), fn });

route('GET', '/profile', ({ caller }) => {
  if (!caller) fail(403, 'Forbidden');
  const u = db.users.find((x) => x.userId === caller.userId);
  return { userId: u.userId, email: u.email, name: u.name, phone: u.phone, role: u.role };
});
route('PATCH', '/profile', ({ caller, body }) => {
  if (!caller) fail(403, 'Forbidden');
  const u = db.users.find((x) => x.userId === caller.userId);
  if (typeof body.name === 'string') u.name = body.name.trim().slice(0, 80) || u.name;
  if (typeof body.phone === 'string') u.phone = body.phone.trim();
  return { userId: u.userId, email: u.email, name: u.name, phone: u.phone, role: u.role };
});

function createReport({ caller, body }) {
  const type = { overflow_bin: 'overflow', illegal_dumping: 'dumping' }[body.type] ?? body.type;
  if (!['overflow', 'dumping'].includes(type))
    fail(400, 'type must be overflow_bin or illegal_dumping');
  const lat = body.lat ?? body.latitude ?? null;
  const lng = body.lng ?? body.longitude ?? null;
  if (!body.address && lat == null) fail(400, 'address or location coordinates are required');
  return { caller, type, lat, lng };
}
async function saveReport({ caller, body }) {
  const { type, lat, lng } = createReport({ caller, body });
  if (body.photoKey)
    await checkUpload(body.photoKey, caller ? `reports/${caller.userId}/` : 'guest-uploads/');
  const report = {
    reportId: `r-${randomUUID().slice(0, 8)}`,
    type,
    status: 'pending',
    ...(lat != null ? { ward: `${Number(lat).toFixed(4)},${Number(lng).toFixed(4)}` } : {}),
    address: body.address ?? `${lat},${lng}`,
    lat,
    lng,
    photoKey: body.photoKey ?? null,
    description: body.description ?? '',
    ...(caller ? { submittedBy: caller.userId } : {}),
    submittedByName: caller ? userName(caller.userId) : null,
    guestName: caller ? null : (body.guestName ?? null),
    guestPhone: caller ? null : (body.guestPhone ?? null),
    assignedTaskId: null,
    likedBy: [],
    comments: [],
    createdAt: now(),
    updatedAt: now(),
  };
  db.reports.unshift(report);
  db.users
    .filter((u) => u.role === 'CITIZEN' && u.userId !== caller?.userId)
    .forEach((u) =>
      notify(
        u.userId,
        'report_new',
        'New community report',
        `A ${type === 'overflow' ? 'overflowing bin' : 'illegal dumping'} issue was reported at ${report.address}.`,
        { reportId: report.reportId },
      ),
    );
  autoAssign(report);
  const { likedBy: _likes, comments: _comments, ...stored } = report;
  return [201, { report: stored }];
}
route('POST', '/reports', (ctx) => {
  if (!ctx.caller) fail(403, 'Forbidden');
  return saveReport(ctx);
});
route('POST', '/reports/guest', (ctx) => saveReport({ ...ctx, caller: null }));

function listByStatus(query, viewerId) {
  const status = query.get('status');
  const items = db.reports.filter((r) => !status || r.status === status).sort(newestFirst);
  const { slice, nextKey } = page(items, query);
  return { reports: slice.map((r) => presentReport(r, viewerId)), nextKey };
}
route('GET', '/reports', ({ caller, query }) => {
  if (!caller) fail(403, 'Forbidden');
  if (isAdmin(caller) || isCrew(caller)) {
    const ward = query.get('ward');
    if (ward) {
      const items = db.reports.filter((r) => r.ward === ward).sort(newestFirst);
      const { slice, nextKey } = page(items, query);
      return { reports: slice.map((r) => presentReport(r, caller.userId)), nextKey };
    }
    return listByStatus(query, caller.userId);
  }
  return mine(caller, query);
});
route('GET', '/reports/public', ({ query }) => listByStatus(query));
route('GET', '/reports/public/authenticated', ({ caller, query }) =>
  listByStatus(query, caller?.userId),
);
function mine(caller, query) {
  const items = db.reports.filter((r) => r.submittedBy === caller.userId).sort(newestFirst);
  const { slice, nextKey } = page(items, query, 20);
  return { reports: slice.map((r) => presentReport(r, caller.userId)), nextKey };
}
route('GET', '/reports/mine', ({ caller, query }) => {
  if (!caller) fail(403, 'Authentication required');
  return mine(caller, query);
});
route('GET', '/reports/presigned-upload', ({ caller, query }) => {
  if (!caller) fail(403, 'Forbidden');
  return uploadLink(`reports/${caller.userId}/`, query.get('contentType'));
});
route('GET', '/reports/guest/presigned-upload', ({ query }) =>
  uploadLink('guest-uploads/', query.get('contentType')),
);
route('GET', '/reports/{reportId}', ({ caller, params }) => ({
  report: presentReport(findReport(params.reportId), caller?.userId),
}));
route('DELETE', '/reports/{reportId}', ({ caller, params }) => {
  if (!isAdmin(caller)) fail(403, 'Admin only');
  const r = findReport(params.reportId);
  db.reports = db.reports.filter((x) => x !== r);
  return { reportId: r.reportId, deleted: true, imageDeleted: !!r.photoKey };
});
route('POST', '/reports/{reportId}/like', ({ caller, params }) => {
  if (!caller) fail(403, 'Authentication required');
  const r = findReport(params.reportId);
  const liked = !r.likedBy.includes(caller.userId);
  r.likedBy = liked
    ? [...r.likedBy, caller.userId]
    : r.likedBy.filter((id) => id !== caller.userId);
  return { reportId: r.reportId, liked, likeCount: r.likedBy.length };
});
route('POST', '/reports/{reportId}/comments', ({ caller, params, body }) => {
  if (!caller) fail(403, 'Authentication required');
  const text = typeof body.text === 'string' ? body.text.trim() : '';
  if (!text || text.length > 1000)
    fail(400, 'reportId and a comment of 1-1000 characters are required');
  const r = findReport(params.reportId);
  const comment = {
    commentId: randomUUID(),
    userId: caller.userId,
    name: userName(caller.userId),
    text,
    createdAt: now(),
  };
  r.comments.push(comment);
  return [201, { comment }];
});
route('GET', '/reports/{reportId}/status', ({ params }) => {
  const r = findReport(params.reportId);
  return { reportId: r.reportId, status: r.status, updatedAt: r.updatedAt };
});
route('PATCH', '/reports/{reportId}/status', ({ caller, params, body }) => {
  if (!isAdmin(caller)) fail(403, 'Admin only');
  const allowed = ['pending', 'assigned', 'in_progress', 'resolved'];
  if (!allowed.includes(body.status)) fail(400, `status must be one of: ${allowed.join(', ')}`);
  const r = findReport(params.reportId);
  const wasResolved = r.status === 'resolved';
  Object.assign(r, { status: body.status, updatedAt: now() });
  if (body.status === 'resolved' && !wasResolved) {
    notifyRole(
      'CITIZEN',
      'report_resolved',
      'Report resolved',
      `The waste issue reported at ${r.address} has been resolved.`,
      { reportId: r.reportId },
    );
  }
  return { reportId: r.reportId, status: r.status };
});

// Tasks
const onTask = (t, userId) => t.crewLeadId === userId || t.crewIds.includes(userId);
function setReports(task, from, to) {
  for (const r of db.reports) {
    if (!task.reportIds.includes(r.reportId) || r.assignedTaskId !== task.taskId) continue;
    if (!from.includes(r.status)) continue;
    r.status = to;
    r.updatedAt = now();
    if (to === 'pending') r.assignedTaskId = null;
    if (to === 'resolved') r.completedAt = now();
  }
}
route('POST', '/tasks', ({ caller, body }) => {
  if (!isAdmin(caller)) fail(403, 'Admin only');
  if (!body.title || !body.scheduledAt) fail(400, 'title and scheduledAt are required');
  const scheduled = new Date(body.scheduledAt).getTime();
  const earliestDue = scheduled + 48 * 3600_000;
  const task = {
    taskId: `t-${randomUUID().slice(0, 8)}`,
    title: body.title,
    description: body.description ?? '',
    reportIds: body.reportIds ?? [],
    crewLeadId: body.crewLeadId ?? null,
    crewIds: body.crewIds ?? body.crewMemberIds ?? [],
    scheduledAt: body.scheduledAt,
    dueAt: new Date(Math.max(new Date(body.dueAt ?? 0).getTime(), earliestDue)).toISOString(),
    status: 'assigned',
    notes: body.notes ?? '',
    evidencePhotoKeys: [],
    createdBy: caller.userId,
    createdAt: now(),
    updatedAt: now(),
  };
  db.tasks.unshift(task);
  for (const r of db.reports) {
    if (task.reportIds.includes(r.reportId))
      Object.assign(r, { status: 'assigned', assignedTaskId: task.taskId, updatedAt: now() });
  }
  [...new Set([task.crewLeadId, ...task.crewIds].filter(Boolean))].forEach((id) =>
    notify(id, 'task_assigned', 'New task assigned', `You have been assigned to "${task.title}".`, {
      taskId: task.taskId,
    }),
  );
  return [201, { task }];
});
route('GET', '/tasks', ({ caller, query }) => {
  if (isAdmin(caller)) {
    const status = query.get('status');
    const items = db.tasks.filter((t) => !status || t.status === status);
    const { slice, nextKey } = page(items, query, 500);
    // Like the Lambda handler, total is the size of this page, not of the whole table
    return { tasks: slice, total: slice.length, nextKey };
  }
  if (isCrew(caller)) {
    const tasks = db.tasks.filter((t) => onTask(t, caller.userId));
    return { tasks, total: tasks.length };
  }
  fail(403, 'Only admin or crew can list tasks');
});
route('GET', '/tasks/{taskId}', ({ caller, params }) => {
  if (!caller) fail(403, 'Forbidden');
  const t = findTask(params.taskId);
  if (isCrew(caller) && !onTask(t, caller.userId)) fail(403, 'Not assigned to this task');
  const ids = [...new Set([...t.crewIds, ...(t.crewLeadId ? [t.crewLeadId] : [])])];
  const crewRoster = ids.map((id) => ({
    userId: id,
    name: userName(id) ?? 'Crew member',
    isLead: id === t.crewLeadId,
  }));
  const addresses = t.reportIds
    .map((id) => db.reports.find((r) => r.reportId === id)?.address)
    .filter(Boolean);
  return { task: { ...t, crewRoster, addresses } };
});
route('PATCH', '/tasks/{taskId}', ({ caller, params, body }) => {
  if (!isAdmin(caller)) fail(403, 'Admin only');
  const t = findTask(params.taskId);
  const allowed = [
    'title',
    'description',
    'reportIds',
    'crewIds',
    'crewLeadId',
    'scheduledAt',
    'dueAt',
    'notes',
  ];
  const updated = allowed.filter((k) => k in body);
  if (!updated.length) fail(400, 'No updatable fields provided');
  updated.forEach((k) => (t[k] = body[k]));
  t.updatedAt = now();
  return { taskId: t.taskId, updated };
});
route('DELETE', '/tasks/{taskId}', ({ caller, params }) => {
  if (!isAdmin(caller)) fail(403, 'Admin only');
  const t = findTask(params.taskId);
  setReports(t, ['assigned', 'in_progress'], 'pending');
  db.tasks = db.tasks.filter((x) => x !== t);
  return { taskId: t.taskId, deleted: true };
});
route('PATCH', '/tasks/{taskId}/status', async ({ caller, params, body }) => {
  if (!caller) fail(403, 'Forbidden');
  const t = findTask(params.taskId);
  const { status } = body;
  if (isAdmin(caller)) {
    if (!['scheduled', 'assigned', 'in_progress', 'completed', 'cancelled'].includes(status))
      fail(400, 'status is not valid');
  } else if (isCrew(caller)) {
    if (!['in_progress', 'completed'].includes(status))
      fail(400, 'crew can only set: in_progress, completed');
    if (!onTask(t, caller.userId)) fail(403, 'Not assigned to this task');
    if (status === 'completed' && caller.userId !== t.crewLeadId)
      fail(403, 'Only the crew head can complete the task and submit evidence');
  } else fail(403, 'Forbidden');

  if (status === 'completed' && isCrew(caller)) {
    const keys = Array.isArray(body.evidencePhotoKeys) ? body.evidencePhotoKeys : [];
    if (!keys.length) fail(400, 'At least one evidence photo is required to complete a task');
    for (const key of keys) await checkUpload(key, `evidence/${t.taskId}/`);
    const companions = t.crewIds.filter((id) => id !== t.crewLeadId);
    const marks = new Map((body.companionAttendance ?? []).map((a) => [a.userId, a.present]));
    if (companions.some((id) => !marks.has(id)))
      fail(400, 'Record attendance for every assigned companion');
    t.evidencePhotoKeys = keys;
    t.companionAttendance = companions.map((id) => ({
      userId: id,
      name: userName(id),
      present: marks.get(id),
      markedAt: now(),
    }));
  }
  t.status = status;
  t.updatedAt = now();
  if (status === 'in_progress') setReports(t, ['assigned'], 'in_progress');
  if (status === 'cancelled') setReports(t, ['assigned', 'in_progress'], 'pending');
  if (status === 'completed') {
    t.completedAt = now();
    setReports(t, ['assigned', 'in_progress', 'pending'], 'resolved');
    notifyRole(
      'CITIZEN',
      'report_resolved',
      'Report resolved',
      `The crew completed "${t.title}".`,
      { taskId: t.taskId },
    );
  }
  return { taskId: t.taskId, status };
});
route('GET', '/tasks/{taskId}/evidence-upload', ({ caller, params, query }) => {
  const t = findTask(params.taskId);
  if (['completed', 'cancelled'].includes(t.status))
    fail(403, 'Evidence can only be uploaded while the task is active');
  if (!isCrew(caller) || caller.userId !== t.crewLeadId)
    fail(403, 'Only the crew head can upload task evidence');
  return uploadLink(`evidence/${t.taskId}/`, query.get('contentType'));
});
route('GET', '/tasks/{taskId}/evidence-photos', ({ caller, params }) => {
  const t = findTask(params.taskId);
  if (isCrew(caller) && !onTask(t, caller.userId)) fail(403, 'Not assigned to this task');
  return { photos: t.evidencePhotoKeys.map((key) => ({ key, url: fileUrl(key) })) };
});
route('DELETE', '/tasks/{taskId}/evidence-photos', ({ caller, params, body }) => {
  const t = findTask(params.taskId);
  if (!isAdmin(caller) && caller?.userId !== t.crewLeadId)
    fail(403, 'Only the crew head can manage task evidence');
  t.evidencePhotoKeys = t.evidencePhotoKeys.filter((k) => k !== body.key);
  db.uploads.delete(body.key);
  return { taskId: t.taskId, key: body.key, deleted: true };
});

// Crew
const presentCrew = (u) => ({
  crewId: u.userId,
  cognitoUsername: u.email,
  name: u.name,
  email: u.email,
  phone: u.phone,
  location: u.locationText ?? null,
  locationLat: u.locationLat ?? null,
  locationLng: u.locationLng ?? null,
  status: u.status,
  lastLogin: null,
  activeTasks: db.tasks.filter(
    (t) => onTask(t, u.userId) && ['assigned', 'in_progress'].includes(t.status),
  ).length,
});
route('GET', '/crew', ({ caller }) => {
  if (!isAdmin(caller)) fail(403, 'Admin only');
  const crew = db.users.filter((u) => u.role === 'CREW').map(presentCrew);
  return { crew, total: crew.length };
});
route('POST', '/crew', ({ caller, body }) => {
  if (!isAdmin(caller)) fail(403, 'Admin only');
  if (!body.name || !body.email || !body.temporaryPassword)
    fail(400, 'name, email, and temporaryPassword are required');
  if (!body.location?.trim())
    fail(400, 'A crew location in Buea is required for distance-based assignment');
  const u = {
    userId: `u-${randomUUID().slice(0, 8)}`,
    email: body.email,
    name: body.name,
    phone: body.phone ?? '',
    role: 'CREW',
    status: 'active',
    locationText: body.location.trim(),
    locationLat: body.locationLat ?? 4.1527,
    locationLng: body.locationLng ?? 9.2906,
  };
  db.users.push(u);
  return [201, { crew: presentCrew(u) }];
});
const findCrew = (id) =>
  db.users.find((u) => u.userId === id && u.role === 'CREW') ?? fail(404, 'Crew member not found');
route('GET', '/crew/{userId}', ({ caller, params }) => {
  if (!isAdmin(caller)) fail(403, 'Admin only');
  return { crew: presentCrew(findCrew(params.userId)) };
});
route('PATCH', '/crew/{userId}', ({ caller, params, body }) => {
  if (!isAdmin(caller)) fail(403, 'Admin only');
  const u = findCrew(params.userId);
  if (!body.location?.trim()) fail(400, 'userId and location are required');
  Object.assign(u, {
    locationText: body.location.trim(),
    locationLat: body.locationLat ?? u.locationLat,
    locationLng: body.locationLng ?? u.locationLng,
  });
  return {
    crewId: u.userId,
    location: u.locationText,
    locationLat: u.locationLat,
    locationLng: u.locationLng,
  };
});
route('DELETE', '/crew/{userId}', ({ caller, params }) => {
  if (!isAdmin(caller)) fail(403, 'Admin only');
  findCrew(params.userId).status = 'inactive';
  return { userId: params.userId, status: 'deleted' };
});

// Notifications
const presentNote = (n) => ({ ...n, id: n.notificationId, sentAt: n.createdAt });
route('GET', '/notifications', ({ caller, query }) => {
  if (!caller) fail(403, 'Forbidden');
  const items = db.notifications
    .filter((n) => n.userId === caller.userId && (query.get('unreadOnly') !== 'true' || !n.read))
    .map(presentNote);
  const { slice, nextKey } = page(items, query);
  return { data: slice, notifications: slice, nextKey };
});
route('POST', '/notifications', ({ caller, body }) => {
  if (!isAdmin(caller)) fail(403, 'Admin only');
  if (!body.userId || !body.title || !body.message)
    fail(400, 'userId, title, and message are required');
  notify(body.userId, body.type ?? 'info', body.title, body.message);
  return [201, { notification: presentNote(db.notifications[0]) }];
});
route('POST', '/notifications/send', ({ caller, body }) => {
  if (!isAdmin(caller)) fail(403, 'Admin only');
  if (!body.title || !body.message) fail(400, 'title and message are required');
  const roles = { all_citizens: ['CITIZEN'], all_crew: ['CREW'] }[body.recipients] ?? [
    'CITIZEN',
    'CREW',
    'ADMIN',
  ];
  const users = db.users.filter((u) => roles.includes(u.role));
  users.forEach((u) => notify(u.userId, body.type ?? 'general', body.title, body.message));
  return { sent: users.length, message: `Notification sent to ${users.length} users` };
});
route('POST', '/notifications/read-all', ({ caller }) => {
  if (!caller) fail(403, 'Forbidden');
  const mineUnread = db.notifications.filter((n) => n.userId === caller.userId && !n.read);
  mineUnread.forEach((n) => (n.read = true));
  return { updated: mineUnread.length };
});
route('POST', '/notifications/register-push-token', ({ caller }) => {
  if (!caller) fail(403, 'Forbidden');
  return { registered: true };
});
const findNote = (caller, id) => {
  const n =
    db.notifications.find((x) => x.notificationId === id) ?? fail(404, 'Notification not found');
  if (n.userId !== caller?.userId && !isAdmin(caller)) fail(403, 'Not your notification');
  return n;
};
route('PATCH', '/notifications/{notificationId}/read', ({ caller, params }) => {
  findNote(caller, params.notificationId).read = true;
  return { notificationId: params.notificationId, read: true };
});
route('DELETE', '/notifications/{notificationId}', ({ caller, params }) => {
  const n = findNote(caller, params.notificationId);
  db.notifications = db.notifications.filter((x) => x !== n);
  return { notificationId: params.notificationId, deleted: true };
});

// ── Placeholder photos for the seed data ──────────────────────────────────────
function seedPhoto(n) {
  const palette = [
    ['#2f6f4f', 'Overflowing bin'],
    ['#7a5a3a', 'Dumped waste'],
    ['#3c5a7a', 'Blocked drain'],
    ['#4f6f2f', 'Cleared site'],
  ];
  const [color, label] = palette[(n - 1) % palette.length];
  return `<svg xmlns="http://www.w3.org/2000/svg" width="800" height="600" viewBox="0 0 800 600">
<rect width="800" height="600" fill="${color}"/><rect x="250" y="190" width="300" height="260" rx="24" fill="#ffffff22" stroke="#fff" stroke-width="6"/>
<rect x="230" y="160" width="340" height="40" rx="12" fill="#fff"/>
<text x="400" y="520" font-family="Arial" font-size="40" fill="#fff" text-anchor="middle">${label}</text>
<text x="400" y="570" font-family="Arial" font-size="22" fill="#ffffffaa" text-anchor="middle">Preview sample photo</text></svg>`;
}

// ── Server ────────────────────────────────────────────────────────────────────
export function startPreviewServer() {
  const server = http.createServer(async (req, res) => {
    try {
      const url = new URL(req.url, BASE);
      if (req.method === 'OPTIONS') return send(res, 204, '', 'text/plain');

      // Uploads and stored files (stand-in for S3 presigned URLs)
      if (url.pathname.startsWith('/__files/')) {
        const key = decodeURIComponent(url.pathname.slice('/__files/'.length));
        if (req.method === 'PUT') {
          db.uploads.set(key, { body: await readBody(req), type: req.headers['content-type'] });
          return send(res, 200, '', 'text/plain');
        }
        const seed = key.match(/^__seed\/photo-(\d)\.svg$/);
        if (seed) return send(res, 200, seedPhoto(Number(seed[1])), 'image/svg+xml');
        const file = db.uploads.get(key);
        return file ? send(res, 200, file.body, file.type) : send(res, 404, { error: 'Not found' });
      }
      if (url.pathname === '/__reset' && req.method === 'POST') {
        db = createSeed();
        return send(res, 200, { reset: true });
      }
      if (url.pathname === '/__health') return send(res, 200, { ok: true, preview: true });

      const body = ['POST', 'PATCH', 'PUT', 'DELETE'].includes(req.method)
        ? json(await readBody(req))
        : {};

      if (url.pathname === '/cognito/' || url.pathname === '/cognito') {
        const target = String(req.headers['x-amz-target'] ?? '')
          .split('.')
          .pop();
        try {
          return send(res, 200, cognito(target, body));
        } catch (e) {
          return send(res, e.status ?? 400, {
            __type: e.cognitoType ?? 'InternalErrorException',
            message: e.message,
          });
        }
      }

      const caller = callerOf(req);
      for (const r of routes) {
        if (r.method !== req.method) continue;
        const m = url.pathname.match(r.re);
        if (!m) continue;
        const out = await r.fn({ caller, body, query: url.searchParams, params: m.groups ?? {} });
        const [status, payload] = Array.isArray(out) ? out : [200, out];
        return send(res, status, payload);
      }
      send(res, 404, { error: 'Not found' });
    } catch (e) {
      if (!(e instanceof HttpError)) console.error(e);
      send(res, e.status ?? 500, { error: e.status ? e.message : 'Internal server error' });
    }
  });
  // A second launcher (admin portal and mobile started separately) shares the first
  // one's server, so both apps see the same data.
  server.on('error', (e) => {
    if (e.code === 'EADDRINUSE')
      console.log(`[preview] stand-in already running on ${BASE}; reusing it`);
    else throw e;
  });
  // Bind to this machine only
  server.listen(PORT, '127.0.0.1', () =>
    console.log(`[preview] API and sign-in stand-in on ${BASE}`),
  );
  return server;
}

if (
  process.argv[1] &&
  import.meta.url.endsWith(process.argv[1].replace(/\\/g, '/').split('/').pop())
) {
  startPreviewServer();
}
