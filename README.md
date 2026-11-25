# CleanLoop

CleanLoop is a waste-reporting platform for Cameroonian cities. Citizens photograph
illegal dumping or overflowing bins. The platform locates the report, checks it against
nearby reports, sets a priority and assigns a collection crew. Everyone sees the report
move from submitted to resolved.

![Cloud architecture](docs/diagrams/cloud-architecture-v3.png)

## What is in this repository

| Folder             | What it is                                              | Stack                                                                   |
| ------------------ | ------------------------------------------------------- | ----------------------------------------------------------------------- |
| `backend/`         | AWS infrastructure and API functions                    | AWS CDK v2, TypeScript, Lambda, API Gateway, Cognito, DynamoDB, S3, SES |
| `frontend/mobile/` | Citizen and crew app, with a guest mode                 | Expo (React Native), Expo Router, Zustand                               |
| `frontend/web/`    | Admin portal: reports, tasks, crews and a map           | React, Vite, Tailwind CSS, React Leaflet                                |
| `docs/`            | Requirements, diagrams, decision records, meeting notes |                                                                         |

Each of the three projects has its own `pnpm-lock.yaml`. The root `package.json` only
holds the shared lint and format tooling.

## Status

Release 1 (the core reporting loop) is being built in two-week Scrum sprints and
tracked in Jira (project key `CL`). The requirements live in the Agile SRS. Requirement
documents and slide decks are kept in the team's private document space, not in this
public repository. Release 2 adds the AI Intelligence Module
for image analysis; later releases add insight dashboards and an assistant.

Known gaps in the current code, scheduled as Sprint 0 and Sprint 1 work:

- `GET /reports/presigned-upload` is public and must require sign-in or a device token.
- The SLA check runs every 5 minutes; the requirement is assignment within 60 seconds.
- Sign-in is email and password only; SMS code sign-in becomes the default, with email
  and password kept as an option.
- There are no automated tests yet. CI runs lint, format, type-checks, `cdk synth` and
  the admin portal build on every pull request.

## Getting started

### Try it without AWS (preview mode)

To click through both apps with fictional sample data and no AWS account:

```powershell
pnpm preview
```

The admin portal opens on http://localhost:3100 and the mobile app (web build) on
http://localhost:8090. Sample accounts and how it works are in
[frontend/preview-server/README.md](frontend/preview-server/README.md). Nothing in preview
mode touches real data.

### Prerequisites

- Node.js 22 and pnpm 10.20 (`corepack enable` installs the pinned version)
- For the backend: an AWS account, the AWS CLI signed in, and a one-off
  `pnpm exec cdk bootstrap` in `us-east-1`
- For the mobile app: Expo Go on a phone, or an Android or iOS simulator

### Backend

```powershell
cd backend
pnpm install
pnpm exec cdk deploy --all --context stage=dev --outputs-file cdk-outputs.json
```

This deploys five stacks, each named `CleanLoop-<Stack>-<stage>`: Storage, Auth,
Notifications, Compute and Api. `cdk-outputs.json` then holds the API URL and Cognito
IDs the apps need. It is git-ignored because it names your account; never commit it.

The CDK app reads these from `backend/.env` (also git-ignored):

| Variable                      | Purpose                                                             |
| ----------------------------- | ------------------------------------------------------------------- |
| `STAGE`                       | `dev`, `staging` or `prod` (default `dev`; `--context stage=` wins) |
| `AWS_ACCOUNT`, `AWS_REGION`   | Target account and region (default region `us-east-1`)              |
| `SES_FROM_EMAIL`              | Verified SES sender for reminder and notification emails            |
| `GOOGLE_MAPS_API_KEY`         | Geocoding for report locations and crew distances                   |
| `GOOGLE_OAUTH_CLIENT_ID`      | Optional Google sign-in through Cognito (secret: see below)         |
| `MAX_AUTO_ASSIGN_DISTANCE_KM` | Furthest crew distance for automatic assignment                     |

The Google client secret is never put in `.env`. Store it once per stage in Secrets
Manager, and CloudFormation reads it at deploy time:

```powershell
aws secretsmanager create-secret --name cleanloop/dev/google-oauth-client-secret --secret-string "<client secret>"
```

### Mobile app

```powershell
cd frontend/mobile
pnpm install
pnpm start
```

Create `frontend/mobile/.env` with the values from `cdk-outputs.json`:

```
EXPO_PUBLIC_API_URL=
EXPO_PUBLIC_COGNITO_REGION=us-east-1
EXPO_PUBLIC_COGNITO_CLIENT_ID=
EXPO_PUBLIC_COGNITO_DOMAIN=
```

### Admin portal

```powershell
cd frontend/web
pnpm install
pnpm dev
```

Create `frontend/web/.env` with:

```
VITE_API_URL=
VITE_COGNITO_REGION=us-east-1
VITE_COGNITO_CLIENT_ID=
```

## Documentation

- [Use case diagram](docs/diagrams/use-case-diagram-v3.png),
  [report submission](docs/diagrams/report-submission-activity-v3.png) and
  [image analysis](docs/diagrams/image-analysis-activity-v3.png) activity diagrams.
  Their generator scripts are in [docs/diagrams/src](docs/diagrams/src).
- Architecture decisions: [docs/adr](docs/adr)
- Sprint reviews and retrospectives: [docs/meetings](docs/meetings)

## Checks

Run these before opening a pull request; CI runs the same ones:

```powershell
pnpm install
pnpm lint
pnpm format:check
```

and `pnpm typecheck` inside each project (`backend` also has `pnpm synth`).

## Contributing

Read [CONTRIBUTING.md](CONTRIBUTING.md) before your first pull request. In short: one
branch per Jira story (`feat/CL-12-duplicate-check`), commits written as
`type(scope): what changed (CL-12)`, and every change reaches `main` through a reviewed
pull request.

## Team

| Role          | Name    |
| ------------- | ------- |
| Product Owner | Mathias |
| Scrum Master  | Bryan   |
| AI lead       | Imele   |
