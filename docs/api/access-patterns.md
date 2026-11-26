# Data access patterns

Every read and write the backend makes, the index that serves it, and the index that
should replace each table scan. Written from the handlers on main (November 2026).

A scan reads every item in the table and is billed for all of them, even when a filter
keeps only a few. It also applies `Limit` before the filter, so a page can come back
short or empty while matching items exist. A query reads only the items under one key.

## Tables today

| Table              | Key                | Indexes (partition key, sort key)                                                                                     |
| ------------------ | ------------------ | --------------------------------------------------------------------------------------------------------------------- |
| ReportsTable       | `reportId`         | StatusIndex (`status`, `createdAt`), SubmitterIndex (`submittedBy`, `createdAt`), LocationIndex (`ward`, `createdAt`) |
| UsersTable         | `userId`           | EmailIndex (`email`), RoleIndex (`role`)                                                                              |
| TasksTable         | `taskId`           | StatusIndex (`status`, `scheduledAt`), CrewIndex (`crewLeadId`, `scheduledAt`), DueIndex (`status`, `dueAt`)          |
| TaskAssignments    | `taskId`, `userId` | MemberIndex (`userId`, `scheduledAt`), keys only                                                                      |
| NotificationsTable | `notificationId`   | UserIndex (`userId`, `createdAt`)                                                                                     |

## Access patterns

Status: **Query** or **Get** already efficient; **Scan** to replace.

### Reports

| #   | Pattern                                   | Used by                                    | Today                                 | Target                                                      |
| --- | ----------------------------------------- | ------------------------------------------ | ------------------------------------- | ----------------------------------------------------------- |
| R1  | Get a report by ID                        | `GET /reports/{id}`, like, comment, status | Get                                   | Get                                                         |
| R2  | A citizen's reports, newest first         | `/reports/mine`, citizen `GET /reports`    | Query SubmitterIndex                  | Query SubmitterIndex                                        |
| R3  | Reports in one status, newest first       | Public feed and admin list with `status`   | Query StatusIndex                     | Query StatusIndex                                           |
| R4  | Pending reports, oldest first             | SLA sweep every minute                     | Query StatusIndex                     | Query StatusIndex                                           |
| R5  | Reports in one ward                       | Admin list with `ward`                     | Query LocationIndex                   | Query LocationIndex                                         |
| R6  | All reports, newest first                 | Admin list with no filter                  | **Scan** `reports:458`                | Query FeedIndex (`feed`, `createdAt`)                       |
| R7  | Public feed with no status filter         | `/reports/public` without `status`         | **Scan** `reports:492`, `reports:561` | Query FeedIndex                                             |
| R8  | Open reports within 50 m in the last 72 h | Duplicate check in the new pipeline        | Not built                             | Query GeohashIndex (`geohash6`, `createdAt`), then distance |
| R9  | Report by tracking code                   | `/v2/reports/track/{code}` (planned)       | Not built                             | Query TrackingIndex (`trackingCode`)                        |
| R10 | Report totals per status for one citizen  | Home and Profile counters                  | Counts the loaded page only           | Counters on the user item, updated on each status change    |

### Users

| #   | Pattern                     | Used by                              | Today                                                                             | Target                                                                   |
| --- | --------------------------- | ------------------------------------ | --------------------------------------------------------------------------------- | ------------------------------------------------------------------------ |
| U1  | Get a user by ID            | Profile, names on reports, roster    | Get                                                                               | Get                                                                      |
| U2  | Find a user by email        | Sign-up triggers                     | Query EmailIndex                                                                  | Query EmailIndex                                                         |
| U3  | Active crew with a location | Automatic assignment                 | **Scan** `reports:103`                                                            | Query RoleIndex (`role`, `status`) with `role = CREW`, `status = active` |
| U4  | All crew profiles           | `GET /crew`                          | **Scan** `crew:251`                                                               | Query RoleIndex                                                          |
| U5  | All admins                  | Manual-assignment and overdue alerts | **Scan** `reports:229`; Query RoleIndex in the overdue alert                      | Query RoleIndex                                                          |
| U6  | All citizens (and crew)     | Community notifications, broadcasts  | **Scan** `notifications:144`; Query RoleIndex in `shared/notifications` and tasks | Query RoleIndex per role; later an Expo push topic per area              |

### Tasks

| #   | Pattern                                | Used by                       | Today                                  | Target                                                            |
| --- | -------------------------------------- | ----------------------------- | -------------------------------------- | ----------------------------------------------------------------- |
| T1  | Get a task by ID                       | Task detail, status, evidence | Get                                    | Get                                                               |
| T2  | Tasks in one status                    | Admin list with `status`      | Query StatusIndex                      | Query StatusIndex                                                 |
| T3  | All tasks                              | Admin list with no filter     | Query StatusIndex, each status in turn | Query StatusIndex, each status in turn                            |
| T4  | Tasks a crew member leads              | Crew task list                | Query CrewIndex and MemberIndex        | Query MemberIndex on TaskAssignments                              |
| T5  | Tasks a crew member belongs to         | Crew task list                | Query MemberIndex, then BatchGet       | Query MemberIndex on TaskAssignments                              |
| T6  | Active tasks due in the next 24 h      | Reminder email every 30 min   | Query DueIndex per active status       | Query DueIndex (`status`, `dueAt`) once per active status         |
| T7  | Active tasks past due, not yet alerted | Overdue alert                 | Query DueIndex per active status       | Query DueIndex, filter `attribute_not_exists(overdueAlertSentAt)` |

### Notifications

| #   | Pattern                              | Used by                        | Today           | Target          |
| --- | ------------------------------------ | ------------------------------ | --------------- | --------------- |
| N1  | A user's notifications, newest first | `GET /notifications`, read-all | Query UserIndex | Query UserIndex |
| N2  | Get, mark read, delete one           | `/notifications/{id}`          | Get, Update     | Get, Update     |

## Index changes

Fourteen scans remained on main when this table was written (ADR 0001 counted 24).
The tasks domain (SCRUM-60) removed six of them; the changes below remove the rest:

| Change                                                                                                           | Serves   | Notes                                                                                                                                                                                                                                                                                                                                                                                   |
| ---------------------------------------------------------------------------------------------------------------- | -------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| ReportsTable **FeedIndex** (`feed`, `createdAt`)                                                                 | R6, R7   | Every report stores `feed = "REPORT"`. One partition is fine at pilot volume (well under 1,000 writes a second); split by month if it grows.                                                                                                                                                                                                                                            |
| ReportsTable **GeohashIndex** (`geohash6`, `createdAt`)                                                          | R8       | A 6-character geohash cell is about 1.2 km by 0.6 km. Query the cell and its 8 neighbours for the last 72 h, then keep reports within 50 m.                                                                                                                                                                                                                                             |
| ReportsTable **TrackingIndex** (`trackingCode`), keys only                                                       | R9       | Short code shown to guests instead of the UUID.                                                                                                                                                                                                                                                                                                                                         |
| UsersTable **RoleIndex** (`role`), added in SCRUM-60                                                             | U3 to U6 | Keyed on `role` alone: citizens and admins are stored without `status`, and a missing sort key would leave them out of the index. U3 filters on `status` (about 50 crew). The auth trigger writes `CITIZEN` and the crew handler writes `crew`, so callers query both spellings until roles are stored upper case and migrated.                                                         |
| New **TaskAssignments** table (`taskId`, `userId`), **MemberIndex** (`userId`, `scheduledAt`), added in SCRUM-60 | T4, T5   | One item per crew member on a task, written with the task in a transaction. Replaces the `contains(crewIds)` scan. Automatic assignment (reports) still writes tasks without assignment items, so the crew list also queries CrewIndex until reports creates tasks through the tasks service. Existing tasks need `backend/scripts/backfill-task-assignments.ts` run once after deploy. |
| ~~TasksTable FeedIndex~~                                                                                         | T3       | Dropped: the admin list walks StatusIndex one status at a time (five statuses). That saves an index and keeps TasksTable to one new index per deploy.                                                                                                                                                                                                                                   |
| TasksTable **DueIndex** (`status`, `dueAt`), added in SCRUM-60                                                   | T6, T7   | Could replace StatusIndex later; StatusIndex still serves T2 and T3.                                                                                                                                                                                                                                                                                                                    |
| User item **report counters** (`reportCounts.pending`, and so on)                                                | R10      | Updated with `ADD` when a report is created or changes status.                                                                                                                                                                                                                                                                                                                          |

DynamoDB allows one new index per table per update, and each backfills before the next.
Roll them out one per deploy: RoleIndex and DueIndex (on different tables) went out
together with SCRUM-60; the report indexes follow with the new pipeline.

## Rules for new code

- No `Scan` in request paths. A scan is acceptable only in a one-off migration script.
- Every list endpoint returns `nextKey` and accepts `lastKey`.
- Index key attributes are left out of an item when unknown. Never write `null` to
  them: DynamoDB rejects the write.
- Data access lives in each domain's `repository.ts` (ADR 0001, section 3), so the
  handlers never build DynamoDB requests themselves.
