import { dbPut, dbScan } from './dynamo';

export interface NotificationRecipient {
  userId?: string;
  expoPushToken?: string;
}

export interface NotificationDetails {
  type: string;
  title: string;
  body: string;
  reportId?: string;
  taskId?: string;
}

const EXPO_PUSH_URL = 'https://exp.host/--/api/v2/push/send';

export async function notifyUsers(
  notificationsTable: string,
  recipients: NotificationRecipient[],
  details: NotificationDetails,
): Promise<void> {
  const now = new Date().toISOString();
  const targets = recipients.filter(
    (recipient): recipient is NotificationRecipient & { userId: string } => !!recipient.userId,
  );
  const writes = await Promise.allSettled(
    targets.map((recipient) =>
      dbPut({
        TableName: notificationsTable,
        Item: {
          notificationId: crypto.randomUUID(),
          userId: recipient.userId,
          ...details,
          reportId: details.reportId ?? null,
          taskId: details.taskId ?? null,
          read: false,
          createdAt: now,
        },
      }),
    ),
  );

  const pushTargets: NotificationRecipient[] = [];
  writes.forEach((result, index) => {
    if (result.status === 'fulfilled') {
      if (targets[index].expoPushToken) pushTargets.push(targets[index]);
    } else {
      console.error(
        `Failed to store ${details.type} notification for ${targets[index].userId}:`,
        result.reason,
      );
    }
  });

  const messages = pushTargets.map((recipient) => ({
    to: recipient.expoPushToken,
    title: details.title,
    body: details.body,
    sound: 'default',
    channelId: 'default',
    data: {
      type: details.type,
      ...(details.reportId ? { reportId: details.reportId } : {}),
      ...(details.taskId ? { taskId: details.taskId } : {}),
    },
  }));

  for (let offset = 0; offset < messages.length; offset += 100) {
    const batch = messages.slice(offset, offset + 100);
    try {
      const response = await fetch(EXPO_PUSH_URL, {
        method: 'POST',
        headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
        body: JSON.stringify(batch),
        signal: AbortSignal.timeout(6000),
      });
      if (!response.ok) {
        console.error(`Expo push request failed with status ${response.status}`);
        continue;
      }

      const result = (await response.json()) as {
        data?: Array<{ status?: string; message?: string; details?: { error?: string } }>;
      };
      result.data?.forEach((ticket, index) => {
        if (ticket.status === 'error') {
          console.error(
            'Expo push delivery failed:',
            ticket.message ?? ticket.details?.error ?? `ticket ${index}`,
          );
        }
      });
    } catch (error) {
      console.error('Expo push request failed:', error);
    }
  }
}

export async function notifyCitizenCommunity(
  usersTable: string,
  notificationsTable: string,
  details: NotificationDetails,
  excludedUserId?: string,
): Promise<void> {
  let lastKey: Record<string, unknown> | undefined;
  do {
    const result = await dbScan({
      TableName: usersTable,
      FilterExpression: '#r IN (:citizen, :citizenUpper) OR #ut IN (:citizen, :citizenUpper)',
      ExpressionAttributeNames: { '#r': 'role', '#ut': 'userType' },
      ExpressionAttributeValues: { ':citizen': 'citizen', ':citizenUpper': 'CITIZEN' },
      Limit: 100,
      ...(lastKey ? { ExclusiveStartKey: lastKey } : {}),
    });

    await notifyUsers(
      notificationsTable,
      result.items.filter((user) => user.userId && user.userId !== excludedUserId),
      details,
    );
    lastKey = result.lastKey as Record<string, unknown> | undefined;
  } while (lastKey);
}
