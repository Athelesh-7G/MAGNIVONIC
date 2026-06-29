# Magnivonic — Architecture Diagram Specification

A precise, complete technical specification for rendering the architecture diagram
(hackathon "Architecture diagram" field). **Every component and connection below
was re-verified against the real current codebase.** This is a written spec, not an
image — hand it directly to a diagramming step.

Region: **us-east-1**. Account: **082228066878**.

---

## 1. Logical zones (propose as visual groupings)

| Zone | Contains |
|------|----------|
| **A. Client / Vercel** | User browser; Next.js app (marketing + platform); login gate; auth route handlers |
| **B. API Layer** | Amazon API Gateway (REST, prod) |
| **C. Agent Layer (AWS Lambda)** | 9 API-handler Lambdas + 6 agent Lambdas (General Manager, Chief of Staff, 4 domain agents) |
| **D. Data Layer** | Aurora PostgreSQL Serverless v2 + pgvector |
| **E. AI / ML (Amazon Bedrock)** | Nova Pro; Titan Embed V2 |
| **F. Voice** | Amazon Polly |
| **G. Supporting AWS** | Secrets Manager; EventBridge; IAM |
| **H. External integrations** | GitHub API; Slack (incoming webhook) |

---

## 2. Components (node list)

### Zone A — Client / Vercel
- **A1 · Browser** — end user.
- **A2 · Next.js 16 app (on Vercel)** — one app, two surfaces: **marketing site** (public; marketing pages generated with **v0**) and **live platform** (`/platform/*`, gated). Calls the API over HTTPS via `lib/api.ts`.
- **A3 · Login gate (`proxy.ts`)** — Next.js proxy/middleware; intercepts every `/platform/*` request and redirects to `/login` unless a valid signed `mv_session` cookie is present.
- **A4 · Auth route handlers (`/api/login`, `/api/logout`)** — Next.js server-side routes; validate credentials against env vars (`ADMIN_USERNAME`/`ADMIN_PASSWORD`), issue/clear the HMAC-signed httpOnly `mv_session` cookie (+ readable `mv_user`).

### Zone B — API Layer
- **B1 · Amazon API Gateway (REST, `prod` stage, id `tjysjf32v9`)** — 9 routes:
  GET `/health` `/customers` `/risks` `/github` `/slack` `/memory` · POST `/analyze` `/debrief` `/speak`. Lambda-proxy (`AWS_PROXY`) integration on each.

### Zone C — Agent Layer (AWS Lambda, Python 3.12, shared layer `magnivonic-common-layer:4`)
API-handler Lambdas (one per route):
- **C1 · `magnivonic-api-analyze`** — entry point for a full run; invokes the orchestrator.
- **C2 · `magnivonic-api-debrief`** — NL question → cited answer (self-contained: embed + pgvector + Nova).
- **C3 · `magnivonic-api-speak`** — text → speech via Polly.
- **C4 · `magnivonic-api-customers`**, **C5 · `-risks`**, **C6 · `-memory`** — read Aurora.
- **C7 · `magnivonic-api-github`** — reads GitHub API.
- **C8 · `magnivonic-api-slack`** — reads `slack_alerts` (GET) and sends Block Kit messages (POST).
- **C9 · `magnivonic-api-health`** — Aurora ping.

Agent Lambdas:
- **C10 · `magnivonic-orchestrator-agent` — "General Manager"** (hero): invokes the coordinator, searches memory (Titan + pgvector), synthesizes typed insights with Nova Pro, writes to Aurora, notifies Slack, publishes to EventBridge.
- **C11 · `magnivonic-coordinator-agent` — "Chief of Staff"**: fires the 4 domain agents in parallel and aggregates into one context package; writes `coordinator_contexts`.
- **C12 · `magnivonic-revenue-agent`** — renewal-risk; Nova Pro narrates, score computed in code; reads/writes Aurora.
- **C13 · `magnivonic-customer-agent`** — churn-risk; Nova Pro narrates, score computed in code; reads/writes Aurora.
- **C14 · `magnivonic-operations-agent`** — delivery-risk; **deterministic** (no Bedrock); reads **GitHub API**, writes Aurora.
- **C15 · `magnivonic-security-agent`** — access/API anomalies; **deterministic** (no Bedrock); reads/writes Aurora.

### Zone D — Data Layer
- **D1 · Aurora PostgreSQL Serverless v2 + pgvector** (cluster `magnivonic-dev`) — relational tables (customers, pipeline_deals, security_events, agent_events, coordinator_contexts, risks, recommendations, slack_alerts, support_tickets) **and** `organizational_memory.embedding vector(1024)` behind an **HNSW** index (`vector_cosine_ops`).

### Zone E — AI / ML (Amazon Bedrock)
- **E1 · Nova Pro** (`us.amazon.nova-pro-v1:0`) — reasoning / synthesis / narration.
- **E2 · Titan Embed V2** (`amazon.titan-embed-text-v2:0`) — 1024-dim embeddings.

### Zone F — Voice
- **F1 · Amazon Polly** (neural, voice `Matthew`) — text → MP3.

### Zone G — Supporting AWS
- **G1 · Secrets Manager** — `magnivonic/aurora`, `magnivonic/github-pat`, `magnivonic/slack-webhook`.
- **G2 · EventBridge** (`magnivonic-events`) — background event bus.
- **G3 · IAM role `magnivonic-lambda-role`** — assumed by all Lambdas.

### Zone H — External
- **H1 · GitHub API** — repo `Athelesh-7G/magnivonic-demo` (PRs, blocker issues, CI, commit velocity).
- **H2 · Slack** — incoming webhook (executive alerts + Block Kit templates).

---

## 3. Connections (edge list — direction · protocol)

**Client → API**
1. A1 Browser → A2 Next.js (Vercel): **HTTPS** (page loads).
2. A3 proxy.ts gates A2 `/platform/*`: redirect → `/login` if no `mv_session` (in-app).
3. A2 → A4 `/api/login`: **HTTPS POST** (JSON creds) → sets `mv_session` httpOnly cookie.
4. A2 (`lib/api.ts`) → B1 API Gateway: **HTTPS** GET/POST, JSON body.

**API Gateway → Lambda** (all **AWS_PROXY**, synchronous Lambda invoke)
5. B1 `/analyze` → C1; `/debrief` → C2; `/speak` → C3; `/customers` → C4; `/risks` → C5; `/memory` → C6; `/github` → C7; `/slack` → C8; `/health` → C9.

**The /analyze cascade**
6. C1 api-analyze → C10 orchestrator: **Lambda Invoke (RequestResponse)**.
7. C10 orchestrator → C11 coordinator: **Lambda Invoke (RequestResponse)**.
8. C11 coordinator → C12, C13, C14, C15 (4 domain agents): **parallel Lambda Invoke (RequestResponse)** via `ThreadPoolExecutor(max_workers=4)`.
9. C12 revenue → E1 Nova Pro: **Bedrock Runtime InvokeModel (HTTPS)**; C12 → D1 Aurora: **PostgreSQL wire (TCP 5432, SSL)** (read customers/deals, write `agent_events`).
10. C13 customer → E1 Nova Pro (Bedrock Runtime) + D1 Aurora (PostgreSQL wire).
11. C14 operations → H1 GitHub API: **HTTPS REST**; C14 → D1 Aurora (write `agent_events`); C14 → G1 Secrets Manager (`github-pat`). **No Bedrock.**
12. C15 security → D1 Aurora (read `security_events`/customers, write `agent_events`). **No Bedrock.**
13. C11 coordinator → D1 Aurora: write `coordinator_contexts` (PostgreSQL wire).
14. C10 orchestrator → E2 Titan Embed V2: **Bedrock Runtime** (embed the evidence query).
15. C10 orchestrator → D1 Aurora: **pgvector cosine similarity** query (`embedding <=> query`, HNSW) over PostgreSQL wire.
16. C10 orchestrator → E1 Nova Pro: **Bedrock Runtime** (synthesize typed insights).
17. C10 orchestrator → D1 Aurora: write `risks`, `recommendations`, `slack_alerts` (PostgreSQL wire).
18. C10 orchestrator → H2 Slack: **HTTPS POST** to incoming webhook (URL from G1 Secrets Manager).
19. C10 orchestrator → G2 EventBridge: **PutEvents** (`ExecutiveBriefReady`).

**Debrief (self-contained, not via orchestrator)**
20. C2 debrief → E2 Titan Embed V2 (embed question) → D1 Aurora pgvector search → E1 Nova Pro (answer). Bedrock Runtime + PostgreSQL wire.

**Speak**
21. C3 speak → F1 Amazon Polly: **SynthesizeSpeech (HTTPS)** → returns base64 MP3 in the JSON response.

**Read endpoints**
22. C4/C5/C6 → D1 Aurora (PostgreSQL wire).
23. C7 github → H1 GitHub API (HTTPS) + G1 Secrets Manager.
24. C8 slack → D1 Aurora (read `slack_alerts`) + H2 Slack webhook (POST send) + G1 Secrets Manager.
25. C9 health → D1 Aurora (ping).

**Cross-cutting (apply to all Lambdas)**
26. Every Lambda → G1 Secrets Manager: fetch `magnivonic/aurora` creds before any DB call (HTTPS).
27. Every Lambda assumes G3 IAM role `magnivonic-lambda-role` (grants `lambda:InvokeFunction` on `magnivonic-*-agent`, `polly:SynthesizeSpeech`, Bedrock, Secrets, Aurora access).
28. All DB connections to D1 are **PostgreSQL wire protocol, TCP 5432, SSL** (psycopg2 pool in the shared layer).

---

## 4. Diagramming notes

- **Flow direction:** top → bottom — Client (Vercel) → API Gateway → Agent Layer → {Data, AI/ML, Voice}. Supporting AWS (Secrets/EventBridge/IAM) sits to the side; External (GitHub/Slack) to the side of the Agent Layer.
- **Emphasize the cascade fan-out:** orchestrator → coordinator → **4 parallel domain agents** (show the ThreadPoolExecutor parallelism as 4 simultaneous arrows).
- **Emphasize Aurora (D1) as the hub:** it's both the relational store and the vector store — most agents and read endpoints connect to it; the orchestrator's pgvector query is the memory-recall edge. (This is the headline AWS-database story; make D1 visually central/prominent.)
- **Label model edges with the model id:** Nova Pro `us.amazon.nova-pro-v1:0`, Titan Embed V2 `amazon.titan-embed-text-v2:0`.
- **Distinguish agent kinds:** revenue & customer touch Bedrock (Nova); operations & security are deterministic (no Bedrock) — operations reaches out to GitHub, security stays within Aurora.
- **Do not** draw a Bedrock edge from operations or security, and **do not** route debrief/speak through the orchestrator — they are independent paths.
