<div align="center">

# MAGNIVONIC

### The Organizational Intelligence Layer for the Enterprises.

[Live Platform](https://magnivonic.vercel.app/) · [AWS Bedrock](https://aws.amazon.com/bedrock/) · [Nova Pro](https://aws.amazon.com/bedrock/nova/)

![Lambda](https://img.shields.io/badge/AWS%20Lambda-15%20functions-orange)
![Aurora](https://img.shields.io/badge/Aurora%20Serverless%20v2-pgvector%201024--dim%20HNSW-purple)
![Bedrock](https://img.shields.io/badge/Bedrock-Nova%20Pro%20%2B%20Titan%20V2-blue)
![Polly](https://img.shields.io/badge/Amazon%20Polly-neural%20voice-green)

*Built for the H0 "Hack the Zero Stack" hackathon — AWS × Vercel, Monetizable B2B App track.*

</div>

---

## What Magnivonic Does

Magnivonic is a fully serverless, multi-agent **organizational intelligence layer**.
Four domain agents — Revenue, Operations, Customer, and Security — read every part
of a business **in parallel** on AWS Lambda. A **Chief of Staff** agent aggregates
their findings into one context package; a **General Manager** agent reasons across
that package with Amazon Bedrock Nova Pro and emits **typed executive insights**
(Risk, Opportunity, Coordination Gap, Drift), each with a recommended action, a
**real computed confidence**, the cross-domain evidence behind it, and a precedent
recalled from the organization's own memory via Aurora pgvector. The user can ask
the engine anything in plain language (Debrief) — and have the answer **read back
aloud** with Amazon Polly. The value is the connective tissue: a security anomaly,
a support surge, a falling health score, and an imminent renewal on the *same
account* are recognized as one cascading event, not four disconnected tickets.

---

## The AWS Database — Aurora PostgreSQL + pgvector (the core of the system)

Magnivonic runs on **Amazon Aurora PostgreSQL Serverless v2 with the `pgvector`
extension** as its single source of truth — doing **two jobs in one managed
engine**:

1. **Relational store** — customers, pipeline deals, risks, recommendations,
   agent events, Slack alerts, support tickets.
2. **Vector store** — `organizational_memory.embedding` as `vector(1024)` behind
   an **HNSW** index (`vector_cosine_ops`), queried by cosine similarity on every
   analysis run.

**Why this matters:** cross-domain reasoning needs both the *facts* and *semantic
recall over past incidents*. Aurora + pgvector keeps them in **one transactional
store**, so an insight and the precedent it cites are never out of sync — **no
separate vector database** to provision, sync, or pay for. Recall is an HNSW
nearest-neighbour lookup (cost grows logarithmically), so the same schema serves
20 incidents or tens of thousands, and **Aurora Serverless v2 autoscales compute
on demand** with each agent run. This is the deliberate database decision at the
heart of the product.

---

## Why It Is Different

- **Typed insights, not a wall of alerts** — every finding is classified as exactly one of Risk · Opportunity · Coordination Gap · Drift, so the output reads like an executive's mental model
- **Real computed scoring** — Security and Operations are deterministic auditable formulas; Revenue and Customer scores are computed **in code** (Nova Pro only narrates); the General Manager's confidence is a real corroboration-weighted formula — **every formula is printed in the product** on a dedicated Confidence page
- **Cross-domain reasoning** — four domains read in parallel via `ThreadPoolExecutor`, unified and reasoned over as one picture, not one dashboard at a time
- **Organizational memory that compounds** — past incidents (including real call-transcript and voice-note evidence) embedded with Titan V2 and recalled by pgvector cosine similarity on every run
- **Evidence before answer** — Debrief shows its sources first; every claim traces to live evidence and ranked past incidents
- **Real second output modality** — Amazon Polly converts a Debrief answer to speech (Nova Pro reasons; Polly speaks)
- **"Already connected"** — no upload, no migration; you confirm the connections and the engine starts reasoning

---

## Architecture

```
┌─────────────────────── FRONTEND  ·  Vercel ────────────────────────┐
│   Marketing site (built with v0)   +   Live platform (login-gated)  │
│              Next.js 16  ·  Turbopack  ·  Tailwind v4               │
└──────────────────────────────┬─────────────────────────────────────┘
                               │  HTTPS / JSON
┌──────────────────────── API LAYER ─────────────────────────────────┐
│                 Amazon API Gateway  (REST · prod)                  │
│   GET  /health /customers /risks /github /slack /memory            │
│   POST /analyze        /debrief        /speak                       │
└──────┬──────────────────────┬───────────────────────┬──────────────┘
       │ POST /analyze         │ POST /debrief          │ POST /speak
       ▼                       ▼                        ▼
┌──────────────── AGENT LAYER  ·  AWS Lambda (Python 3.12) ───────────┐
│   General Manager (orchestrator)                                    │
│        └─ invokes ─► Chief of Staff (coordinator)                   │
│                          └─ ThreadPoolExecutor(max_workers=4) ─┐    │
│        ┌───────────┬───────────┬───────────┬───────────┐       │    │
│      Revenue    Operations   Customer    Security  ◄───────────┘    │
│     (formula)  (GitHub +     (formula)  (deterministic)             │
│                 formula)                                            │
└──────┬────────────────────────┬───────────────────────┬────────────┘
       │ PostgreSQL wire (TCP)   │ Bedrock Runtime API    │ Polly API
       ▼                         ▼                        ▼
┌──── DATA LAYER ─────────┐ ┌─ AI / ML · Bedrock ──┐ ┌── VOICE ──────┐
│ Aurora PostgreSQL       │ │ Nova Pro  (reasoning) │ │ Amazon Polly  │
│ Serverless v2 + pgvector│ │ Titan Embed V2 (1024) │ │ neural → MP3  │
│ relational + HNSW index │ └──────────────────────┘ └───────────────┘
└─────────────────────────┘
   Secrets Manager · EventBridge · IAM   (supporting)   GitHub · Slack
```

**Zones:** Frontend (Vercel) → API Layer (API Gateway) → Agent Layer (Lambda) →
Data Layer (Aurora + pgvector) + AI/ML (Bedrock) + Voice (Polly).

---

## The Agents

| Agent | Reads | Scoring | Engine |
|-------|-------|---------|--------|
| Revenue | Renewal exposure, ARR, health, sentiment | Weighted formula (code) | Nova Pro narrates |
| Operations | Real GitHub: PRs, blockers, CI, velocity | Additive formula (code) | Deterministic |
| Customer | Six churn signals | Signal-severity formula (code) | Nova Pro narrates |
| Security | Access / API anomalies | Additive formula (code) | Deterministic, auditable |
| **Chief of Staff** | All four, in parallel | Severity-weighted combined confidence | Coordinator |
| **General Manager** | The unified package + memory | Corroboration-weighted confidence | Nova Pro (hero) |

The four domain agents are fired in parallel from a single Lambda invocation
(never a sequential chain); a full cross-domain synthesis runs ~8s warm.

---

## Real Computed Scoring

Every number is a real formula in code, or an LLM judgment that is labelled as
such — never a fabricated formula. All are printed on the in-product Confidence page.

```
security_score   = min(1.0, anomaly×0.35 + API-spike tier + off-hours(0.10)
                            + export tier + failed-auth tier + unusual-IP tier)

delivery_risk    = min(1.0, min(0.25, PRs×0.05) + min(0.30, blockers×0.15)
                            + min(0.20, CI×0.10) + (velocity↓ ? 0.15 : 0))

revenue_risk     = 0.40·renewal-urgency + 0.30·health-gap
                 + 0.15·(1 − close-prob) + 0.15·neg-sentiment

churn_risk       = min(1.0, Σ(six signals scored 0/1/2) ÷ 8)

GM confidence    = max(0.30, 0.5·breadth + 0.5·severity-weighted-strength)
                   breadth = (corroborating domains) / 4
```

`overall_score` (0–100 magnitude) and the insight-type classification stay the
model's judgment, labelled as such. Similarity is real pgvector cosine; ≥ 0.35 is
treated as relevant.

---

## Organizational Memory

Past incidents are embedded with **Amazon Titan Embed V2** over a 3-field
concatenation (`summary + outcome + lessons_learned`) and stored as `vector(1024)`
in Aurora behind an **HNSW** index (cosine). On every run the General Manager
retrieves the most similar precedents and folds their lessons into the
recommendation. The corpus includes realistic **call-transcript** and **voice-note**
evidence; the Organizational Memory page can play a synthesized reading of a voice
note (clearly labelled as a Polly reading, not the original recording) and reveal a
full call transcript on demand.

---

## Tech Stack

**Backend & Infrastructure**

Python 3.12 · AWS Lambda ×15 (6 agents + 9 API handlers) · Amazon API Gateway (REST)
· **Aurora PostgreSQL Serverless v2 + pgvector** · Amazon Bedrock Nova Pro · Amazon
Titan Embed V2 · **Amazon Polly** (neural) · Amazon EventBridge · AWS Secrets Manager
· AWS IAM · GitHub API · Slack

**Frontend**

Next.js 16 · TypeScript · Turbopack · Tailwind CSS v4 · Framer Motion · SWR ·
**built with [v0](https://v0.dev)** and **deployed on Vercel**

> The database choice — **Aurora PostgreSQL + pgvector** doing relational *and*
> vector work in one managed engine — is detailed prominently near the top of this
> README. It is the core architectural decision.

---

## Business Model

Magnivonic is a **horizontal B2B intelligence layer**, sold per-seat to the people
who make cross-functional decisions (Chief of Staff, RevOps, VP Eng, Heads of
CS/Security) — the roles that today stitch this picture together by hand.

- **Per-seat SaaS** for decision-makers, with usage-based analysis runs.
- **Land-and-expand:** start with one team's connectors (CRM + support), expand
  across Security/Engineering as the cross-domain value compounds.
- **Cost structure favours it:** fully serverless — Lambda, Aurora Serverless v2,
  and Bedrock all scale to zero / on demand, so margin holds at low volume and the
  same core platform serves SaaS, healthcare, public sector, and financial
  services without a rebuild.
- **The moat is the memory:** every run makes the organization's own memory
  sharper, so switching cost rises the longer a customer stays — a compounding,
  defensible asset, not a commodity dashboard.

---

## Project Structure

```
magnivonic/
├── backend/
│   ├── agents/          revenue · operations · customer · security
│   │                    coordinator (Chief of Staff) · orchestrator (General Manager)
│   ├── api/             9 handlers: analyze · debrief · speak · customers
│   │                    risks · github · slack · memory · health
│   ├── layer/python/    shared layer: db · bedrock · secrets · events
│   └── scripts/         setup_aurora.sql · seed_data.py · embed_memory.py · deploy.sh
├── frontend/
│   ├── app/             marketing homepage · platform/* (11 pages) · login · api/*
│   ├── components/      home/* · platform/* · brand.tsx
│   ├── lib/             api.ts · activation.ts · auth.ts
│   └── proxy.ts         Next 16 proxy — the /platform/* login gate
└── docs/                CLAUDE.md · PROGRESS.md · PROJECT_GUIDE.md · SCHEMA.md
```

---

## Key Design Decisions

- **Aurora + pgvector over a separate vector DB** — one store for facts *and* memory; an insight and the precedent it cites never go out of sync
- **Parallel domain agents** — `ThreadPoolExecutor` + RequestResponse Lambda invokes keep `/analyze` synchronous at ~8s warm, never an EventBridge fan-out
- **Real computed scores, Nova narrates** — the model explains the numbers, it never invents them; defensible under technical scrutiny
- **Security is deterministic by design** — security findings must be auditable, not probabilistic (knowing when *not* to use an LLM)
- **Nova Pro over third-party models** — first-party Bedrock, available across all AWS account types and regions; Polly handles voice output since Nova Pro is input-multimodal only
- **3-field memory embedding** — adding outcome + lesson to the summary gives retrieval more semantic surface
- **Titan V2 is 1024-dim** — the embedding column is `vector(1024)`, HNSW cosine

---

## Live Demo

**[magnivonic.vercel.app](https://magnivonic.vercel.app/)**

The live platform is login-gated (it fires real AWS/Bedrock calls); the marketing
site is public. Inside, confirm the connections and run a real analysis — watch the
four domain agents fire in parallel, the Chief of Staff and General Manager
synthesize typed insights, expand a card to see its cross-domain evidence and
computed confidence, ask Debrief a question and have the answer read back aloud, and
explore the compounding organizational memory.

---
