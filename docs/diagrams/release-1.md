# SRS figures: Release 1

Figures 3, 11, 16, 17 and 18 of the SRS, drawn as Mermaid so GitHub renders them and
they can be edited as text. Figures 1, 4, 5 and 6 are the PNGs in this folder. The AI
module figures are in [ai-module.md](ai-module.md).

Where [ADR 0001](../adr/0001-backend-redesign.md) changed the SRS design (push before
SMS, Nova Lite instead of Rekognition, no WAF until it is needed), the figures follow the
ADR and say so. Flowcharts use orthogonal lines.

## Figure 3: AWS cloud deployment architecture

AWS services, stacks and environments used to run CleanLoop, and how the AI module is
released separately.

```mermaid
%%{init: {"flowchart": {"curve": "step", "nodeSpacing": 30, "rankSpacing": 45}}}%%
flowchart LR
  subgraph Pipeline["GitHub and CI/CD"]
    direction TB
    Repo["GitHub repository<br/>main, pull requests"]
    CI["GitHub Actions<br/>lint, type checks, CDK synth"]
    Promote["cdk deploy per stage<br/>dev, then staging, then prod"]
    AIMRelease["AI module release<br/>container image and model version,<br/>shadow, then active"]
    Repo --> CI --> Promote
    Repo --> AIMRelease
  end

  subgraph Clients["Clients"]
    direction TB
    Mobile["Mobile app<br/>Expo, citizen and crew"]
    Portal["Admin portal<br/>React on Amplify Hosting"]
  end

  subgraph Account["AWS account per stage: dev, staging, prod (us-east-1)"]
    direction TB
    subgraph AuthStack["Auth stack"]
      Cognito["Cognito user pool<br/>WhatsApp or SMS code, email"]
    end
    subgraph ApiStack["API stack"]
      APIGW["API Gateway<br/>REST today, HTTP API next<br/>throttled guest routes"]
    end
    subgraph ComputeStack["Compute stack"]
      Lambdas["Lambda per domain, arm64, Node.js 22<br/>reports, tasks, crew, notifications"]
      Sched["EventBridge Scheduler<br/>SLA sweep every minute,<br/>reminders every 30 minutes"]
      Pipe["Step Functions pipeline<br/>with SQS queue and DLQ"]
    end
    subgraph StorageStack["Storage stack"]
      DDB[("DynamoDB, on demand<br/>Reports, Users, Tasks, Notifications")]
      Media[("S3 media bucket<br/>photos, evidence")]
    end
    subgraph NotifyStack["Notifications stack"]
      Bus["EventBridge bus<br/>ReportCreated, TaskAssigned"]
      SES["SES email"]
    end
    subgraph AIStack["AI stack (AI module)"]
      AIM["AI module worker<br/>Lambda container"]
      Bedrock["Bedrock<br/>Nova Lite vision, Knowledge Base"]
      Artefacts[("S3 AI artefacts<br/>model registry")]
    end
    subgraph Ops["Operations"]
      Secrets["Secrets Manager<br/>OAuth, WhatsApp, Geocoding keys"]
      Params["Parameter Store<br/>plain settings"]
      Watch["CloudWatch logs 14 or 30 days,<br/>alarms, X-Ray"]
      Budget["AWS Budgets<br/>7 USD a month in dev"]
    end
  end

  Expo["Expo push service"]
  WhatsApp["WhatsApp Cloud API<br/>SMS fallback"]

  Mobile --> APIGW
  Portal --> APIGW
  Mobile --> Cognito
  Portal --> Cognito
  APIGW --> Lambdas
  Lambdas --> DDB
  Lambdas --> Media
  Lambdas --> Bus
  Sched --> Lambdas
  Lambdas --> Pipe
  Pipe --> AIM
  AIM --> Bedrock
  AIM --> Artefacts
  Lambdas --> Expo
  Lambdas --> SES
  Cognito --> WhatsApp
  Lambdas --> Secrets
  Promote --> Account
  AIMRelease --> AIStack
```

Notes:

- One AWS account per stage keeps dev data and spending apart from production; the
  budget alarm covers the whole account.
- Not in Release 1: CloudFront and WAF in front of the API (added if abuse appears),
  SageMaker endpoints (only if a custom model outgrows Bedrock), customer-managed KMS
  keys (a ready switch, see ADR 0001 section 7a).
- The Step Functions pipeline and AI stack arrive with the new report flow; today the
  reports Lambda assigns crews directly.

## Figure 11: citizen report submission and AI image analysis (sequence)

Message order from the citizen to an assigned task, including the asynchronous analysis
and its fallback. Uses the new report flow from `docs/api/openapi.yaml`.

```mermaid
sequenceDiagram
  autonumber
  participant App as Citizen app
  participant API as API Gateway
  participant Rep as Reports service
  participant S3 as S3 media
  participant SF as Processing state machine
  participant Q as SQS (AI step)
  participant AIM as AI module
  participant Rules as Rule engine
  participant Tasks as Tasks service
  participant Notify as Notify

  App->>API: POST /v2/reports (category, location, media list, Idempotency-Key)
  API->>Rep: create draft
  Rep-->>App: 201 reportId, tracking code, upload links
  App->>S3: PUT each photo
  App->>API: POST /v2/reports/{id}/submit
  API->>Rep: submit
  Rep->>S3: check every file (type, size)
  Rep->>SF: start (ReportSubmitted)
  Rep-->>App: 200 submitted
  Note over SF,Tasks: Target: task assigned within 60 s of submit
  SF->>SF: validate, moderate, geocode, duplicate check (50 m, 72 h)
  SF->>Q: analyze request with task token
  Q->>AIM: deliver
  AIM-->>SF: 202 accepted
  alt analysis returns in time with confidence 60% or more
    AIM-->>SF: result event (classes, level, hazard cues)
    SF->>Rules: priority from evidence, category, duplicates, zone
  else timeout or confidence below 60%
    SF->>Rules: category default priority
    Rules-->>SF: priority with review flag
  end
  Rules-->>SF: final priority
  SF->>Tasks: create and assign task (BR-005)
  Tasks->>Notify: TaskAssigned
  Notify-->>App: push to the reporter (status: assigned)
  Notify->>Notify: push to the crew, SMS only if offline
```

## Figure 16: entity relationship diagram

All entities with keys and relationships. Mermaid ERDs have no colour legend, so new AI
entities carry `AI` in their name and modified entities list their added attributes
marked `added`.

```mermaid
erDiagram
  USER ||--o{ REPORT : submits
  ANONYMOUS_SESSION ||--o{ REPORT : "submits as guest"
  REPORT }o--o| REPORT : "duplicate of"
  REPORT }o--o| TASK : "handled by"
  ZONE ||--o{ REPORT : contains
  CREW_GROUP ||--o{ CREW_MEMBER : has
  ZONE ||--o{ CREW_GROUP : "operational zone"
  CREW_GROUP ||--o{ TASK : "assigned to"
  CREW_MEMBER ||--o{ TASK : leads
  TASK ||--o{ ATTENDANCE : records
  CREW_MEMBER ||--o{ ATTENDANCE : "marked in"
  USER ||--o{ NOTIFICATION : receives
  USER ||--o{ MARKETPLACE_LISTING : posts
  MARKETPLACE_LISTING ||--o{ MARKETPLACE_REQUEST : receives
  USER ||--o| LEADERBOARD_ENTRY : ranks
  CREW_MEMBER ||--o{ MONTHLY_STATISTICS : "summarised in"
  USER ||--o{ AUDIT_LOG : "acts in"
  REPORT ||--o| AI_ANALYSIS : "current analysis"
  AI_ANALYSIS ||--o{ AI_REVIEW : "reviewed by"
  AI_MODEL_VERSION ||--o{ AI_ANALYSIS : produces
  AI_MODEL_VERSION ||--o{ AI_RECOMMENDATION : produces
  TASK ||--o| AI_RECOMMENDATION : "active recommendation"
  TASK }o--o| VEHICLE : uses
  ZONE ||--o{ VEHICLE : "based in"
  AI_HOTSPOT ||--o{ AI_HOTSPOT_OBSERVATION : "observed as"
  AI_CHAT_SESSION ||--o{ AI_CHAT_MESSAGE : contains
  USER ||--o{ AI_REPORT : approves

  USER {
    string userId PK
    string email
    string phone
    string role "CITIZEN, CREW, ADMIN"
    string status
  }
  ANONYMOUS_SESSION {
    string sessionId PK
    string trackingCodes
  }
  REPORT {
    string reportId PK
    string trackingCode
    string type
    string status
    number lat
    number lng
    string zoneId FK
    string submittedBy FK
    string assignedTaskId FK
    string parentReportId FK
    string aiStatus "added"
    string aiAnalysisId "added"
    string prioritySource "added: rules or default"
    boolean reviewRequired "added"
  }
  TASK {
    string taskId PK
    string status
    string crewLeadId FK
    string crewGroupId FK
    datetime scheduledAt
    datetime dueAt
    string vehicleId "added"
    string recommendationId "added"
  }
  CREW_MEMBER {
    string userId PK
    string crewGroupId FK
    string availabilityStatus "added"
    string shift "added"
  }
  CREW_GROUP {
    string crewGroupId PK
    string operationalZoneId "added"
    number maxOpenTasks "added"
  }
  ATTENDANCE {
    string taskId PK
    string userId PK
    string arrival "on time, late, absent"
    datetime markedAt
  }
  NOTIFICATION {
    string notificationId PK
    string userId FK
    string type
    boolean read
  }
  MONTHLY_STATISTICS {
    string userId PK
    string month PK
  }
  MARKETPLACE_LISTING {
    string listingId PK
    string userId FK
  }
  MARKETPLACE_REQUEST {
    string requestId PK
    string listingId FK
  }
  LEADERBOARD_ENTRY {
    string userId PK
    number points
  }
  ZONE {
    string zoneId PK
    string roadAccessClass "added"
  }
  AUDIT_LOG {
    string auditId PK
    string actorId FK
    string modelVersionId "added"
    string correlationId "added"
  }
  CONFIGURATION {
    string key PK
    string value "added keys: AI switches, thresholds"
  }
  AI_ANALYSIS {
    string analysisId PK
    string reportId FK
    string modelVersionId FK
    string status
    string aggregateResult
    boolean reviewRequired
  }
  AI_MODEL_VERSION {
    string modelVersionId PK
    string kind
    string status "candidate, shadow, active, retired"
  }
  AI_REVIEW {
    string reviewId PK
    string analysisId FK
    string decision
    boolean consentForTraining
  }
  AI_RECOMMENDATION {
    string recommendationId PK
    string taskId FK
    string status "proposed, confirmed, changed, rejected"
    boolean noSuitable
  }
  VEHICLE {
    string vehicleId PK
    string zoneId FK
    string capacityClass
    string status
  }
  AI_HOTSPOT {
    string hotspotId PK
    string class "A or B"
    string centroid
    number radius
  }
  AI_HOTSPOT_OBSERVATION {
    string hotspotId PK
    string period PK
    number reportCount
    string trend
  }
  AI_CHAT_SESSION {
    string sessionId PK
    string role
    string language
    number ttl
  }
  AI_CHAT_MESSAGE {
    string sessionId PK
    number sequence PK
    string speaker
    string text "masked"
  }
  AI_REPORT {
    string aiReportId PK
    string period
    string status "draft, approved, published"
    string approvedBy FK
  }
```

Release 1 stores only User, Report, Task and Notification in DynamoDB today; the data
access plan is in [docs/api/access-patterns.md](../api/access-patterns.md).

## Figure 17: context-level data flow diagram (level 0)

CleanLoop as one process with its external entities.

```mermaid
%%{init: {"flowchart": {"curve": "step"}}}%%
flowchart LR
  Citizen["Citizen<br/>anonymous or registered"]
  Crew["Crew member"]
  Admin["Administrator"]
  P0(("0<br/>CleanLoop"))
  Msg["WhatsApp, SMS and<br/>push services"]
  Loc["Location service<br/>Google Geocoding"]
  Mail["Email service<br/>SES"]
  AI["AI model and<br/>vision services (Bedrock)"]

  Citizen -- "reports with media and location" --> P0
  P0 -- "tracking code and status" --> Citizen
  P0 -- "task assignments" --> Crew
  Crew -- "check-in, completion evidence" --> P0
  Admin -- "queries and decisions" --> P0
  P0 -- "dashboards, alerts, recommendations" --> Admin
  P0 -- "sign-in codes, notifications" --> Msg
  P0 -- "addresses" --> Loc
  Loc -- "coordinates" --> P0
  P0 -- "reminders, admin email" --> Mail
  P0 -- "images, prompts" --> AI
  AI -- "analysis, text" --> P0
```

## Figure 18: data flow diagram (level 1)

Main processes and data stores, including the AI processes (dashed).

```mermaid
%%{init: {"flowchart": {"curve": "step", "nodeSpacing": 25, "rankSpacing": 40}}}%%
flowchart TB
  Citizen["Citizen"]
  Crew["Crew member"]
  Admin["Administrator"]

  P1(("1 Report intake"))
  P2(("2 Media handling"))
  P3(("3 Duplicate detection"))
  P4(("4 AI analysis"))
  P5(("5 Rule-based priority"))
  P6(("6 Task assignment"))
  P7(("7 Recommendation"))
  P8(("8 Completion verification"))
  P9(("9 Notification"))
  P10(("10 Analytics"))
  P11(("11 Hotspot analysis"))
  P12(("12 Assistant"))

  D1[("D1 Reports")]
  D2[("D2 Tasks")]
  D3[("D3 Crew and groups")]
  D4[("D4 Vehicles")]
  D5[("D5 AI analyses")]
  D6[("D6 Recommendations")]
  D7[("D7 Hotspots")]
  D8[("D8 Chat sessions")]
  D9[("D9 AI reports")]
  D10[("D10 Audit log")]
  D11[("D11 Media, S3")]

  Citizen -- "report details" --> P1
  P1 -- "new report" --> D1
  Citizen -- "photos" --> P2
  P2 -- "files" --> D11
  P1 -- "location, category" --> P3
  D1 -- "open reports nearby" --> P3
  P3 -- "parent link" --> D1
  D11 -- "image keys" --> P4
  P4 -- "analysis" --> D5
  D5 -- "evidence" --> P5
  P3 -- "duplicate count" --> P5
  P5 -- "priority" --> D1
  D1 -- "prioritised report" --> P6
  D3 -- "crew, zone, workload" --> P6
  P6 -- "task" --> D2
  D2 -- "task" --> P7
  D3 -- "availability" --> P7
  D4 -- "vehicles" --> P7
  P7 -- "options" --> D6
  Admin -- "decision" --> P7
  Crew -- "evidence, attendance" --> P8
  P8 -- "completed task" --> D2
  P8 -- "resolved" --> D1
  D2 -- "task events" --> P9
  D1 -- "status changes" --> P9
  P9 -- "push, SMS, email" --> Citizen
  P9 -- "assignments" --> Crew
  D1 -- "facts" --> P10
  D2 -- "facts" --> P10
  P10 -- "narrative" --> D9
  D9 -- "report" --> Admin
  D1 -- "points" --> P11
  P11 -- "hotspots" --> D7
  D7 -- "map" --> Admin
  Citizen -- "question" --> P12
  P12 -- "messages" --> D8
  P12 -- "answer" --> Citizen
  P6 -- "decision" --> D10
  P7 -- "decision" --> D10

  classDef ai stroke-dasharray: 5 4
  class P4,P7,P10,P11,P12,D5,D6,D7,D8,D9 ai
```
