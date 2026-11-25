# 0001. Backend redesign: keep the serverless core, cut what Release 1 does not need

- Status: Proposed
- Date: 2026-11-25
- Deciders: Mathias (Product Owner), Bryan (Scrum Master), Imele (AI)

## Context

The backend works but was built before the requirements settled. A logic review of the
architecture found a public upload endpoint, a 5-minute SLA poll against a 60-second
target, 24 full-table `Scan` calls, functions on x86, no log retention, and services in
the target design that Release 1 does not use. The redesign is not a rewrite: the stack
(CDK, Lambda, DynamoDB, S3, Cognito) stays, and the code is reorganised and corrected
story by story.

The goal is the cheapest design that still meets the Release 1 requirements, chosen
from measured prices rather than defaults. Prices below were checked in November 2026;
sources are listed at the end.

## The finding that drives the design: SMS to Cameroon is expensive

| Channel                            | Price per message to Cameroon | Source                    |
| ---------------------------------- | ----------------------------- | ------------------------- |
| AWS SMS (what Cognito uses)        | $0.288                        | AWS SMS price list (CSV)  |
| Twilio SMS                         | $0.317                        | Twilio Cameroon page      |
| eSMS Africa (aggregator, mid tier) | $0.298                        | eSMS Africa price index   |
| seven.io                           | 0.163 (currency not shown)    | seven.io price list       |
| WhatsApp authentication template   | about $0.004 to $0.006        | Meta rate card via guides |
| Push notification (Expo service)   | free                          | Expo docs                 |

An SMS costs about 50 to 70 times a WhatsApp authentication message. With the current
SRS (SMS code as the default sign-in, an SMS confirmation for every report and an SMS to
crews on every assignment), a modest pilot of 2,000 citizens and 3,000 reports a month
sends about 9,000 SMS: roughly **$2,600 a month**. Everything else in the backend costs
under $10 a month at that size.

## Decision

### 1. Sign-in and messaging

- **Default sign-in: a one-time code sent by WhatsApp**, through Cognito's custom
  authentication triggers and Meta's WhatsApp Cloud API directly (no reseller markup).
- **Fallback: SMS code**, offered only when WhatsApp delivery fails or the user asks.
  Rate-limited per number, with an AWS SMS spending limit set.
- **Optional: email and password**, unchanged (free).
- **Long sessions**: 30-day refresh tokens, so most users sign in about once a month.
- **Notifications: push first** (Expo push service, free, 600 per second). Report
  confirmations and status changes go by push and in-app. SMS is kept for crews who have
  no data connection when a task is assigned.

This changes the SRS decision "SMS code is the default sign-in". It needs the Product
Owner's agreement and a verified Meta Business account (a registered business and a
phone number for WhatsApp).

### 2. API layer: API Gateway HTTP API instead of REST API

- $1.00 per million requests instead of $3.50, and a built-in JWT authorizer for
  Cognito, so no authorizer function.
- Given up: WAF attachment, request validation and usage plans. Validation moves into
  the code (zod at the edge, already in CONTRIBUTING.md). If WAF is needed later, it goes
  on a CloudFront distribution in front of the API.
- The absolute saving at pilot size is small (well under $5 a month). The real gain is
  simpler, cheaper authentication.

### 3. Compute: Lambda on arm64, grouped by domain

- Keep one function per domain (reports, tasks, crew, notifications, auth), not one per
  endpoint and not a single monolith. Add the pipeline worker, notifier and SLA watchdog
  from the target architecture.
- arm64 (Graviton) is about 20% cheaper per GB-second than x86 for the same code.
- Node.js 22. Bundle and pin the AWS SDK instead of relying on the runtime's copy.
- No VPC, so no NAT gateway (about $32 a month each).
- Code layout per domain: `handler.ts` (HTTP only), `service.ts` (use cases),
  `rules.ts` (pure business rules with unit tests), `repository.ts` (DynamoDB access).

### 4. Data: DynamoDB on demand, queries instead of scans

- On-demand capacity ($0.625 per million writes, $0.125 per million reads, $0.25 per
  GB-month).
- Replace the 24 `Scan` calls with queries on indexes designed from access patterns: a
  `byGeohash` index for the duplicate check (50 m, 72 h), `byCrewGroupStatus` for task
  lists, `byUserCreatedAt` for "my reports".
- Point-in-time recovery on in production only.
- S3: report photos move to a cheaper storage class after 90 days.

### 5. Asynchronous processing, as in the v3 architecture

- SQS queue with a dead-letter queue between submit and the pipeline worker.
- EventBridge Scheduler every minute for the SLA watchdog: 43,200 runs a month, inside
  the 14 million free invocations.
- EventBridge bus for `ReportSubmitted`, `TaskAssigned` and similar events.

### 6. Image analysis: one multimodal model call per image

- Instead of Rekognition `DetectLabels` plus `DetectModerationLabels` ($0.002 per image
  together), send each image once to a small multimodal model on Bedrock (Amazon Nova
  Lite: about $0.06 per million input tokens; an image is about 800 to 1,300 tokens) and
  ask for structured JSON: usable or not, waste classes, hazard cues, moderation flags.
- Roughly $0.0001 to $0.0002 per image, and the same integration grows into the
  Release 2 AI module instead of being replaced.
- The rule engine keeps authority over priority, as in Figure 6.
- Imele benchmarks it against Rekognition on 100 real photos from Cameroon before the
  switch; accuracy decides, not price alone.

### 7. Removed or replaced to save money

| Instead of                       | Use                                   | Why                                  |
| -------------------------------- | ------------------------------------- | ------------------------------------ |
| Amazon SNS mobile push           | Expo push service                     | Free; the apps already use Expo      |
| OpenStreetMap's own tile servers | OpenFreeMap tiles                     | Free, no limits, commercial use OK   |
| Logs kept forever                | 14 days in dev, 30 days in production | Log storage grows with every request |

Most of these swaps give up features, not capacity. Each one sits behind a single module
or a CDK setting, so switching back is a contained change. We switch when a trigger below
is met, not by habit:

| Replacement      | Limit that matters                                            | Switch back or move on when                                                                                               |
| ---------------- | ------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------- |
| Expo push        | About 600 notifications a second per project; no delivery SLA | Sustained sends near that rate, or a contract needing an SLA: send to FCM and APNs directly (SNS adds cost, not capacity) |
| OpenFreeMap      | Donation-funded, no SLA                                       | Outages or slow tiles: host a Cameroon-only tile file on S3 and CloudFront (a few dollars a month)                        |
| Short log expiry | None; older logs are gone                                     | An incident or audit needs longer history: export to S3 Glacier instead of keeping them in CloudWatch                     |

To see a trigger before users do, add a CloudWatch alarm on push send errors, and have
the apps report map tile failures with their error logs.

### 7a. Secrets, settings and encryption keys

The MVP is built so that each service can be swapped or upgraded when the time comes,
not sized for scale it does not have yet. Here the cheapest option is not the most
swappable one, and the difference is a few dollars a month, so we pay it.

- **Secrets in Secrets Manager** ($0.40 per secret a month; about $1 to $2 for the
  Google OAuth client secret, the WhatsApp token and the Geocoding key). It is the only
  store that rotates secrets automatically, which a future database, payment provider
  or messaging token will need. It also keeps secrets out of the deploy template:
  `SecretValue.secretsManager()` makes CloudFormation fetch the value at deploy time,
  while today `GOOGLE_OAUTH_CLIENT_SECRET` is read from the environment and written into
  the template in plain text. That fix comes first.
- **Plain settings in Parameter Store**, standard tier and free: table names, feature
  flags, timeouts and other values that are not secret.
- **One `getSecret(name)` helper** in the Lambda code reads and caches secrets at cold
  start. No handler calls a secret store directly, so changing stores touches one file.
- **AWS-managed encryption keys** for DynamoDB and S3 for now. OAuth does not need our
  own keys: Google issues the client secret, which goes in Secrets Manager, and Cognito
  signs tokens with keys it manages. We would need a KMS signing key only if we ran our
  own token server.
- **Customer-managed keys are a ready switch.** We turn them on when a client, auditor
  or data-protection rule asks for our own keys, an audit trail per key, or the ability
  to make data unreadable by deleting a key. A DynamoDB table changes key with a setting
  and no downtime. In S3 a new key covers new uploads only, so older photos are copied
  over once.

### 8. Kept as they are

- **Cognito**: 10,000 monthly active users free on the Lite and Essentials tiers.
- **Google Geocoding**: 10,000 free requests a month, then $5 per 1,000. Geocode once per
  report and per crew location, cache the result, and keep distances on the local
  haversine formula (already done). Amazon Location's free allowance lasts only three
  months, LocationIQ's free tier limits commercial use, and the public Nominatim server
  forbids app traffic.
- **SES** for admin email.
- **Amplify Hosting** for the admin portal (free for 12 months, then cents a month at
  this traffic). Cloudflare Pages is a free alternative if we want to leave AWS for it.
- **Region us-east-1**.

## Estimated monthly cost at pilot size

Assumptions: 2,000 active citizens, 50 crew, 3,000 reports a month, 3 photos a report.

| Item                      | Current SRS design | This proposal                |
| ------------------------- | ------------------ | ---------------------------- |
| Sign-in codes             | ~$860 (SMS)        | ~$15 (WhatsApp, some SMS)    |
| Report confirmations      | ~$860 (SMS)        | $0 (push)                    |
| Crew assignment messages  | ~$860 (SMS)        | ~$50 (SMS only when offline) |
| Image analysis            | ~$18 (Rekognition) | ~$2 (Nova Lite)              |
| API, Lambda, DynamoDB, S3 | ~$5                | ~$3                          |
| Secrets, keys, logs       | ~$3                | ~$2                          |
| **Total**                 | **about $2,600**   | **about $70**                |

These are estimates. Set an AWS Budgets alarm at $25 a month and an SMS spending limit
before the pilot.

## How we get there without a rewrite

1. **Contracts first (Sprint 1):** `docs/api/openapi.yaml` from the existing routes,
   the access-pattern table, and the report and task state machines.
2. **Infrastructure swaps with little or no code change:** arm64, log retention, the
   Google OAuth secret moved into Secrets Manager behind `getSecret`, plain settings in
   Parameter Store, remove SNS.
3. **Restructure one domain per story:** move code into handler, service, rules and
   repository, add unit tests for the rules, replace that domain's scans with queries.
4. **New flows:** report create, upload, submit and queue; the per-minute SLA
   watchdog; WhatsApp sign-in with SMS fallback.
5. **HTTP API switch** once every route is in the OpenAPI file.

If there are no real users in the deployed environment yet, tables can be recreated
with the new keys instead of migrated. To confirm before step 3.

## Consequences

- Monthly running cost at pilot size drops from about $2,600 to about $70, almost all of
  it messaging.
- WhatsApp sign-in depends on Meta Business verification; until it is approved, SMS is
  the only code channel, so development uses email and password.
- WAF is not available on the HTTP API without adding CloudFront.
- OpenFreeMap has no service guarantee; if it becomes unreliable we host a Cameroon-only
  tile file on S3 and CloudFront.
- Secrets Manager costs about $1 to $2 a month more than Parameter Store would, in
  exchange for rotation and secrets kept out of the deploy template.

## Sources

- AWS SMS prices per country (CSV), linked from https://aws.amazon.com/end-user-messaging/pricing/
- Twilio Cameroon SMS pricing: https://www.twilio.com/en-us/sms/pricing/cm
- eSMS Africa price index: https://esmsafrica.io/sms-pricing
- seven.io price list: https://www.seven.io/en/full-sms-pricelist/
- WhatsApp rates for Cameroon and Rest of Africa: https://whautomate.com/whatsapp-business-api-pricing,
  https://www.infobip.com/whatsapp-business/pricing
- Amazon Cognito pricing: https://aws.amazon.com/cognito/pricing/
- API Gateway pricing: https://aws.amazon.com/api-gateway/pricing/
- DynamoDB on-demand pricing: https://aws.amazon.com/dynamodb/pricing/on-demand/
- EventBridge pricing: https://aws.amazon.com/eventbridge/pricing/
- Rekognition pricing: https://aws.amazon.com/rekognition/pricing/
- Nova image token estimates: https://docs.aws.amazon.com/nova/latest/userguide/modalities-image.html
- Nova Lite token price (aggregator): https://www.llmreference.com/provider/aws-bedrock/nova-lite
- Google Geocoding pricing: https://www.woosmap.com/blog/google-maps-geocoding-api-pricing
- Amazon Location pricing: https://aws.amazon.com/location/pricing/
- OpenFreeMap: https://openfreemap.org/
- Expo push limits: https://docs.expo.dev/push-notifications/sending-notifications/
- Amplify pricing: https://aws.amazon.com/amplify/pricing/
- Cloudflare Pages limits: https://developers.cloudflare.com/pages/platform/limits/
- Nominatim usage policy: https://operations.osmfoundation.org/policies/nominatim/
