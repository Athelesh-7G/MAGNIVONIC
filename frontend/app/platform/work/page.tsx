import { PageHeader } from '@/components/platform/page-header'
import { OK } from '@/components/platform/signal-ui'

export const metadata = { title: 'The Work — Magnivonic' }

function Section({ kicker, title, children }: { kicker: string; title: string; children: React.ReactNode }) {
  return (
    <section className="rounded-xl border border-border bg-card/60 p-5">
      <p className="text-[11px] uppercase tracking-widest text-primary mb-1">{kicker}</p>
      <h2 className="text-base font-semibold text-foreground mb-2">{title}</h2>
      <div className="text-sm text-muted-foreground leading-relaxed space-y-2">{children}</div>
    </section>
  )
}

function Stat({ value, label }: { value: string; label: string }) {
  return (
    <div className="rounded-lg border border-border bg-background/50 px-4 py-3">
      <p className="text-xl font-bold tracking-tight text-foreground tabular-nums">{value}</p>
      <p className="text-xs text-muted-foreground mt-0.5">{label}</p>
    </div>
  )
}

export default function WorkPage() {
  return (
    <div className="px-6 py-8 max-w-[940px] mx-auto">
      <PageHeader
        eyebrow="The Record"
        title="The Work"
        subtitle="The real technical build behind Magnivonic — the architecture, the measured numbers, and the engineering decisions. Built for the H0 Hackathon (AWS × Vercel), Monetizable B2B App track. Everything here is true of the system running right now."
      />

      <div className="grid sm:grid-cols-3 gap-3 mt-8">
        <Stat value="6" label="agents, two-tier hierarchy" />
        <Stat value="4-way" label="parallel domain execution" />
        <Stat value="~8s" label="warm end-to-end synthesis" />
      </div>

      <div className="mt-4 space-y-4">
        <Section kicker="Architecture" title="Cross-domain synthesis, not a dashboard">
          <p>
            Four domain agents — Revenue, Operations, Customer, Security — each read their own corner of the
            business and emit structured evidence. A <span className="text-foreground">Chief of Staff</span>{' '}
            (Coordinator) aggregates the four findings into one context package. A{' '}
            <span className="text-foreground">General Manager</span> (Orchestrator) reasons across that package
            and emits <span className="text-foreground">typed insights</span> — Risk, Opportunity, Coordination
            Gap, or Drift — each with severity, cross-domain connections, recommended actions, and a historical
            precedent. The value is the connective tissue: a security anomaly, a support surge, a falling health
            score, and an imminent renewal on the <em>same account</em> are recognized as one cascading event,
            not four tickets.
          </p>
        </Section>

        <Section kicker="Concurrency" title="Four agents in parallel, on one invocation">
          <p>
            The Coordinator fires all four domain agents simultaneously with a{' '}
            <span className="font-mono text-[13px] text-foreground">ThreadPoolExecutor(max_workers=4)</span> over
            RequestResponse Lambda invokes — never a sequential chain. Reading the four domains concurrently
            instead of in series is what keeps a full cross-domain synthesis (API Gateway → Orchestrator →
            Coordinator → 4 agents → Nova Pro → Aurora write) at{' '}
            <span className="text-foreground">~8s end-to-end</span>; the pgvector lookup against the memory table
            is negligible next to the Nova Pro reasoning call, which is the real floor on latency.
          </p>
        </Section>

        <Section kicker="Scoring" title="Real computed scores — not the model guessing numbers">
          <p>
            Most numbers Magnivonic shows are deterministic formulas in code, reproducible from their inputs:
          </p>
          <ul className="list-disc pl-5 space-y-1">
            <li><span className="text-foreground">Security &amp; Operations</span> — additive rule-based formulas over real telemetry and live GitHub signals. No model judgment, fully auditable.</li>
            <li><span className="text-foreground">Revenue &amp; Customer</span> — weighted / signal-severity formulas from the real account metrics (renewal window, health, close-probability, sentiment; the six churn signals).</li>
            <li><span className="text-foreground">General Manager confidence</span> — a corroboration-weighted formula: how many of the four domains corroborate an insight, blended with their severity-weighted confidence.</li>
          </ul>
          <p>
            Amazon Nova Pro&apos;s job is <span className="text-foreground">reasoning and narration</span> — finding
            the cross-domain pattern, classifying the insight type, and explaining the computed scores in plain
            language. It does not invent the numbers. Every formula is printed on the{' '}
            <a href="/platform/confidence" className="text-primary hover:underline">Confidence</a> page.
          </p>
        </Section>

        <Section kicker="Memory" title="Organizational memory that compounds">
          <p>
            Past incidents are embedded with <span className="text-foreground">Amazon Titan Embed V2</span> into
            1024-dimension vectors and stored in <span className="text-foreground">Aurora PostgreSQL + pgvector</span>{' '}
            behind an HNSW index using cosine distance. The embedding deliberately concatenates{' '}
            <span className="font-mono text-[13px] text-foreground">summary + outcome + lessons_learned</span> —
            a 3-field strategy that gives retrieval more semantic surface than the summary alone, so a match can
            be driven by what was <em>done</em> and <em>learned</em>, not just what happened. Against the current
            memory set, live cross-domain queries retrieve their closest precedent at roughly{' '}
            <span className="text-foreground" style={{ color: OK }}>0.40–0.49</span> cosine similarity — the
            engine treats <span className="text-foreground">≥ 0.35</span> as genuinely relevant. On every run the
            General Manager pulls the most similar past events and folds their lessons into the recommendation.
          </p>
        </Section>

        <Section kicker="AWS" title="How the services are actually used">
          <ul className="list-disc pl-5 space-y-1">
            <li><span className="text-foreground">AWS Lambda (Python 3.12)</span> — all 6 agents + the API handlers, on a shared layer.</li>
            <li><span className="text-foreground">Amazon Bedrock — Nova Pro</span> (<span className="font-mono text-[12px]">us.amazon.nova-pro-v1:0</span>) for synthesis/narration; <span className="text-foreground">Titan Embed V2</span> for memory vectors.</li>
            <li><span className="text-foreground">Aurora PostgreSQL Serverless v2 + pgvector</span> — both the relational store (customers, risks, recommendations, agent_events, slack_alerts) and the HNSW vector index for memory.</li>
            <li><span className="text-foreground">API Gateway (REST)</span> — the judge-facing endpoints; <span className="text-foreground">EventBridge</span> for background agent events; <span className="text-foreground">Secrets Manager</span> for Aurora / GitHub PAT / Slack webhook.</li>
            <li>Real outbound integrations: <span className="text-foreground">GitHub API</span> (live delivery signals) and <span className="text-foreground">Slack</span> (executive alerts).</li>
          </ul>
        </Section>

        <Section kicker="Resilience" title="Graceful degradation by design">
          <p>
            Every agent returns a structured fallback rather than crashing the run: a parse failure or a missing
            signal yields low-confidence fallback evidence, so one bad agent never takes down the cascade. The
            memory search returns an empty set (not an error) if embedding is unavailable. The Slack notifier
            logs <span className="font-mono text-[13px]">slack_secret_missing</span> and the pipeline completes
            normally if no webhook is configured. Warm-up pings are guarded so they cost nothing.
          </p>
        </Section>

        <Section kicker="Data architecture" title="Why Aurora + pgvector — chosen for this exact problem">
          <p>
            Cross-domain reasoning needs two things from one store: the relational facts (accounts, risks,
            recommendations, agent events, alerts) <em>and</em> semantic recall over past incidents.{' '}
            <span className="text-foreground">Aurora PostgreSQL Serverless v2 + pgvector</span> does both in a
            single managed engine — so an insight and the memory it cites live in the same transactional store,
            with no separate vector database to provision, sync, or keep consistent. That was a deliberate
            architectural choice, not a convenience: it&apos;s what makes &ldquo;reason now, grounded in what
            happened before&rdquo; a single query instead of a distributed join.
          </p>
          <p>
            It also scales the way this problem grows. Memory recall is an{' '}
            <span className="text-foreground">HNSW</span> index lookup — an approximate nearest-neighbour search
            whose cost grows logarithmically, not linearly — so the same architecture serves twenty incidents or
            tens of thousands without a schema change, and a larger memory corpus <em>improves</em> retrieval
            quality (more precedents to match) rather than slowing it down. Aurora Serverless v2 autoscales
            compute on demand to absorb bursts of concurrent agent runs, and the design leaves clear headroom to
            add read replicas as an organization&apos;s signal volume climbs.
          </p>
        </Section>

        <Section kicker="Frontend" title="One operating system, two surfaces">
          <p>
            A public marketing site and the gated live platform (this app) share one identity, built on{' '}
            <span className="text-foreground">Next.js 16</span> + Turbopack and deployed on{' '}
            <span className="text-foreground">Vercel</span>. The platform talks only to the real AWS endpoints —
            every score, citation, and alert on these pages comes from a live call, not a fixture.
          </p>
        </Section>
      </div>

      <p className="mt-6 text-xs text-muted-foreground/70">
        H0 Hackathon · AWS × Vercel · Monetizable B2B App track. Account 082228066878 · us-east-1.
      </p>
    </div>
  )
}
