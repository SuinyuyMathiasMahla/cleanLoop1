// Emails sent to crew about their tasks.
import { SESClient, SendEmailCommand } from '@aws-sdk/client-ses';

const ses = new SESClient({});
const SES_FROM_EMAIL = process.env.SES_FROM_EMAIL!;

type Task = Record<string, any>;

function escapeHtml(value: unknown): string {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

async function send(to: string, subject: string, html: string, text?: string) {
  await ses.send(
    new SendEmailCommand({
      Source: SES_FROM_EMAIL,
      Destination: { ToAddresses: [to] },
      Message: {
        Subject: { Data: subject },
        Body: { Html: { Data: html }, ...(text ? { Text: { Data: text } } : {}) },
      },
    }),
  );
}

/** Best effort: a failed email is logged and never fails the assignment. */
export async function sendTaskAssignmentEmail(to: string, name: unknown, task: Task) {
  const row = (label: string, value: unknown) =>
    `<tr><td style="padding:4px 8px;font-weight:bold">${label}</td><td>${escapeHtml(value)}</td></tr>`;
  await send(
    to,
    `CleanLoop Task Assignment: ${task.title}`,
    `
      <h2>You've been assigned a task</h2>
      <p>Hi ${escapeHtml(name)},</p>
      <p>You have been assigned to the following CleanLoop task:</p>
      <table style="border-collapse:collapse">
        ${row('Title', task.title)}
        ${row('Description', task.description || '-')}
        ${row('Scheduled', task.scheduledAt)}
        ${row('Due', task.dueAt ?? '-')}
        ${row('Status', task.status)}
      </table>
      <p>Please log in to the CleanLoop app to view full details.</p>
      <p>The CleanLoop Team</p>
    `,
  ).catch((e) => console.error('SES send error:', e));
}

export async function sendDueReminderEmail(to: string, name: unknown, task: Task) {
  const dueDate = new Date(task.dueAt).toLocaleString('en-US', {
    weekday: 'short',
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    timeZone: 'UTC',
  });
  const cell = 'padding:8px 12px;border:1px solid #ddd';
  const label = `${cell};font-weight:bold`;
  await send(
    to,
    `Reminder: Task "${task.title}" is due soon`,
    `
      <h2>Task Reminder</h2>
      <p>Hi ${escapeHtml(name || 'Crew Member')},</p>
      <p>This is a reminder that the following CleanLoop task is due soon:</p>
      <table style="border-collapse:collapse;margin:16px 0">
        <tr style="background:#f5f5f5"><td style="${label}">Task</td><td style="${cell}">${escapeHtml(task.title)}</td></tr>
        <tr><td style="${label}">Description</td><td style="${cell}">${escapeHtml(task.description || '-')}</td></tr>
        <tr style="background:#f5f5f5"><td style="${label}">Due</td><td style="${cell};color:#d32f2f;font-weight:bold">${dueDate} UTC</td></tr>
        <tr><td style="${label}">Status</td><td style="${cell}">${escapeHtml(task.status)}</td></tr>
      </table>
      <p>Please log in to the CleanLoop app to view details and update your status.</p>
      <p style="color:#666;font-size:12px">This reminder was sent automatically by CleanLoop.</p>
      <p>The CleanLoop Team</p>
    `,
    `Reminder: Task "${task.title}" is due ${dueDate} UTC.\n\nStatus: ${task.status}\n\nLog in to CleanLoop for details.`,
  );
  console.log(`Reminder sent for task ${task.taskId}`);
}
