// HTTP layer for /tasks: routing, reading the request and shaping the response. The use
// cases live in service.ts.
import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { created, err, forbidden, ok, serverError } from '../shared/response';
import { getCaller, isAdmin, isCrew } from '../shared/auth';
import * as service from './service';

function callerOf(event: APIGatewayProxyEvent): service.Caller | null {
  const caller = getCaller(event);
  if (!caller) return null;
  return {
    userId: caller.userId,
    actor: isAdmin(caller) ? 'admin' : isCrew(caller) ? 'crew' : 'other',
  };
}

function bodyOf(event: APIGatewayProxyEvent): Record<string, any> {
  const body = JSON.parse(event.body ?? '{}');
  return body && typeof body === 'object' && !Array.isArray(body) ? body : {};
}

type Route = (
  caller: service.Caller,
  event: APIGatewayProxyEvent,
  taskId: string | undefined,
) => Promise<APIGatewayProxyResult>;

const routes: Record<string, Route> = {
  'POST /tasks': async (caller, event) => created(await service.createTask(caller, bodyOf(event))),
  'GET /tasks': async (caller, event) =>
    ok(await service.listTasks(caller, event.queryStringParameters ?? {})),
  'GET /tasks/{taskId}': async (caller, _event, taskId) =>
    ok(await service.getTask(caller, taskId)),
  'PATCH /tasks/{taskId}': async (caller, event, taskId) =>
    ok(await service.updateTask(caller, taskId, bodyOf(event))),
  'DELETE /tasks/{taskId}': async (caller, _event, taskId) =>
    ok(await service.deleteTask(caller, taskId)),
  'PATCH /tasks/{taskId}/status': async (caller, event, taskId) =>
    ok(await service.setTaskStatus(caller, taskId, bodyOf(event))),
  'GET /tasks/{taskId}/evidence-upload': async (caller, event, taskId) =>
    ok(
      await service.getEvidenceUploadUrl(
        caller,
        taskId,
        event.queryStringParameters?.contentType ?? undefined,
      ),
    ),
  'GET /tasks/{taskId}/evidence-photos': async (caller, _event, taskId) =>
    ok(await service.listEvidencePhotos(caller, taskId)),
  'DELETE /tasks/{taskId}/evidence-photos': async (caller, event, taskId) =>
    ok(await service.deleteEvidencePhoto(caller, taskId, bodyOf(event).key)),
};

export async function handler(event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> {
  const { httpMethod, resource } = event;
  console.log(`${httpMethod} ${resource}`);
  const route = routes[`${httpMethod} ${resource}`];
  if (!route) return err(404, 'Not found');

  const caller = callerOf(event);
  if (!caller) return forbidden();
  try {
    return await route(caller, event, event.pathParameters?.taskId);
  } catch (e) {
    if (e instanceof service.ServiceError) return err(e.status, e.message);
    if (e instanceof SyntaxError) return err(400, 'The request body is not valid JSON');
    console.error('Unhandled error:', e);
    return serverError();
  }
}
