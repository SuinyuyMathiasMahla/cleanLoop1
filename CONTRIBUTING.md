# Contributing to CleanLoop

This file is the team's agreed standard for naming, code style, Git workflow and
diagrams. If something here and the code disagree, fix the code or open a pull
request that changes this file; do not leave the two out of step.

## 1. Repository layout

```
backend/        AWS CDK app and Lambda functions (TypeScript)
  bin/          CDK entry point
  lib/stacks/   one file per stack: <name>-stack.ts
  lambda/       one folder per function: <function-name>/handler.ts
  lambda/shared/ code shared by several functions
frontend/
  mobile/       Expo app for citizens and crews
  web/          Vite admin portal
ai/             AI Intelligence Module (Python, from Release 2)
docs/
  srs/          requirement specifications, newest version wins
  diagrams/     exported diagrams (PNG) and their sources
  adr/          architecture decision records
  presentations/
  meetings/     sprint reviews and retrospectives
```

Each of `backend/`, `frontend/mobile/` and `frontend/web/` is its own pnpm project with
its own `pnpm-lock.yaml`. The root `package.json` holds only the shared tooling
(Prettier and ESLint) that checks all three.

If your editor or a terminal still shows `Backend/` after pulling the lowercase rename,
close it and reopen the folder; Windows keeps the old case in open handles.

## 2. Naming conventions

### Files and folders

| What                     | Convention                                     | Example                               |
| ------------------------ | ---------------------------------------------- | ------------------------------------- |
| Folders                  | kebab-case                                     | `email-reminder/`, `evidence-photos/` |
| React components         | PascalCase `.tsx`, one component per file      | `ReportCard.tsx`                      |
| React hooks              | camelCase starting with `use`                  | `useNotificationSync.ts`              |
| Other TypeScript modules | camelCase                                      | `authStore.ts`, `format.ts`           |
| Expo Router screens      | kebab-case (the router turns them into URLs)   | `my-reports.tsx`, `[id].tsx`          |
| Lambda functions         | kebab-case folder, entry file `handler.ts`     | `lambda/reports/handler.ts`           |
| CDK stacks               | kebab-case file ending in `-stack.ts`          | `api-stack.ts`                        |
| Tests                    | same name as the file under test, plus `.test` | `duplicates.test.ts`                  |
| Python modules           | snake_case                                     | `vision_worker.py`                    |
| Documents                | lowercase kebab-case, version suffix `-vN`     | `cleanloop-srs-v2-final.pdf`          |
| Diagrams                 | `<subject>-<diagram-type>-vN.png`              | `report-submission-activity-v3.png`   |
| Decision records         | `NNNN-short-title.md`, numbered in order       | `0003-region-us-east-1.md`            |
| Meeting notes            | `YYYY-MM-DD-<event>.md`                        | `2026-12-05-sprint-1-review.md`       |

No spaces, capitals or underscores in file names except where a tool requires them
(React components, Python modules, `README.md`, `CONTRIBUTING.md`).

### In code

| What                                                   | Convention                                    | Example                               |
| ------------------------------------------------------ | --------------------------------------------- | ------------------------------------- |
| Variables, functions                                   | camelCase                                     | `findDuplicateReports()`              |
| Booleans                                               | camelCase with `is`, `has`, `can` or `should` | `isOffline`, `hasEvidence`            |
| Types, interfaces, classes, components, CDK constructs | PascalCase, no `I` prefix                     | `Report`, `ApiStack`                  |
| Constants that never change, environment variables     | UPPER_SNAKE_CASE                              | `DUPLICATE_RADIUS_M`, `REPORTS_TABLE` |
| Enum members and status values                         | UPPER_SNAKE_CASE strings                      | `'AWAITING_MEDIA'`, `'ASSIGNED'`      |
| Units                                                  | in the name                                   | `radiusM`, `timeoutMs`, `slaHours`    |
| Python functions and variables                         | snake_case                                    | `assess_quality()`                    |

### Cloud resources and data

| What                | Convention                      | Example                           |
| ------------------- | ------------------------------- | --------------------------------- |
| AWS resource names  | `cleanloop-<component>-<stage>` | `cleanloop-reports-dev`           |
| CDK construct IDs   | PascalCase                      | `ReportsTable`                    |
| DynamoDB attributes | camelCase                       | `createdAt`, `crewGroupId`        |
| DynamoDB indexes    | `by<Key>`                       | `byGeohash`, `byCrewGroupStatus`  |
| Events on the bus   | PascalCase past tense           | `ReportSubmitted`, `TaskAssigned` |
| Stages              | `dev`, `staging`, `prod`        |                                   |

### API

- REST paths: plural nouns, kebab-case, IDs in braces: `/reports/{reportId}/evidence-photos`.
- Verbs only for actions that are not plain create, read, update or delete: `POST /reports/{reportId}/submit`.
- JSON bodies and query parameters in camelCase.
- Times in ISO 8601 UTC (`2026-11-25T14:00:00Z`); the apps convert to Africa/Douala for display.
- Errors always use one shape: `{ "error": { "code": "REPORT_NOT_FOUND", "message": "..." } }`.
- The contract lives in `docs/api/openapi.yaml` and is updated in the same pull request as the code.

### Text shown to users

- Every string goes through the translation files, French and English, never hard-coded.
- Keys are dot.case by screen: `report.submit.button`, `task.checkIn.tooFar`.

## 3. Coding conventions

### TypeScript (backend and apps)

- `strict: true` in every `tsconfig.json`; no `any` (use `unknown` and narrow it).
- Formatting by Prettier: 2-space indent, single quotes, semicolons, trailing commas, 100-character lines.
- Linting by ESLint with `typescript-eslint` recommended rules; CI fails on errors.
- Named exports, except where the framework needs a default export (Expo Router screens).
- `async`/`await`, never `.then()` chains; no floating promises.
- Validate every request body at the API edge with a schema (zod), then trust the types inside.
- Business rules (duplicate radius, SLA hours, priority mapping) are pure functions in their own
  module, with unit tests and no AWS calls inside, so they can be tested without the cloud.
- Lambda logs are structured JSON with a `correlationId` on every line; no stray `console.log`.
- No secrets, account IDs or environment-specific names in code: read them from environment variables
  set by CDK, and keep keys in Secrets Manager.
- Comments say why, not what.

### Python (AI Intelligence Module)

- PEP 8, enforced by `ruff check` and `ruff format`.
- Type hints on every public function; checked with `mypy` in CI.
- Tests with `pytest`; models and thresholds come from configuration, never literals in code.

### Tests

- Unit tests for every business rule in the acceptance criteria (the BR thresholds).
- A test file sits next to the code it tests.
- CI runs lint, type-check, unit tests and `cdk synth` on every pull request.

## 4. Git workflow

- `main` is always deployable. Nobody pushes to it directly; changes arrive by pull request.
- One short-lived branch per Jira story: `feat/CL-12-duplicate-check`, `fix/CL-31-sms-language`.
- Commit messages: `type(scope): what changed`, lowercase, present tense, no trailing period, Jira key at
  the end. Types: `feat`, `fix`, `refactor`, `test`, `docs`, `style`, `chore`, `ci`, `infra`.
  Example: `feat(reports): link duplicate reports within 50 m and 72 h (CL-12)`.
- One logical change per commit; the pull request title matches its main commit.
- Every pull request is reviewed by one other team member and has green CI before merge.
- Never commit build output (`dist/`), `cdk-outputs.json`, `.env` files or credentials.

## 5. Diagram standards

| Diagram                       | Standard                                                                                                                                                                        |
| ----------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Use case                      | UML 2.5: actors outside the system boundary, «include» and «extend» as dashed arrows, generalisation with a hollow triangle                                                     |
| Activity                      | UML 2.5: initial and final nodes, hollow decision and merge diamonds with [guards], fork and join bars, partitions per actor, send and accept signals for asynchronous messages |
| Sequence                      | UML 2.5: lifelines, solid arrows for calls, dashed for returns, `alt` and `loop` fragments                                                                                      |
| State                         | UML 2.5 state machine for report and task lifecycles                                                                                                                            |
| System context and containers | C4 model, levels 1 and 2                                                                                                                                                        |
| Cloud architecture            | AWS Architecture Icons and their group conventions (AWS Cloud, Region), numbered flow steps                                                                                     |
| Data                          | Access-pattern table plus key design for DynamoDB                                                                                                                               |

Export each diagram as PNG to `docs/diagrams/` with its source file beside it, and bump `-vN` when
the logic changes.

## 6. Definition of Done

A story is done when its pull request is merged with green CI, its acceptance criteria are shown working
in dev, every new text exists in French and English, and any API, diagram or decision it changed is
updated in `docs/`.
