'use client'

import { useEffect, useRef, useState } from 'react'
import useSWR from 'swr'
import {
  fetchRisks,
  fetchCustomers,
  fetchMemory,
  triggerAnalysis,
  formatCurrency,
  ApiError,
  type Customer,
  type AnalyzeResponse,
  type Insight,
  type InsightType,
  type MemoryEntry,
} from '@/lib/api'
import { BriefCard, type RawByDomain } from '@/components/platform/brief-card'
import { LiveCascade, type CascadePhase } from '@/components/platform/live-cascade'
import { ActivationSequence } from '@/components/platform/activation-sequence'
import { ChiefOfStaffPanel } from '@/components/platform/chief-of-staff-panel'
import { ScoreProvenance } from '@/components/platform/score-provenance'
import { PageHeader } from '@/components/platform/page-header'
import { insightTypeColor, Stat } from '@/components/platform/signal-ui'
import { useActivation, markActivated, saveLiveResult, getLiveResult, shouldReplay } from '@/lib/activation'

type Mode = 'static' | 'activating' | 'running' | 'live' | 'error'

function buildRawByDomain(c: Customer): { raw: RawByDomain; unavailable: Record<string, string> } {
  const deviation = c.api_baseline > 0 ? `${(c.api_calls / c.api_baseline).toFixed(1)}×` : '—'
  return {
    raw: {
      revenue: [
        { label: 'ARR', value: formatCurrency(c.arr) },
        { label: 'Renewal', value: (c.renewal_date ?? '—').slice(0, 10) },
        { label: 'Stage', value: c.account_stage },
        { label: 'CS tier', value: c.cs_tier },
      ],
      customer: [
        { label: 'Health', value: `${c.health_score}/100` },
        { label: 'Tickets (7d)', value: `${c.tickets}` },
        { label: 'Sentiment', value: c.sentiment.toFixed(2) },
        { label: 'Adoption', value: `${c.adoption}/100` },
      ],
      security: [
        { label: 'Anomaly', value: c.anomaly_score.toFixed(2) },
        { label: 'API calls/hr', value: `${c.api_calls}` },
        { label: 'Baseline/hr', value: `${c.api_baseline}` },
        { label: 'Deviation', value: deviation },
      ],
    },
    unavailable: {
      operations:
        'Live delivery signals — open PRs, blockers, CI, commit velocity — are on The Wire and Connections.',
    },
  }
}

function matchPrecedent(precedent: string | null, memory: MemoryEntry[]): MemoryEntry | null {
  if (!precedent) return null
  const p = precedent.toLowerCase()
  // Best-effort: the precedent string embeds a summary snippet. Match a memory
  // row whose summary opening appears in the precedent text. Unlinked if none.
  return (
    memory.find((m) => {
      const head = m.summary.toLowerCase().slice(0, 40)
      return head.length > 12 && p.includes(head)
    }) ?? null
  )
}

function precedentHrefFor(insight: Insight, memory: MemoryEntry[]): string | undefined {
  const match = matchPrecedent(insight.historical_precedent, memory)
  return match ? `/platform/memory?id=${match.id}` : undefined
}

/** The lead account = the highest-ARR at-risk account (falls back to the
 *  highest-ARR account overall). Replaces the old hardcoded /acme/ coupling so
 *  the Canvas, Wire, and Dossiers stay correct across any re-seed or rename. */
function pickLeadAccount(customers: Customer[] | undefined): Customer | null {
  if (!customers || customers.length === 0) return null
  const atRisk = customers.filter((c) => c.account_stage === 'at_risk')
  const pool = atRisk.length > 0 ? atRisk : customers
  return pool.reduce((best, c) => (c.arr > best.arr ? c : best), pool[0])
}

function canvasTimeAgo(iso: string | null): string {
  if (!iso) return 'this session'
  const secs = Math.max(0, Math.floor((Date.now() - new Date(iso).getTime()) / 1000))
  if (secs < 60) return `${secs}s ago`
  const mins = Math.floor(secs / 60)
  if (mins < 60) return `${mins}m ago`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `${hrs}h ago`
  return `${Math.floor(hrs / 24)}d ago`
}

/** What leads is the most *newsworthy* insight — and a Risk is NEVER the lead,
 *  regardless of severity. The lead is the highest-scoring NON-Risk insight
 *  (rarest non-Risk type first — a lone Opportunity or Coordination Gap is the
 *  news; ties break on score, then confidence). Risks always fall to position 2+.
 *  If a scan is all Risks, there is no promoted lead (returns null) — we do not
 *  fabricate a non-Risk to fill the slot; the cards render as a flat, equal,
 *  score-ordered list under the synthesis header instead. */
function pickLead(insights: Insight[]): Insight | null {
  const candidates = insights.filter((i) => i.insight_type !== 'Risk')
  if (candidates.length === 0) return null
  const typeCounts = candidates.reduce<Record<string, number>>((acc, i) => {
    acc[i.insight_type] = (acc[i.insight_type] ?? 0) + 1
    return acc
  }, {})
  return candidates.reduce((best, i) => {
    const ra = typeCounts[i.insight_type]
    const rb = typeCounts[best.insight_type]
    if (ra !== rb) return ra < rb ? i : best
    if (i.overall_score !== best.overall_score) return i.overall_score > best.overall_score ? i : best
    return i.confidence > best.confidence ? i : best
  }, candidates[0])
}

/** A short, honest reason the lead leads — so the ordering reads as editorial
 *  judgment, not "Risk first because Risk." (The lead is always non-Risk.) */
function leadReason(lead: Insight, insights: Insight[]): string {
  const sameType = insights.filter((i) => i.insight_type === lead.insight_type).length
  const label = lead.insight_type === 'CoordinationGap' ? 'Coordination Gap' : lead.insight_type
  if (sameType === 1) return `Most newsworthy · the only ${label} this scan`
  return `Most newsworthy · highest-scoring ${label}`
}

/** The single top-line executive sentence — composed entirely from REAL fields
 *  already in the /analyze response (combined_severity, the insight mix, and the
 *  lead insight). No new LLM call, no template fabrication: it just states what
 *  the scan actually found, in one line. */
function composeExecSummary(
  insights: Insight[],
  context: AnalyzeResponse['context'],
  lead: Insight | null,
): string {
  const n = insights.length
  const accounts = new Set(insights.map((i) => i.account).filter(Boolean)).size
  const sev = context.combined_severity ?? 'low'
  const posture =
    sev === 'critical'
      ? 'Immediate attention needed'
      : sev === 'high'
        ? 'Elevated risk this scan'
        : sev === 'medium'
          ? 'Mostly stable, with movement to watch'
          : 'Healthy overall'
  const scope =
    accounts > 0
      ? `${n} insight${n === 1 ? '' : 's'} across ${accounts} account${accounts === 1 ? '' : 's'}`
      : `${n} insight${n === 1 ? '' : 's'}`
  const leadClause = lead
    ? ` The most pressing is ${lead.risk_title}${lead.account ? ` on ${lead.account}` : ''} (${lead.severity}).`
    : ''
  return `${posture} — ${scope} this scan.${leadClause}`
}

/** How a supporting insight relates to the lead — same account, a different
 *  account, or org-internal — so the canvas reads as one org-wide scan rather
 *  than a pile of unrelated cards. */
function relationLabel(insight: Insight, lead: Insight): string {
  const a = insight.account
  const b = lead.account
  if (!a && !b) return 'Org-internal · same scope as the lead finding'
  if (!a) return 'Org-internal · no single account'
  if (!b) return `Customer-facing — ${a} · the lead finding is org-internal`
  if (a === b) return `Same account as the lead finding — ${a}`
  return `Different account — ${a}`
}

export default function InterventionCanvas() {
  const { data: risksData, error: risksError, isLoading: risksLoading } = useSWR('risks', fetchRisks)
  const { data: customersData } = useSWR('customers', fetchCustomers)
  const { data: memoryData } = useSWR('memory', fetchMemory)

  const [mode, setMode] = useState<Mode>('static')
  const [elapsed, setElapsed] = useState(0)
  const [liveResult, setLiveResult] = useState<AnalyzeResponse | null>(null)
  const [errInfo, setErrInfo] = useState<{ timeout: boolean; message: string } | null>(null)
  const [replay, setReplay] = useState(false)
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const { activated, lastScanAt } = useActivation()

  // Restore the most recent live result on mount so returning to the Canvas
  // shows the live scan, not the static /risks view (Bug 1) — unless a demo
  // replay (?demo) is requested, in which case the cold-open + full activation
  // sequence is forced regardless of stored state.
  useEffect(() => {
    if (shouldReplay()) {
      setReplay(true)
      return
    }
    const stored = getLiveResult()
    if (stored) {
      setLiveResult(stored)
      setMode('live')
    }
  }, [])

  // Disconnect handling: when activation is cleared (topbar Disconnect) while the
  // Canvas is mounted showing live results, drop the in-memory result and fall
  // back to the cold-open. Fires only on a real true→false transition, so the
  // initial mount race (false→true) never wipes a restored result.
  const wasActivatedRef = useRef(false)
  useEffect(() => {
    if (wasActivatedRef.current && !activated) {
      setLiveResult(null)
      setErrInfo(null)
      setMode('static')
    }
    wasActivatedRef.current = activated
  }, [activated])

  // First run / demo replay → the full two-phase Confirm-&-analyze sequence.
  const startActivation = () => {
    setReplay(false)
    setErrInfo(null)
    setMode('activating')
  }

  // Header button: full sequence on first run / replay, warm cascade otherwise.
  const handleRun = () => {
    if (!activated || replay) startActivation()
    else run()
  }

  // Dynamic lead account — the highest-ARR at-risk account, not a hardcoded
  // name. Robust to re-seeds/renames and genuinely "the account most worth
  // opening on" rather than a fixed demo account.
  const leadCustomer = pickLeadAccount(customersData?.customers)
  const leadRisk =
    (leadCustomer &&
      risksData?.risks.find((r) => r.title.toLowerCase().includes(leadCustomer.name.toLowerCase()))) ??
    risksData?.risks[0] ??
    null
  const enrich = leadCustomer ? buildRawByDomain(leadCustomer) : null

  const phase: CascadePhase = elapsed < 5 ? 'reading' : elapsed < 10 ? 'aggregating' : 'synthesizing'

  const liveInsights = liveResult?.insights ?? []
  const leadInsight = liveInsights.length > 0 ? pickLead(liveInsights) : null
  const byScoreDesc = (a: Insight, b: Insight) => b.overall_score - a.overall_score
  const supportingInsights = leadInsight
    ? liveInsights.filter((i) => i !== leadInsight).slice().sort(byScoreDesc)
    : []
  // Decision-priority order: a non-Risk lead first (by position only, not size),
  // then the rest by score. When the scan is all Risks there is no lead — the
  // cards render as a flat, equal, score-ordered list (no fabricated lead).
  const orderedInsights = leadInsight
    ? [leadInsight, ...supportingInsights]
    : liveInsights.slice().sort(byScoreDesc)

  const run = async () => {
    setMode('running')
    setLiveResult(null)
    setErrInfo(null)
    setElapsed(0)
    const start = Date.now()
    intervalRef.current = setInterval(() => setElapsed((Date.now() - start) / 1000), 100)
    try {
      const data = await triggerAnalysis('platform_ui')
      setLiveResult(data)
      setMode('live')
      // The one action that brings the platform online — flips every surface
      // out of its at-rest state in one motion. Persist the live result so the
      // Canvas keeps showing it across navigation (Bug 1).
      saveLiveResult(data)
      markActivated()
    } catch (e) {
      const timeout = e instanceof ApiError && e.isTimeout
      setErrInfo({ timeout, message: e instanceof Error ? e.message : 'Unknown error' })
      setMode('error')
    } finally {
      if (intervalRef.current) clearInterval(intervalRef.current)
    }
  }

  return (
    <div className="max-w-[1100px] mx-auto px-8 py-8">
      <PageHeader
        eyebrow="Executive Intelligence"
        title="Intervention Canvas"
        subtitle="What the organization needs attention on right now — cross-domain insights synthesized from every connected signal, scored and traced to the evidence behind them."
        action={<ReRunButton mode={mode} elapsed={elapsed} onRun={handleRun} />}
      />

      <div className="mt-6">
        {mode === 'activating' ? (
          <ActivationSequence
            trigger="platform_ui"
            onComplete={(data) => {
              setLiveResult(data)
              saveLiveResult(data)
              markActivated()
              setElapsed(0)
              setMode('live')
            }}
            onError={(info) => {
              setErrInfo(info)
              setMode('error')
            }}
          />
        ) : mode === 'running' ? (
          <LiveCascade phase={phase} elapsed={elapsed} />
        ) : mode === 'live' && liveResult && liveInsights.length > 0 ? (
          <div className="space-y-4">
            {/* E — the single top-line executive sentence, composed from real
                response fields. The first thing read on the canvas. */}
            <p className="text-[18px] md:text-[20px] font-medium leading-snug text-foreground text-balance">
              {composeExecSummary(liveInsights, liveResult.context, leadInsight)}
            </p>

            <div
              className="flex items-center justify-between rounded-lg border px-4 py-2.5"
              style={{
                borderColor: 'color-mix(in oklch, oklch(0.62 0.17 150) 30%, transparent)',
                background: 'color-mix(in oklch, oklch(0.62 0.17 150) 6%, transparent)',
              }}
            >
              <span className="text-xs uppercase tracking-widest" style={{ color: 'oklch(0.62 0.17 150)' }}>
                {elapsed > 0 ? `Analysis complete · ${elapsed.toFixed(1)}s` : `Last analysis · ${canvasTimeAgo(lastScanAt)}`}
              </span>
              <span className="text-xs text-muted-foreground">
                {liveInsights.length} insight{liveInsights.length === 1 ? '' : 's'} this scan
              </span>
            </div>

            {/* Synthesis FIRST — the calm, org-level framing. The first thing
                read is "the system understood the org this scan", not an alarm
                card. */}
            <SynthesisHeader insights={liveInsights} context={liveResult.context} />

            {/* B — the Chief of Staff's real per-domain aggregation, the input
                the General Manager synthesized. Reveals row-by-row (D's honest
                "movement" from real data). Renders only when the deployed
                backend supplies agent_summaries. */}
            <ChiefOfStaffPanel summaries={liveResult.context.agent_summaries} />

            {/* Then the insights as equal-weight cards in decision-priority
                order. The lead leads by POSITION only — no card towers; severity
                is a labeled badge on each (inside BriefCard), never the reason
                one card is larger. Relation labels keep the "one org-wide scan"
                cohesion. */}
            <div>
              <p className="text-xs uppercase tracking-widest text-muted-foreground mb-3">
                Insights this scan · ordered by decision priority · severity shown on each
              </p>
              <div className="space-y-3">
                {orderedInsights.map((insight, i) => {
                  const c = insightTypeColor(insight.insight_type)
                  const typeLabel =
                    insight.insight_type === 'CoordinationGap' ? 'Coordination Gap' : insight.insight_type
                  const label = leadInsight
                    ? i === 0
                      ? leadReason(insight, liveInsights)
                      : relationLabel(insight, leadInsight)
                    : `${typeLabel}${insight.account ? ` · ${insight.account}` : ' · org-internal'}`
                  return (
                    <div key={i}>
                      <p className="text-xs uppercase tracking-widest mb-1.5" style={{ color: c }}>
                        {label}
                      </p>
                      <BriefCard
                        live={insight}
                        variant="feed"
                        precedentHref={precedentHrefFor(insight, memoryData?.memory ?? [])}
                        index={i}
                      />
                    </div>
                  )
                })}
              </div>
            </div>
          </div>
        ) : mode === 'error' && errInfo ? (
          <CascadeError info={errInfo} elapsed={elapsed} onRetry={startActivation} onBack={() => setMode('static')} />
        ) : !activated || replay ? (
          <ColdOpen onRun={startActivation} />
        ) : risksLoading ? (
          <LoadingPanel label="Loading the latest brief from AWS…" />
        ) : risksError ? (
          <ErrorPanel message="Could not reach the briefs API. The service may be warming up." onRetry={run} />
        ) : leadRisk ? (
          <div className="space-y-3">
            <p className="text-xs uppercase tracking-widest text-muted-foreground">
              The current cross-domain event under watch
            </p>
            <BriefCard
              risk={leadRisk}
              variant="hero"
              rawByDomain={enrich?.raw}
              rawUnavailableByDomain={enrich?.unavailable}
            />
          </div>
        ) : (
          <EmptyState onTrigger={run} />
        )}
      </div>
    </div>
  )
}

const INSIGHT_TYPE_ORDER: InsightType[] = ['Risk', 'Opportunity', 'CoordinationGap', 'Drift']
const INSIGHT_TYPE_SHORT_LABEL: Record<InsightType, string> = {
  Risk: 'Risk',
  Opportunity: 'Opportunity',
  CoordinationGap: 'Coordination gap',
  Drift: 'Drift',
}

/** The synthesis-first framing — the calm, org-level statement read BEFORE any
 *  individual finding. Leads with the count and combined confidence (the
 *  "system understood the org" register, like the reference app's Dashboard banner),
 *  not with the highest-severity card. Insight types are shown at parity. */
function SynthesisHeader({
  insights,
  context,
}: {
  insights: Insight[]
  context: AnalyzeResponse['context']
}) {
  const counts = insights.reduce<Partial<Record<InsightType, number>>>((acc, i) => {
    acc[i.insight_type] = (acc[i.insight_type] ?? 0) + 1
    return acc
  }, {})
  const accounts = new Set(insights.map((i) => i.account).filter(Boolean)).size
  const typeCount = Object.keys(counts).length
  const confidence = Math.round((context.combined_confidence ?? 0) * 100)

  return (
    <div className="rounded-xl border border-border bg-gradient-to-br from-card to-secondary/20 p-5">
      <div className="flex items-start justify-between gap-6 flex-wrap">
        <div>
          <p className="text-3xl font-bold tracking-tight text-foreground">
            {insights.length} insight{insights.length === 1 ? '' : 's'} synthesized
          </p>
          <p className="text-sm text-muted-foreground mt-1">
            across {accounts} account{accounts === 1 ? '' : 's'} and {typeCount} insight type
            {typeCount === 1 ? '' : 's'} this scan
          </p>
        </div>
        <div className="flex items-start gap-1">
          <Stat value={`${confidence}%`} label="combined confidence" />
          <ScoreProvenance kind="coordinator" className="mt-1" />
        </div>
      </div>
      <div className="flex items-center gap-1.5 flex-wrap mt-4">
        {INSIGHT_TYPE_ORDER.filter((t) => counts[t]).map((t) => {
          const c = insightTypeColor(t)
          return (
            <span
              key={t}
              className="text-xs uppercase tracking-widest px-1.5 py-0.5 rounded border font-semibold"
              style={{
                color: c,
                borderColor: `color-mix(in oklch, ${c} 35%, transparent)`,
                background: `color-mix(in oklch, ${c} 8%, transparent)`,
              }}
            >
              {counts[t]} {INSIGHT_TYPE_SHORT_LABEL[t]}
            </span>
          )
        })}
      </div>
    </div>
  )
}

function ReRunButton({ mode, elapsed, onRun }: { mode: Mode; elapsed: number; onRun: () => void }) {
  const running = mode === 'running' || mode === 'activating'
  const label =
    mode === 'activating'
      ? 'Confirming…'
      : mode === 'live'
        ? 'Run again'
        : mode === 'error'
          ? 'Try again'
          : 'Re-run live analysis'
  return (
    <div className="flex flex-col items-end gap-1">
      <button
        type="button"
        onClick={onRun}
        disabled={running}
        className={
          'h-9 px-4 inline-flex items-center gap-2 rounded-lg text-sm font-semibold transition-colors ' +
          (running
            ? 'bg-muted text-muted-foreground cursor-wait'
            : 'bg-primary text-primary-foreground hover:bg-primary/90')
        }
      >
        {running ? (
          <>
            <span className="w-1.5 h-1.5 rounded-full bg-current animate-pulse-dot" />
            Analyzing… {elapsed.toFixed(1)}s
          </>
        ) : (
          label
        )}
      </button>
      <span className="text-xs tracking-wide text-muted-foreground/60">
        fires the live multi-agent cascade on AWS
      </span>
    </div>
  )
}

function LoadingPanel({ label }: { label: string }) {
  return (
    <div className="rounded-2xl border border-border bg-card/40 px-6 py-16 text-center">
      <p className="text-sm text-muted-foreground animate-pulse">{label}</p>
    </div>
  )
}

function ErrorPanel({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <div className="rounded-2xl border border-border bg-card/40 px-6 py-12 text-center">
      <p className="text-sm mb-4" style={{ color: 'oklch(0.58 0.22 25)' }}>
        {message}
      </p>
      <button
        type="button"
        onClick={onRetry}
        className="h-9 px-4 inline-flex items-center rounded-lg text-sm font-medium bg-muted text-foreground hover:bg-muted/70 transition-colors"
      >
        Run live analysis
      </button>
    </div>
  )
}

function CascadeError({
  info,
  elapsed,
  onRetry,
  onBack,
}: {
  info: { timeout: boolean; message: string }
  elapsed: number
  onRetry: () => void
  onBack: () => void
}) {
  const CRIT = 'oklch(0.58 0.22 25)'
  return (
    <div className="rounded-2xl border bg-card overflow-hidden" style={{ borderColor: `color-mix(in oklch, ${CRIT} 30%, var(--border))` }}>
      <div className="relative">
        <div className="absolute left-0 top-0 bottom-0 w-1" style={{ background: CRIT }} />
        <div className="pl-5 pr-5 py-5">
          <p className="text-xs uppercase tracking-widest mb-2" style={{ color: CRIT }}>
            {info.timeout ? 'Analysis timed out' : 'Analysis failed'}
          </p>
          <h3 className="text-base font-bold text-foreground leading-snug">
            {info.timeout
              ? 'The live cascade didn’t return within the window.'
              : 'The live cascade could not complete.'}
          </h3>
          <p className="text-sm text-muted-foreground leading-relaxed mt-2 max-w-[640px]">
            {info.timeout ? (
              <>
                The engine runs a real multi-agent cascade on AWS. The first run after an idle period has to
                cold-start the functions, and that can exceed the API gateway’s response window (~29s) — so a
                first attempt may surface as a timeout. Subsequent runs are warm and typically complete in
                under ~10 seconds. Try again.
              </>
            ) : (
              <>The request did not complete. The service may be warming up — try again in a moment.</>
            )}
          </p>
          <p className="text-xs text-muted-foreground/60 mt-2">
            elapsed {elapsed.toFixed(1)}s · {info.message}
          </p>
          <div className="flex items-center gap-3 mt-4">
            <button
              type="button"
              onClick={onRetry}
              className="h-9 px-4 inline-flex items-center rounded-lg text-sm font-semibold bg-primary text-primary-foreground hover:bg-primary/90 transition-colors"
            >
              Try again
            </button>
            <button
              type="button"
              onClick={onBack}
              className="h-9 px-4 inline-flex items-center rounded-lg text-sm font-medium bg-muted text-foreground hover:bg-muted/70 transition-colors"
            >
              Back
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

/** The cold open — states the positioning ("already connected, nothing to
 *  upload") and launches the two-phase Confirm-&-analyze sequence. */
function ColdOpen({ onRun }: { onRun: () => void }) {
  return (
    <div className="rounded-2xl border border-border bg-gradient-to-br from-card to-secondary/20 px-8 py-14 text-center">
      <span className="inline-flex items-center gap-2 text-xs uppercase tracking-widest text-primary/80 mb-5">
        <span className="w-1.5 h-1.5 rounded-full bg-primary" />
        Already connected · nothing to upload
      </span>
      <h3 className="text-2xl font-bold tracking-tight text-foreground max-w-xl mx-auto">
        Magnivonic is already watching your stack.
      </h3>
      <p className="text-sm text-muted-foreground mt-3 max-w-lg mx-auto leading-relaxed">
        No files to import, no integrations to wire up — the agents read the tools your organization already
        runs on. Confirm the live connections and run the first analysis across every signal at once.
      </p>
      <button
        type="button"
        onClick={onRun}
        className="mt-6 h-11 px-6 inline-flex items-center gap-2 rounded-lg text-sm font-semibold bg-primary text-primary-foreground hover:bg-primary/90 transition-colors"
      >
        <span className="w-1.5 h-1.5 rounded-full bg-current" />
        Confirm connections &amp; analyze
      </button>
      <p className="text-xs text-muted-foreground/60 mt-3">
        Confirms GitHub, Slack, the CRM &amp; organizational memory · then runs the live cascade on AWS
      </p>
    </div>
  )
}

function EmptyState({ onTrigger }: { onTrigger: () => void }) {
  return (
    <div className="rounded-2xl border border-dashed border-border bg-card/40 px-6 py-14 text-center">
      <p className="text-xs tracking-[0.22em] uppercase text-muted-foreground mb-3">Nothing flagged</p>
      <h3 className="text-base font-bold text-foreground">No cross-domain event for this account right now.</h3>
      <p className="text-sm text-muted-foreground mt-2 max-w-md mx-auto leading-relaxed">
        Run a live analysis to scan every connected signal and surface anything that needs attention.
      </p>
      <button
        type="button"
        onClick={onTrigger}
        className="mt-5 h-9 px-4 inline-flex items-center gap-2 rounded-lg text-sm font-semibold bg-primary text-primary-foreground hover:bg-primary/90 transition-colors"
      >
        Run live analysis
      </button>
    </div>
  )
}
