# API contract

The agreed shape of the CleanLoop backend, and the first step of the backend redesign
in [ADR 0001](../adr/0001-backend-redesign.md). Change these files in the same pull
request as the code they describe.

| File                                     | What it holds                                                                                      |
| ---------------------------------------- | -------------------------------------------------------------------------------------------------- |
| [openapi.yaml](openapi.yaml)             | Every route (39 today, 3 planned) with its role, request, response and errors                      |
| [access-patterns.md](access-patterns.md) | Every DynamoDB read, the index that serves it, and the indexes that replace the 14 remaining scans |
| [state-machines.md](state-machines.md)   | Report and task lifecycles, today and in the new report flow                                       |

Open `openapi.yaml` in the Swagger Editor or a VS Code OpenAPI preview to browse it.
Each operation's `x-status` says whether it is implemented, exposed without a handler,
or planned.

## The new report flow

The planned routes sit under `/v2/reports` so the current apps keep working while the
new flow is built:

1. `POST /v2/reports` creates the report in `awaiting_media` and returns a tracking code
   and one upload link per photo or video. An `Idempotency-Key` header lets the offline
   queue retry without creating duplicates.
2. The app uploads each file straight to S3.
3. `POST /v2/reports/{id}/submit` checks the files and queues the report for the
   pipeline (moderation, geocoding, duplicate check, image analysis, assignment).
4. `GET /v2/reports/track/{code}` shows anyone the status and its history, without
   personal details.

The old `POST /reports` and `/reports/guest` stay until both apps use the new flow.

## Problems found while writing the contract

| #   | Problem                                                                                                                                  | Effect                                                                 |
| --- | ---------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------- |
| 1   | `GET /reports/{id}/status` has a route but no handler.                                                                                   | The guest "check status" screen always gets 404.                       |
| 2   | `PATCH /reports/{id}` and `GET /tasks/mine` have routes but no handler, and no app calls them.                                           | Dead routes; remove them or build them.                                |
| 3   | The daily reminder looks only for `scheduled` and `in_progress` tasks, but every task starts `assigned` and nothing creates `scheduled`. | Crews never get the 24-hour reminder for a task they have not started. |
| 4   | Starting a task does not move its reports to `in_progress`.                                                                              | Citizens see `assigned` until the report is resolved.                  |
| 5   | Cancelling a task leaves its reports `assigned`.                                                                                         | Those reports are never picked up again.                               |
| 6   | Admin status changes accept any status, and an admin can complete a task with no evidence.                                               | Reports can be resolved with no proof of work.                         |
| 7   | User roles are stored as both `crew` and `CREW` (and `CITIZEN`).                                                                         | Every role lookup checks both spellings; blocks a role index.          |
| 8   | The evidence upload link takes its file extension from the client's `filename` and accepts any content type.                             | A crew lead's upload is not limited to images, unlike report photos.   |
| 9   | Home and Profile count only the reports loaded so far.                                                                                   | Totals stop at the first page (20).                                    |
