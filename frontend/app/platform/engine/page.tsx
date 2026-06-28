'use client'

import { useRef, useState } from 'react'
import { motion } from 'framer-motion'
import useSWR from 'swr'
import { fetchHealth, triggerAnalysis, ApiError } from '@/lib/api'
import { PageHeader } from '@/components/platform/page-header'
import { LiveCascade, type CascadePhase } from '@/components/platform/live-cascade'
import { ActivationSequence } from '@/components/platform/activation-sequence'
import { formatTimestamp, OK, CRIT, WARN } from '@/components/platform/signal-ui'
import { useActivation, markActivated, saveLiveResult, shouldReplay } from '@/lib/activation'

const STACK = [
  { layer: 'Reasoning / synthesis', tech: 'Amazon Bedrock — Nova Pro', detail: 'us.amazon.nova-pro-v1:0' },
  { layer: 'Memory embeddings', tech: 'Titan Embed V2', detail: 'amazon.titan-embed-text-v2:0 · 1024-dim' },
  { layer: 'Vector store', tech: 'Aurora PostgreSQL Serverless v2 + pgvector', detail: 'HNSW index · cosine (vector_cosine_ops)' },
  { layer: 'Compute', tech: 'AWS Lambda · Python 3.12', detail: '4 domain agents fired in parallel (ThreadPoolExecutor)' },
  { layer: 'API', tech: 'Amazon API Gateway (REST)', detail: 'GET /health · /customers · /risks · /github · /slack · POST /analyze' },
  { layer: 'Events', tech: 'Amazon EventBridge', detail: 'agent + orchestrator event bus' },
]

// The six real agents in the cascade. Security is deterministic (not AI) — it
// carries a distinct tag because that difference is real and auditable.
type AgentKind = 'ai' | 'deterministic' | 'coordinator' | 'gm'
const AGENTS: { name: string; role: string; kind: AgentKind }[] = [
  { name: 'Revenue Agent', role: 'Watches renewal exposure across every account', kind: 'ai' },
  { name: 'Operations Agent', role: 'Tracks delivery health from the GitHub workspace', kind: 'ai' },
  { name: 'Customer Agent', role: 'Reads the earliest signs of churn', kind: 'ai' },
  { name: 'Security Agent', role: 'Flags access & API anomalies against fixed thresholds', kind: 'deterministic' },
  { name: 'Chief of Staff', role: 'Assembles the four signals into one picture', kind: 'coordinator' },
  { name: 'General Manager', role: 'Reasons across domains and decides what to do', kind: 'gm' },
]

type Mode = 'board' | 'activating' | 'running' | 'error'

function timeAgo(iso: string | null): string {
  if (!iso) return 'just now'
  const secs = Math.max(0, Math.floor((Date.now() - new Date(iso).getTime()) / 1000))
  if (secs < 60) return `${secs}s ago`
  const mins = Math.floor(secs / 60)
  if (mins < 60) return `${mins}m ago`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `${hrs}h ago`
  return `${Math.floor(hrs / 24)}d ago`
}

export default function EnginePage() {
  const { data: health, error: healthError, isLoading } = useSWR('health', fetchHealth)
  const { activated, lastScanAt } = useActivation()

  const [mode, setMode] = useState<Mode>('board')
  const [elapsed, setElapsed] = useState(0)
  const [errInfo, setErrInfo] = useState<{ timeout: boolean; message: string } | null>(null)
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const phase: CascadePhase = elapsed < 5 ? 'reading' : elapsed < 10 ? 'aggregating' : 'synthesizing'
  const busy = mode === 'running' || mode === 'activating'

  // First run (or demo replay) shows the full two-phase Confirm-&-analyze
  // sequence; a warm re-run skips straight to the cascade.
  const onRun = () => {
    if (!activated || shouldReplay()) {
      setErrInfo(null)
      setMode('activating')
    } else {
      run()
    }
  }

  const run = async () => {
    setMode('running')
    setErrInfo(null)
    setElapsed(0)
    const start = Date.now()
    intervalRef.current = setInterval(() => setElapsed((Date.now() - start) / 1000), 100)
    try {
      const data = await triggerAnalysis('engine_room')
      saveLiveResult(data)
      markActivated()
      setMode('board')
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
        eyebrow="Specialized Agents"
        title="Engine Room"
        subtitle="The real multi-agent engine, on AWS. Run it and watch the agents move from idle to active — four domain agents in parallel, then the Chief of Staff and General Manager."
        action={
          <RunButton activated={activated} mode={mode} elapsed={elapsed} onRun={onRun} />
        }
      />

      {/* Live /health status */}
      <div className="mt-6 rounded-2xl border border-border bg-card/60 p-5">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div className="flex items-center gap-2.5">
            <span className="text-xs tracking-[0.2em] uppercase text-muted-foreground">API status</span>
            {isLoading ? (
              <span className="text-sm text-muted-foreground animate-pulse">checking…</span>
            ) : healthError ? (
              <span className="flex items-center gap-2 text-sm" style={{ color: CRIT }}>
                <span className="w-1.5 h-1.5 rounded-full" style={{ background: CRIT }} />
                unreachable
              </span>
            ) : (
              <span className="flex items-center gap-2 text-sm font-semibold" style={{ color: OK }}>
                <span className="w-1.5 h-1.5 rounded-full animate-pulse-dot" style={{ background: OK }} />
                {health?.status ?? 'unknown'}
              </span>
            )}
          </div>
          {health ? (
            <div className="flex items-center gap-6 text-xs text-muted-foreground">
              <span>service: <span className="text-foreground">{health.service}</span></span>
              <span>version: <span className="text-foreground">{health.version}</span></span>
              <span>checked: <span className="text-foreground">{formatTimestamp(health.timestamp)}</span></span>
            </div>
          ) : null}
        </div>
        <p className="mt-2 text-xs text-muted-foreground/60">Source: GET /health · live from AWS</p>
      </div>

      {/* Agent run-state board — the live engine, with a real trigger */}
      <div className="mt-6">
        <div className="flex items-center justify-between mb-3">
          <p className="text-xs tracking-[0.2em] uppercase text-muted-foreground">{'>'} Agents</p>
          <span
            className="flex items-center gap-1.5 text-xs uppercase tracking-widest"
            style={{ color: busy ? WARN : activated ? OK : 'var(--muted-foreground)' }}
          >
            <span
              className={'w-1.5 h-1.5 rounded-full ' + (busy || activated ? 'animate-pulse-dot' : '')}
              style={{ background: busy ? WARN : activated ? OK : 'var(--muted-foreground)' }}
            />
            {mode === 'activating' ? 'Confirming connections' : mode === 'running' ? 'Running' : activated ? `Active · last run ${timeAgo(lastScanAt)}` : 'Not yet activated'}
          </span>
        </div>

        {mode === 'activating' ? (
          <ActivationSequence
            trigger="engine_room"
            onComplete={(data) => {
              saveLiveResult(data)
              markActivated()
              setMode('board')
            }}
            onError={(info) => {
              setErrInfo(info)
              setMode('error')
            }}
          />
        ) : mode === 'running' ? (
          <LiveCascade phase={phase} elapsed={elapsed} />
        ) : mode === 'error' && errInfo ? (
          <div
            className="rounded-2xl border bg-card p-5"
            style={{ borderColor: `color-mix(in oklch, ${CRIT} 30%, var(--border))` }}
          >
            <p className="text-xs uppercase tracking-widest mb-1" style={{ color: CRIT }}>
              {errInfo.timeout ? 'Run timed out' : 'Run failed'}
            </p>
            <p className="text-sm text-muted-foreground leading-relaxed max-w-[640px]">
              The engine runs a real multi-agent cascade on AWS. The first run after idle can cold-start the
              functions and approach the gateway’s ~29s window — subsequent runs are warm. Try again.
            </p>
            <button
              type="button"
              onClick={run}
              className="mt-4 h-9 px-4 inline-flex items-center rounded-lg text-sm font-semibold bg-primary text-primary-foreground hover:bg-primary/90 transition-colors"
            >
              Try again
            </button>
          </div>
        ) : (
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {AGENTS.map((a, i) => (
              <AgentCard key={a.name} agent={a} activated={activated} lastScanAt={lastScanAt} index={i} />
            ))}
          </div>
        )}
      </div>

      {/* Security-deterministic transparency callout (mandated framing) */}
      <div
        className="mt-6 rounded-2xl border px-5 py-5"
        style={{ borderColor: `color-mix(in oklch, ${WARN} 35%, transparent)`, background: `color-mix(in oklch, ${WARN} 6%, transparent)` }}
      >
        <p className="text-xs tracking-[0.2em] uppercase mb-2" style={{ color: WARN }}>Design decision · auditability</p>
        <p className="text-base text-foreground leading-relaxed">
          The General Manager synthesizes with Nova Pro. The{' '}
          <span className="font-semibold">Security agent, by contrast, is rules-based by design — auditable,
          not probabilistic.</span>{' '}
          A flagged anomaly traces to fixed thresholds on real metrics (API-call deviation, access patterns),
          never to a model&apos;s judgment.
        </p>
      </div>

      {/* Accurate infra facts */}
      <div className="mt-6">
        <p className="text-xs tracking-[0.2em] uppercase text-muted-foreground mb-3">{'>'} Infrastructure</p>
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {STACK.map((s, i) => (
            <motion.div
              key={s.layer}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3, delay: Math.min(i * 0.05, 0.4), ease: 'easeOut' }}
              whileHover={{ y: -4 }}
              className="rounded-xl border border-border bg-gradient-to-br from-card to-secondary/20 px-4 py-3.5"
            >
              <p className="text-xs tracking-[0.16em] uppercase text-muted-foreground/70 mb-1">{s.layer}</p>
              <p className="text-sm font-semibold text-foreground leading-snug">{s.tech}</p>
              <p className="font-mono text-xs text-muted-foreground mt-1">{s.detail}</p>
            </motion.div>
          ))}
        </div>
      </div>

      <p className="mt-4 text-xs text-muted-foreground/60">
        The four domain agents run in parallel, then the Chief of Staff and General Manager — one orchestrated
        cascade per scan.
      </p>
    </div>
  )
}

function AgentCard({
  agent,
  activated,
  lastScanAt,
  index,
}: {
  agent: { name: string; role: string; kind: AgentKind }
  activated: boolean
  lastScanAt: string | null
  index: number
}) {
  const deterministic = agent.kind === 'deterministic'
  const dot = activated ? OK : 'var(--muted-foreground)'
  // Pre-activation reads as genuinely dormant: dimmed, dashed, flat — visibly
  // "never run", not merely "idle".
  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: activated ? 1 : 0.5, y: 0 }}
      transition={{ duration: 0.3, delay: Math.min(index * 0.05, 0.4), ease: 'easeOut' }}
      className={
        'rounded-xl border px-4 py-3.5 ' +
        (!activated
          ? 'border-dashed bg-card/30'
          : deterministic
            ? 'bg-card'
            : 'bg-gradient-to-br from-card to-secondary/20')
      }
      style={
        activated && deterministic
          ? { borderColor: `color-mix(in oklch, ${WARN} 30%, var(--border))` }
          : { borderColor: 'var(--border)' }
      }
    >
      <div className="flex items-center justify-between gap-2 mb-1">
        <div className="flex items-center gap-2 min-w-0">
          <span
            className={'w-1.5 h-1.5 rounded-full shrink-0 ' + (activated ? 'animate-pulse-dot' : '')}
            style={{ background: dot }}
          />
          <span className="text-sm font-semibold text-foreground truncate">{agent.name}</span>
        </div>
        <span
          className="text-xs uppercase tracking-widest shrink-0"
          style={{ color: !activated ? 'var(--muted-foreground)' : deterministic ? WARN : 'var(--muted-foreground)' }}
        >
          {deterministic ? 'Rules' : 'AI'}
        </span>
      </div>
      <p className="text-xs text-muted-foreground">{agent.role}</p>
      <p className="text-xs mt-1.5" style={{ color: activated ? OK : 'var(--muted-foreground)' }}>
        {activated ? `active · last run ${timeAgo(lastScanAt)}` : 'not yet run'}
      </p>
    </motion.div>
  )
}

function RunButton({
  activated,
  mode,
  elapsed,
  onRun,
}: {
  activated: boolean
  mode: Mode
  elapsed: number
  onRun: () => void
}) {
  const running = mode === 'running' || mode === 'activating'
  const label =
    mode === 'activating'
      ? 'Confirming…'
      : mode === 'running'
        ? `Running… ${elapsed.toFixed(1)}s`
        : activated
          ? 'Re-run the engine'
          : 'Run the engine'
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
        <span className={'w-1.5 h-1.5 rounded-full bg-current ' + (running ? 'animate-pulse-dot' : '')} />
        {label}
      </button>
      <span className="text-xs tracking-wide text-muted-foreground/60">fires the real /analyze cascade on AWS</span>
    </div>
  )
}
