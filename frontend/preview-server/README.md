# Preview mode

Run the admin portal and the mobile app against fictional sample data, with no AWS
account, no sign-in to a real user pool, and no risk to real reports.

```powershell
pnpm preview          # admin portal and mobile app (web build)
pnpm preview:web      # admin portal only, http://localhost:3100
pnpm preview:mobile   # mobile app only, http://localhost:8090
```

Run these from the repository root. A "PREVIEW · sample data" badge shows in the corner
of both apps.

## Sample accounts

Any password works. Sign-up confirmation and password-reset codes are always `123456`.

| Email                    | Role                                          |
| ------------------------ | --------------------------------------------- |
| `admin@preview.test`     | Admin (portal)                                |
| `citizen@preview.test`   | Citizen with reports in every status          |
| `neighbour@preview.test` | A second citizen                              |
| `crew@preview.test`      | Crew lead with an active and a completed task |
| `crew2@preview.test`     | Crew lead with an assigned task               |
| `crew3@preview.test`     | Crew companion                                |

Every name, email and phone number in `seed.mjs` is made up.

## How it works

- `server.mjs` is a stand-in for the backend. It answers every route in
  `docs/api/openapi.yaml`, with the same rules as the Lambda handlers: automatic
  assignment to the nearest crew within 25 km, reports following their task, evidence
  checks and notifications.
- It also answers the Cognito calls the apps make (sign-in, sign-up, refresh) with
  unsigned tokens that carry the right role.
- Photo uploads go to the stand-in instead of S3, in memory.
- `start.mjs` starts the stand-in and the apps with their API and sign-in addresses set
  to it, through environment variables that take precedence over any `.env` file.

The stand-in listens only on this machine (`127.0.0.1:4010`). Data lives in memory:
restart it, or `POST http://127.0.0.1:4010/__reset`, to get the seed back.

## Keeping it honest

When a route or rule changes in the backend, change it here in the same pull request,
as with the contract. Preview mode tests the apps, not the Lambda code: backend changes
still need the dev stack.

## Limits

- Google sign-in (the Cognito hosted page) is not available in preview.
- The mobile app runs as a web build. Running it on a phone through Expo Go would need
  the stand-in reachable on the local network, which preview mode does not do yet.
- Sample photos are SVG placeholders, which the native image component does not show.
