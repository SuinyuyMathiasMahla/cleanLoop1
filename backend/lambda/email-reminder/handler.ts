// Scheduled every 30 minutes: 24-hour due reminders and overdue alerts for tasks. The use
// cases live in the tasks domain (tasks/service.ts) and read the DueIndex, not a scan.
import { ScheduledEvent } from 'aws-lambda';
import { sendDueReminders, sendOverdueAlerts } from '../tasks/service';

export async function handler(_event: ScheduledEvent): Promise<void> {
  const now = new Date();
  console.log('Email reminder job started:', now.toISOString());

  const reminded = await sendDueReminders(now);
  console.log(`Sent reminders for ${reminded} tasks due within 24h`);

  const overdue = await sendOverdueAlerts(now);
  console.log(`Sent overdue alerts for ${overdue} tasks`);
}
