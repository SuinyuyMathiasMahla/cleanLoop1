# Report and task state machines

UML state machines for the two lifecycles, as the code behaves today and as the new
report flow needs them. GitHub renders the diagrams. Transition labels read
`trigger [guard] / effect`.

## Report

### Today

```mermaid
stateDiagram-v2
    [*] --> pending: POST /reports or /reports/guest / notify community, ReportCreated
    pending --> assigned: automatic assignment [crew within 25 km] / create task, notify crew
    pending --> assigned: admin creates a task with this report
    assigned --> pending: admin deletes the task
    assigned --> resolved: crew lead completes the task / notify community
    pending --> pending: SLA sweep every minute [no crew in range] / alert admins, once a day
    resolved --> [*]
    note right of assigned
        Admin PATCH /reports/{id}/status can set any status from any status.
        Nothing sets in_progress automatically: it is reachable only by that override.
    end note
```

Problems this shows:

- `in_progress` is never set when the crew starts the task, so citizens see `assigned`
  until the report is resolved.
- The admin override skips every rule, including moving a resolved report back to
  pending without touching its task.
- Cancelling a task (`status = cancelled`) leaves its reports `assigned` forever. Only
  deleting the task returns them to `pending`.

### Target (new report flow)

```mermaid
stateDiagram-v2
    [*] --> awaiting_media: POST /v2/reports / return upload links and tracking code
    awaiting_media --> submitted: POST submit [every file in S3, right type and size] / queue, ReportSubmitted
    awaiting_media --> expired: 24 h without submit / delete uploads

    submitted --> rejected: pipeline, moderation fails / notify reporter
    submitted --> duplicate: pipeline, open report within 50 m in 72 h / link to parent
    submitted --> pending: pipeline, accepted / analyse images, set priority

    pending --> assigned: TaskAssigned (automatic or admin)
    assigned --> in_progress: crew starts the task
    in_progress --> resolved: crew lead completes the task [evidence, attendance] / notify reporter and community
    assigned --> pending: task cancelled or deleted
    in_progress --> pending: task cancelled or deleted
    resolved --> pending: admin reopens [reason given] / new task needed

    rejected --> [*]
    duplicate --> [*]
    expired --> [*]
    resolved --> [*]
```

Rules:

- `submitted` lasts while the processing pipeline runs (moderation, geocoding, duplicate
  check, image analysis). The parent report's priority rises once it has 3 duplicates.
- Only the rows above are allowed. The status endpoint rejects anything else with 409,
  so the admin override becomes "reopen" and "reject" with a reason, not a free choice.
- Report status follows its task: the task service changes the report in the same
  transaction as the task.
- A duplicate keeps its own record and points at the parent with `parentReportId`; its
  reporter is notified when the parent is resolved.
- Every change appends `{status, at, by}` to the report's history, which feeds the public
  tracking page.

## Task

### Today

```mermaid
stateDiagram-v2
    [*] --> assigned: admin POST /tasks, or automatic assignment / notify crew
    assigned --> in_progress: crew on the task
    in_progress --> completed: crew lead [1+ evidence photo, attendance for every companion] / resolve reports, notify community
    assigned --> completed: crew lead [same guards]
    completed --> [*]
    note right of assigned
        Admin PATCH /tasks/{id}/status can set scheduled, assigned, in_progress,
        completed or cancelled from any status, with no evidence.
        DELETE /tasks/{id} removes the task and returns its reports to pending.
    end note
```

Problems this shows:

- Nothing creates a `scheduled` task, but the daily reminder looks only for `scheduled`
  and `in_progress` tasks, so tasks in `assigned` (all of them, at first) never get a
  reminder.
- An admin can complete a task without evidence, which resolves its reports.
- `cancelled` does not release the reports (see Report, today).

### Target

```mermaid
stateDiagram-v2
    [*] --> assigned: TaskAssigned / notify crew (push, SMS if offline)
    assigned --> in_progress: crew starts / report to in_progress
    in_progress --> completed: crew lead [evidence, attendance] / reports to resolved
    assigned --> cancelled: admin [reason] / reports to pending
    in_progress --> cancelled: admin [reason] / reports to pending
    assigned --> assigned: admin reassigns crew / notify old and new crew
    completed --> [*]
    cancelled --> [*]
```

Rules:

- `scheduled` is dropped: `scheduledAt` already says when work is planned, and the
  reminder uses `dueAt`.
- Overdue is a flag, not a state: the SLA watchdog sets `overdueAt` on active tasks past
  `dueAt` and alerts admins once.
- Admins complete a task only through the same evidence rules, or cancel it.
- Deleting a task is kept for mistakes made within a few minutes; afterwards, cancel.
