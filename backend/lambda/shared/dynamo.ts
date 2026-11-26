import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import {
  DynamoDBDocumentClient,
  GetCommand,
  PutCommand,
  UpdateCommand,
  DeleteCommand,
  QueryCommand,
  ScanCommand,
  BatchGetCommand,
  TransactWriteCommand,
  GetCommandInput,
  PutCommandInput,
  UpdateCommandInput,
  DeleteCommandInput,
  QueryCommandInput,
  ScanCommandInput,
  TransactWriteCommandInput,
} from '@aws-sdk/lib-dynamodb';

const client = new DynamoDBClient({});
export const ddb = DynamoDBDocumentClient.from(client, {
  marshallOptions: { removeUndefinedValues: true },
});

export async function dbGet(params: GetCommandInput) {
  const result = await ddb.send(new GetCommand(params));
  return result.Item;
}

export async function dbPut(params: PutCommandInput) {
  return ddb.send(new PutCommand(params));
}

export async function dbUpdate(params: UpdateCommandInput) {
  return ddb.send(new UpdateCommand(params));
}

export async function dbDelete(params: DeleteCommandInput) {
  return ddb.send(new DeleteCommand(params));
}

export async function dbQuery(params: QueryCommandInput) {
  const result = await ddb.send(new QueryCommand(params));
  return { items: result.Items ?? [], lastKey: result.LastEvaluatedKey };
}

export async function dbScan(params: ScanCommandInput) {
  const result = await ddb.send(new ScanCommand(params));
  return { items: result.Items ?? [], lastKey: result.LastEvaluatedKey };
}

export async function dbTransactWrite(params: TransactWriteCommandInput) {
  return ddb.send(new TransactWriteCommand(params));
}

/** Reads items by key, 100 per request, retrying keys DynamoDB leaves unprocessed. */
export async function dbBatchGet(
  tableName: string,
  keys: Record<string, unknown>[],
): Promise<Record<string, unknown>[]> {
  const items: Record<string, unknown>[] = [];
  for (let offset = 0; offset < keys.length; offset += 100) {
    let pending: Record<string, unknown>[] | undefined = keys.slice(offset, offset + 100);
    for (let attempt = 0; pending && pending.length > 0 && attempt < 5; attempt += 1) {
      const result = await ddb.send(
        new BatchGetCommand({ RequestItems: { [tableName]: { Keys: pending } } }),
      );
      items.push(...((result.Responses?.[tableName] as Record<string, unknown>[]) ?? []));
      pending = result.UnprocessedKeys?.[tableName]?.Keys as Record<string, unknown>[] | undefined;
    }
  }
  return items;
}
