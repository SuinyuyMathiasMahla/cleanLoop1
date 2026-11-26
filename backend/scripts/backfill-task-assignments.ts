// One-off migration (SCRUM-60): writes a TaskAssignments item for every crew member on
// every existing task, so crew task lists find tasks created before the table existed.
// A scan is acceptable here because this runs once, by hand, outside any request.
//
// Usage, after deploying the storage stack, with AWS credentials for the account:
//   pnpm tsx scripts/backfill-task-assignments.ts dev            (dry run: counts only)
//   pnpm tsx scripts/backfill-task-assignments.ts dev --write    (writes the items)
// Safe to run twice: each item is keyed on taskId and userId, so a rerun overwrites it.
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import {
  BatchWriteCommand,
  DynamoDBDocumentClient,
  ScanCommand,
  ScanCommandOutput,
} from '@aws-sdk/lib-dynamodb';

const stage = process.argv[2];
const shouldWrite = process.argv.includes('--write');
if (!stage || stage.startsWith('--')) {
  console.error('Usage: pnpm tsx scripts/backfill-task-assignments.ts <stage> [--write]');
  process.exit(1);
}

const tasksTable = `cleanloop-tasks-${stage}`;
const assignmentsTable = `cleanloop-task-assignments-${stage}`;
const ddb = DynamoDBDocumentClient.from(new DynamoDBClient({}));

async function writeAll(items: Record<string, unknown>[]) {
  for (let offset = 0; offset < items.length; offset += 25) {
    let pending = items.slice(offset, offset + 25).map((Item) => ({ PutRequest: { Item } }));
    for (let attempt = 0; pending.length > 0 && attempt < 5; attempt += 1) {
      const result = await ddb.send(
        new BatchWriteCommand({ RequestItems: { [assignmentsTable]: pending } }),
      );
      pending = (result.UnprocessedItems?.[assignmentsTable] ?? []) as typeof pending;
    }
    if (pending.length > 0) throw new Error(`${pending.length} items were not written`);
  }
}

async function main() {
  let tasks = 0;
  let assignments = 0;
  let lastKey: ScanCommandOutput['LastEvaluatedKey'];
  do {
    const page: ScanCommandOutput = await ddb.send(
      new ScanCommand({
        TableName: tasksTable,
        ProjectionExpression: 'taskId, crewLeadId, crewIds, scheduledAt',
        ...(lastKey ? { ExclusiveStartKey: lastKey } : {}),
      }),
    );
    const items: Record<string, unknown>[] = [];
    for (const task of page.Items ?? []) {
      if (!task.scheduledAt) {
        console.warn(`Task ${task.taskId} has no scheduledAt; skipped`);
        continue;
      }
      const lead = task.crewLeadId as string | undefined;
      const members = [
        ...new Set([...(lead ? [lead] : []), ...((task.crewIds as string[]) ?? [])]),
      ];
      for (const userId of members) {
        items.push({
          taskId: task.taskId,
          userId,
          role: userId === lead ? 'lead' : 'companion',
          scheduledAt: task.scheduledAt,
        });
      }
      tasks += 1;
    }
    assignments += items.length;
    if (shouldWrite) await writeAll(items);
    lastKey = page.LastEvaluatedKey;
  } while (lastKey);

  console.log(
    `${shouldWrite ? 'Wrote' : 'Would write'} ${assignments} assignments for ${tasks} tasks ` +
      `into ${assignmentsTable}`,
  );
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
