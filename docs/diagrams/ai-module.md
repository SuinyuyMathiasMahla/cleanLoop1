# SRS figures: AI module (Release 2)

Figures 7 to 10, 12 to 15 and 19 to 24 of the SRS, for the AI Intelligence Module (AIM).
Figure 2, the AI architecture, is a slide in the project deck; figure 6, image analysis,
is `image-analysis-activity-v3.png` in this folder.

These follow the SRS as written. Two decisions are still open and will change some of
them: the vision model (Imele's Nova Lite benchmark against Rekognition) and the
recommendation mode switch (D-03). Throughout, the core keeps authority: the AIM
recommends, the backend decides, and the AIM never reads core tables directly.

Activity diagrams draw each swimlane as a box; flowcharts use orthogonal lines.

## Figure 7: AI chatbot activity diagram

One assistant turn, including language detection, role check, retrieval, tool calls,
guardrails and the safe fallback.

```mermaid
%%{init: {"flowchart": {"curve": "step"}}}%%
flowchart TB
  subgraph U["User"]
    start((" ")) --> ask["Send a message"]
    show["Read the answer"] --> done(((" ")))
  end
  subgraph C["Core assistant route"]
    auth{"Signed in?"}
    anon["Treat as anonymous<br/>public knowledge only"]
    role["Attach role claims"]
    runtool["Run the tool with the<br/>user's identity"]
    allowed{"Tool allowed<br/>for the role?"}
    gotdata{"Tool returned data?"}
  end
  subgraph M["AI module (assistant)"]
    lang["Detect language"]
    scope{"Question in scope?"}
    decline["Decline politely,<br/>suggest what it can help with"]
    retrieve["Retrieve passages"]
    need{"Tool needed?"}
    reqtool["Request tool"]
    compose["Compose answer"]
    guard{"Guardrail passed?"}
    fallback["Safe fallback answer:<br/>no data or no permission"]
  end
  subgraph K["Knowledge base"]
    kb[("Approved documents<br/>filtered by audience")]
  end
  subgraph T["Core tools"]
    db[("Reports, tasks,<br/>statistics")]
  end

  ask --> auth
  auth -- yes --> role --> lang
  auth -- no --> anon --> lang
  lang --> scope
  scope -- no --> decline --> show
  scope -- yes --> retrieve
  retrieve <--> kb
  retrieve --> need
  need -- no --> compose
  need -- yes --> reqtool --> allowed
  allowed -- no --> fallback
  allowed -- yes --> runtool
  runtool <--> db
  runtool --> gotdata
  gotdata -- no --> fallback
  gotdata -- yes --> compose
  compose --> guard
  guard -- yes --> show
  guard -- no --> fallback
  fallback --> show
```

## Figure 8: AI analytics generation activity diagram

From a schedule or a request to an approved, verified report. Numbers come from queries;
words come from the model.

```mermaid
%%{init: {"flowchart": {"curve": "step"}}}%%
flowchart TB
  subgraph S["Scheduler or administrator"]
    trig((" ")) --> req["Schedule fires or<br/>administrator requests a report"]
    decide{"Administrator<br/>approves?"}
    export["Export through a<br/>pre-signed link"] --> fin(((" ")))
  end
  subgraph A["Analytics service"]
    queries["Run approved queries"]
    facts["Build fact set"]
    anomalies["Flag anomalies"]
    verify{"Numbers in the narrative<br/>match the fact set?"}
    retried{"Retry already used?"}
    template["Fill the template<br/>(fallback, no model text)"]
    store["Store report with fact set<br/>and versions"]
  end
  subgraph M["AI module"]
    draft["Draft narrative<br/>in the requested language"]
    extract["Extract the numbers<br/>it used"]
  end
  subgraph D["Database"]
    db[("Reports, tasks,<br/>statistics")]
    reports[("AI reports")]
  end

  req --> queries
  queries <--> db
  queries --> facts --> anomalies --> draft --> extract --> verify
  verify -- yes --> store
  verify -- no --> retried
  retried -- no --> draft
  retried -- yes --> template --> store
  store --> reports
  store --> decide
  decide -- yes --> export
  decide -- "no, edit or regenerate" --> draft
```

## Figure 9: pollution hotspot detection activity diagram

How report records become classified hotspots.

```mermaid
%%{init: {"flowchart": {"curve": "step"}}}%%
flowchart TB
  subgraph S["Scheduler"]
    st((" ")) --> nightly["Nightly run"]
  end
  subgraph H["Hotspot engine"]
    window["Select window<br/>(parameters from Configuration)"]
    clean["Exclude invalid coordinates<br/>(count them)"]
    cluster["Cluster report points"]
    minok{"Minimum reports met?"}
    discard["Not a hotspot this period"]
    compare["Compare with previous period"]
    rising{"Rising trend?"}
    recur{"Recurring after<br/>completed clean-up?"}
    classA["Class A: persistent or recurring"]
    classB["Class B: emerging or rising"]
    keep["Keep as observation only"]
  end
  subgraph D["Database"]
    store[("Hotspot and<br/>observation")]
  end
  subgraph A["Administrator"]
    notify["Attention list entry and alert"] --> end1(((" ")))
  end

  nightly --> window --> clean --> cluster --> minok
  minok -- no --> discard
  minok -- yes --> compare --> recur
  recur -- yes --> classA
  recur -- no --> rising
  rising -- yes --> classB
  rising -- no --> keep
  classA --> store
  classB --> store
  keep --> store
  store --> notify
```

Class C is not produced.

## Figure 10: crew and vehicle recommendation activity diagram

Constraint filtering, scoring and the administrator's decision. Only the Tasks service
applies the final assignment.

```mermaid
%%{init: {"flowchart": {"curve": "step"}}}%%
flowchart TB
  subgraph T["Tasks service"]
    st((" ")) --> load["Load task"]
    pending["Task stays Pending,<br/>alert administrators"]
    assign["Apply the assignment"] --> fin(((" ")))
  end
  subgraph R["Recommendation engine"]
    avail["Read availability, workload,<br/>zone and road access"]
    filter["Filter by hard constraints"]
    anycrew{"Any suitable crew?"}
    anyveh{"Any suitable vehicle?"}
    urgent{"Urgent priority?"}
    widen["Widen to neighbouring zones"]
    score["Score and rank options"]
    explain["Explain each option"]
  end
  subgraph A["Administrator"]
    decision{"Decision"}
    change["Pick another option"]
    reject["Reject with reason"]
  end

  load --> avail --> filter --> anycrew
  anycrew -- no --> urgent
  urgent -- yes --> widen --> filter
  urgent -- no --> pending
  anycrew -- yes --> anyveh
  anyveh -- "no (crew only)" --> score
  anyveh -- yes --> score
  score --> explain --> decision
  decision -- confirm --> assign
  decision -- change --> change --> assign
  decision -- reject --> reject --> pending
```

## Figure 12: AI chatbot interaction sequence diagram

One chat turn with a tool call and a permission check. The reply language travels with
every message.

```mermaid
sequenceDiagram
  autonumber
  participant App as User app
  participant GW as API Gateway with Cognito
  participant Route as Assistant route
  participant AIM as AI module (assistant)
  participant KB as Knowledge base
  participant Exec as Core tool executor
  participant DB as Database

  App->>GW: chat request (message, lang)
  GW->>GW: authorise (role claims or anonymous)
  GW->>Route: message, role, lang
  Route->>AIM: chat call (message, role, session, lang)
  AIM->>KB: retrieve passages (audience = role)
  KB-->>AIM: passages
  AIM-->>Route: tool_request (name, arguments)
  Route->>Exec: run tool as the caller
  Exec->>Exec: role check
  alt tool not allowed for role
    Exec-->>Route: denied
    Route->>AIM: tool_result (not permitted)
  else allowed
    Exec->>DB: query
    alt no data
      DB-->>Exec: empty
      Exec-->>Route: tool_result (no data)
    else data
      DB-->>Exec: rows
      Exec-->>Route: tool_result (rows)
    end
    Route->>AIM: tool_result
  end
  AIM->>AIM: compose answer, guardrails
  alt guardrail blocked
    AIM-->>Route: safe fallback answer (lang)
  else passed
    AIM-->>Route: final answer with document titles (lang)
  end
  Route-->>App: answer (lang)
```

## Figure 13: administrator analytics request sequence diagram

```mermaid
sequenceDiagram
  autonumber
  actor Admin as Administrator
  participant Portal as Admin portal
  participant Svc as Admin service
  participant Job as Analytics job
  participant DB as Database
  participant AIM as AI module
  participant S3 as S3

  Admin->>Portal: request report (period, language)
  Portal->>Svc: create request
  Svc-->>Portal: job id
  Svc->>Job: start
  Job->>DB: run approved queries
  DB-->>Job: results
  Job->>S3: store fact set
  Job->>AIM: summary call (fact set key, language)
  AIM-->>Job: narrative and verification result
  alt verification failed twice
    Job->>Job: use the template, no model text
  end
  Job->>DB: store AI report (draft, versions)
  Job->>Portal: notify ready
  Admin->>Portal: review and approve
  Portal->>Svc: approve
  Svc->>DB: status published
  Svc-->>Portal: published, export link
```

## Figure 14: pollution hotspot processing sequence diagram

```mermaid
sequenceDiagram
  autonumber
  participant Sch as EventBridge scheduler
  participant Job as Hotspot job
  participant DB as Database
  participant S3 as S3
  participant AIM as AI module
  participant Portal as Admin portal
  actor Admin as Administrator

  Sch->>Job: nightly trigger
  Job->>DB: read report points for the window
  Job->>S3: write points file
  Note over Job,S3: Reports with invalid coordinates are excluded and counted
  Job->>AIM: hotspots call (points file key, parameters)
  AIM-->>Job: clusters with class A or B and trend
  Job->>DB: store hotspot and observation
  Job->>Portal: alert for new or rising hotspots
  Admin->>Portal: open the map
  Portal->>DB: map request
  DB-->>Portal: hotspots and observations
  Portal-->>Admin: display
```

## Figure 15: crew and vehicle recommendation and assignment sequence diagram

```mermaid
sequenceDiagram
  autonumber
  actor Admin as Administrator
  participant Portal as Admin portal
  participant Svc as Admin service
  participant Tasks as Tasks service
  participant DB as Database
  participant AIM as AI module
  participant Notify as Notify
  participant Audit as Audit log

  Admin->>Portal: open task
  Portal->>Svc: recommendation
  Svc->>DB: gather candidates (crews, vehicles, workload)
  Svc->>AIM: crew call
  AIM-->>Svc: ranked crews with reasons
  Svc->>AIM: vehicle call
  AIM-->>Svc: ranked vehicles with reasons
  Svc->>DB: store recommendation
  Svc-->>Portal: show options
  alt no suitable resource
    Portal-->>Admin: nothing suitable, task stays Pending
  else options available
    Admin->>Portal: decision
    alt confirm
      Portal->>Tasks: assign the recommended option
    else change
      Portal->>Tasks: assign the chosen option
    else reject
      Portal->>Svc: reject with reason
      Svc->>DB: recommendation rejected
    end
    Tasks->>Tasks: validate (availability, workload)
    Tasks->>DB: assign
    Tasks->>Notify: notify crew
  end
  Svc->>Audit: decision, model version, correlation id
```

## Figure 19: AI data processing and integration flow

What the core sends to each module, what the module stores or reads, and what comes
back. The AIM does not read core tables.

```mermaid
%%{init: {"flowchart": {"curve": "step", "nodeSpacing": 25}}}%%
flowchart LR
  subgraph Core["Core system"]
    direction TB
    c1["Image keys and context"]
    c2["Chat message and role"]
    c3["Fact set"]
    c4["Points file"]
    c5["Candidate crews and vehicles"]
    tables[("Core tables<br/>Reports, Tasks, Users")]
    review["Human review<br/>of flagged results"]
  end
  subgraph AIM["AI Intelligence Module (boundary)"]
    direction TB
    m1["Vision analysis"]
    m2["Assistant"]
    m3["Analytics narrator"]
    m4["Hotspot engine"]
    m5["Recommendation"]
    m6["Integration and decision engine:<br/>contract, versions, logging"]
  end
  subgraph Stores["AIM stores"]
    direction TB
    s1[("S3 images and artefacts")]
    s2[("AI results")]
    s3[("Model registry")]
    s4[("Knowledge base")]
    s5[("Logs")]
    s6[("Feedback dataset")]
  end
  out["Results to the core:<br/>analysis, answer or tool request,<br/>narrative, hotspots,<br/>ranked recommendations"]

  c1 --> m1
  c2 --> m2
  c3 --> m3
  c4 --> m4
  c5 --> m5
  m1 & m2 & m3 & m4 & m5 --> m6
  m1 --> s1
  m2 --> s4
  m6 --> s2
  m6 --> s3
  m6 --> s5
  m6 --> out
  out --> review
  review -- "corrections with consent" --> s6
  s6 -.->|next model version| s3
  tables ~~~ AIM
```

The invisible link only keeps the core tables beside the boundary: no arrow crosses from
the AIM into them.

## Figure 20: waste image analysis workflow

The operational path of a report's images, naming components, queues and stores
(the decision logic is figure 6).

```mermaid
%%{init: {"flowchart": {"curve": "step"}}}%%
flowchart LR
  ev["S3 event:<br/>files confirmed at submit"] --> val["Validate and moderate"]
  val --> dup["Duplicate check<br/>50 m, 72 h"]
  dup --> q[["SQS queue<br/>AI step"]]
  q -- "after 3 failures" --> dlq[["Dead-letter queue"]]
  q --> worker["AIM vision worker"]
  worker --> model["Nova Lite (candidate)<br/>or Rekognition"]
  model --> worker
  worker --> store[("AI Analysis store")]
  worker --> rq[["Results queue"]]
  rq --> resume["Resume state machine<br/>(task token)"]
  resume --> rules["Rule engine:<br/>final priority"]
  rules --> task["Create task"] --> assign["Assign crew"] --> notify["Notify"]
  rules -- "review flag" --> rev[["Review queue"]]
  budget["Step budget reached<br/>(60 s target)"] -.-> fb["Fallback:<br/>category default priority,<br/>review flag"]
  fb --> rules
```

## Figure 21: AI chatbot and knowledge retrieval workflow

Knowledge preparation and the runtime path of a chat turn (the decision logic is
figure 7).

```mermaid
%%{init: {"flowchart": {"curve": "step"}}}%%
flowchart TB
  subgraph Prep["Knowledge preparation"]
    direction LR
    doc["Document approved<br/>by an administrator"] --> tag["Tag audience:<br/>public, citizen, crew, admin"]
    tag --> chunk["Chunk"] --> index["Index"] --> ver["Version"]
    ver --> kb[("Knowledge base")]
  end
  subgraph Run["Chat turn at runtime"]
    direction LR
    msg["User message"] --> lang["Detect language"] --> claims["Read role claims"]
    claims --> gin["Input guardrails"] --> ret["Retrieve, filtered<br/>by audience"]
    ret --> call["Model call"]
    call -- "tool request" --> exec["Core tool executor"]
    exec --> db[("Database")]
    exec --> call
    call --> gout["Output guardrails"] --> ans["Answer citing<br/>document titles"]
    ans --> sess[("Session store<br/>with time-to-live")]
  end
  kb --> ret
  ans -.->|unanswered questions| mon["Monitoring"]
  mon -.->|new or updated documents| doc
```

## Figure 22: AI-generated analytics workflow

Scheduled and on-demand analytics across components (the decision logic is figure 8).

```mermaid
%%{init: {"flowchart": {"curve": "step"}}}%%
flowchart LR
  sched["EventBridge schedules<br/>weekly, monthly"] --> job
  admin["Administrator request"] --> job
  job["Deterministic query job"] --> facts[("Fact set in S3")]
  facts --> narr["AIM narrator"] --> verif["AIM verifier"]
  verif -- "numbers match" --> rep[("AI Report store")]
  verif -- "failed twice" --> tmpl["Template fallback"] --> rep
  rep --> appr["Administrator approval"] --> pub["Publication"]
  pub --> exp["Export through<br/>pre-signed address"]
  q["Questions about statistics<br/>(assistant)"] --> tools["Metric tools<br/>(same queries)"]
  tools --> facts
```

## Figure 23: pollution and waste hotspot intelligence workflow

From report coordinates to stored hotspots and where they are used (the decision logic
is figure 9).

```mermaid
%%{init: {"flowchart": {"curve": "step"}}}%%
flowchart LR
  reports[("Reports table")] --> points[("Points file in S3")]
  config[("Configuration:<br/>window, radius, minimum")] --> engine
  points --> engine["AIM hotspot engine"]
  engine --> classes["Class A and class B<br/>(class C not produced)"]
  classes --> hs[("Hotspot store")]
  classes --> obs[("Hotspot Observation store")]
  hs --> map["Admin map"]
  hs --> att["Attention list"]
  obs --> ana["Analytics reports"]
  hs --> tool["Assistant tool"]
```

## Figure 24: intelligent crew and vehicle allocation workflow

How recommendations fit into assignment and approval, and where the backend keeps
authority (the decision logic is figure 10).

```mermaid
%%{init: {"flowchart": {"curve": "step"}}}%%
flowchart LR
  created["Task created<br/>by the pipeline"] --> mode{"Mode switch<br/>(D-03, to be decided)"}
  mode -- "default" --> auto["Automatic assignment<br/>(BR-005)"]
  mode -- "recommend first" --> cand["Candidate data"]
  crew[("Crew store")] --> cand
  veh[("Vehicle store")] --> cand
  tasks[("Task store")] --> cand
  cand --> aim["AIM crew and vehicle<br/>recommendation"]
  aim --> rec[("Recommendation store")]
  rec --> admin["Administrator decision:<br/>confirm, change or reject"]
  admin --> svc["Tasks service assignment<br/>(the only writer)"]
  auto --> svc
  svc --> audit[("Audit log")]
  svc --> notify["Notification to the crew"]
```
