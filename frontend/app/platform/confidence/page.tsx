import { PageHeader } from '@/components/platform/page-header'
import { OK } from '@/components/platform/signal-ui'

type Score = {
  id: string
  name: string
  where: string
  computed: boolean
  formula: string
  body: string
  routing?: string
}

// Every number Magnivonic shows, with the REAL account of where it comes from.
// "Computed" = a deterministic formula in code. "Model judgment" = Amazon Nova
// Pro's holistic call (kept categorical / qualitative, never dressed as math).
const SCORES: Score[] = [
  {
    id: 'security',
    name: 'Security score',
    where: 'Security agent · Security team page · Chief of Staff panel',
    computed: true,
    formula:
      'security_score = min(1.0,\n    anomaly × 0.35\n  + API-spike tier   (≥50×→0.30 · ≥20×→0.20 · ≥5×→0.10 · ≥2×→0.05)\n  + off-hours access (0.10)\n  + data-export tier (≥1GB→0.15 · ≥500MB→0.10 · ≥100MB→0.05)\n  + failed-auth tier (≥10→0.10 · ≥5→0.05)\n  + unusual-IPs tier (≥5→0.10 · ≥2→0.05) )',
    body:
      'Fully deterministic — no model judgment. Every point traces to a fixed rule on real telemetry, so a flagged anomaly is auditable, not probabilistic. This is why the Security agent is rules-based by design.',
  },
  {
    id: 'operations',
    name: 'Delivery-risk score',
    where: 'Operations agent · Operations team page · Chief of Staff panel',
    computed: true,
    formula:
      'delivery_risk = min(1.0,\n    min(0.25, open-PRs × 0.05)\n  + min(0.30, blocker-issues × 0.15)\n  + min(0.20, CI-failures × 0.10)\n  + (commit velocity decreasing ? 0.15 : 0) )',
    body:
      'Deterministic additive formula over real GitHub signals pulled live from the demo repository. No model judgment — the number is reproducible from the repo state at scan time.',
  },
  {
    id: 'revenue',
    name: 'Revenue risk score',
    where: 'Revenue agent · Revenue team page · Chief of Staff panel',
    computed: true,
    formula:
      'risk =  0.40 · renewal-urgency\n      + 0.30 · health-gap\n      + 0.15 · (1 − close-probability)\n      + 0.15 · negative-sentiment        (each normalised 0–1, capped)',
    body:
      'A deterministic weighted formula from the account’s real signals (renewal window, health score, deal close-probability, sentiment). Computed in code — Nova Pro only writes the human-readable risk-factor text.',
  },
  {
    id: 'customer',
    name: 'Churn-risk score',
    where: 'Customer agent · Customer team page · Chief of Staff panel',
    computed: true,
    formula:
      'each signal → severity 0 / 1 / 2 by its threshold\n  (health · sentiment · ticket-spike · adoption · escalations · NPS)\nchurn = min(1.0,  Σ severity ÷ 8 )',
    body:
      'A deterministic signal-severity formula over the six documented churn signals. ~4 moderate signals reach the ceiling. Computed in code — Nova Pro only writes the signal descriptions.',
  },
  {
    id: 'coordinator',
    name: 'Combined confidence',
    where: 'Chief of Staff · Intervention Canvas synthesis header',
    computed: true,
    formula:
      'combined = Σ(confidenceᵢ × severity-rankᵢ) ÷ Σ(severity-rankᵢ)\n  over the four domain agents  (rank: critical 4 · high 3 · medium 2 · low 1)',
    body:
      'The Chief of Staff’s confidence is the severity-weighted average of the four domain agents’ own confidences — higher-severity findings carry proportionally more weight. Computed in code.',
  },
  {
    id: 'gm',
    name: 'Insight confidence',
    where: 'General Manager · every insight card on the Intervention Canvas',
    computed: true,
    formula:
      'confidence = max(0.30,  0.5 · breadth  +  0.5 · strength )\n  breadth  = (# of the 4 domains that corroborate this insight) ÷ 4\n  strength = severity-weighted mean of those domains’ confidences',
    body:
      'Computed from real domain corroboration — a composite of how many domains corroborate the insight and their severity-weighted confidence, with no recency term (every Magnivonic signal is real-time, so recency would be a fabricated input). Nova Pro only narrates the result; it no longer invents the number. The separate X/100 magnitude is the General Manager’s model judgment.',
  },
  {
    id: 'similarity',
    name: 'Relevance / similarity',
    where: 'Debrief reasoning trail · Organizational Memory',
    computed: true,
    formula: 'relevance = 1 − cosine_distance(incident_embedding, situation_embedding)\n  pgvector · HNSW index · over Aurora PostgreSQL',
    body:
      'Real vector similarity between a past incident’s embedding and the current situation. A genuine pgvector cosine computation, not an estimate.',
    routing: '≥ 0.35 is treated as genuinely relevant; lower is shown but discounted.',
  },
]

export const metadata = { title: 'Confidence — Magnivonic' }

export default function ConfidencePage() {
  return (
    <div className="px-6 py-8 max-w-[920px] mx-auto">
      <PageHeader
        eyebrow="Specialized Agents"
        title="Confidence"
        subtitle="Every number Magnivonic shows, with the real account of where it comes from. Most scores are deterministic formulas you can reproduce from the inputs; where a value is the model’s judgment, it says so plainly — and no judgment is ever dressed up as a formula it isn’t."
      />

      <div className="mt-8 space-y-4">
        {SCORES.map((s) => (
          <section
            key={s.id}
            id={s.id}
            className="scroll-mt-20 rounded-xl border border-border bg-card/60 p-5"
          >
            <div className="flex items-center gap-2.5 flex-wrap mb-1">
              <h2 className="text-base font-semibold text-foreground">{s.name}</h2>
              <span
                className="text-[10px] font-semibold uppercase tracking-wider px-1.5 py-0.5 rounded"
                style={{
                  color: s.computed ? OK : 'var(--muted-foreground)',
                  background: s.computed
                    ? 'color-mix(in oklch, ' + OK + ' 12%, transparent)'
                    : 'color-mix(in oklch, var(--muted-foreground) 12%, transparent)',
                }}
              >
                {s.computed ? 'Computed' : 'Model judgment'}
              </span>
              <span className="text-[11px] text-muted-foreground ml-auto">{s.where}</span>
            </div>
            <p className="text-sm text-muted-foreground leading-relaxed mb-3">{s.body}</p>
            <pre className="rounded-lg border border-border bg-background/60 p-3.5 text-[12px] leading-relaxed text-foreground font-mono whitespace-pre-wrap overflow-x-auto">
              {s.formula}
            </pre>
            {s.routing ? (
              <p className="text-xs text-muted-foreground mt-2">
                <span className="font-semibold text-foreground/90">Routing: </span>
                {s.routing}
              </p>
            ) : null}
          </section>
        ))}
      </div>

      <p className="mt-6 text-xs text-muted-foreground">
        Routing thresholds and weights live in the agent code (backend/agents/*). This page is generated
        from the same real formulas the agents run.
      </p>
    </div>
  )
}
