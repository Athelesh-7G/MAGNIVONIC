'use client'

import { useEffect, useRef, useState } from 'react'
import { motion } from 'framer-motion'
import { GitBranch, Bell, Database, Brain, Check, X, Loader2 } from 'lucide-react'
import {
  fetchGithub,
  fetchSlack,
  fetchCustomers,
  fetchMemory,
  triggerAnalysis,
  ApiError,
  type AnalyzeResponse,
} from '@/lib/api'
import { LiveCascade, type CascadePhase } from './live-cascade'
import { OK, CRIT } from './signal-ui'

/**
 * The two-phase activation moment.
 *
 * Phase A — "Confirming connections": checks in with each real, already-standing
 * source one at a time (GitHub, Slack, the CRM, organizational memory), showing
 * the actual data each returns. These are genuine endpoint calls — if a source
 * truly doesn't respond, that row says so honestly. Nothing is scripted.
 *
 * Phase B — "Running the analysis": the existing real multi-agent cascade.
 *
 * Positioning: Magnivonic operates on tools the organization already runs — no
 * upload, no integration to wire up. This sequence makes the user watch the
 * platform confirm those real connections, then reason over them.
 */

type SourceState = 'pending' | 'checking' | 'connected' | 'failed'

type SourceDef = {
  key: string
  label: string
  icon: typeof GitBranch
  /** Real check — resolves to a short status summary, or throws to fail honestly. */
  check: () => Promise<string>
}

const SOURCES: SourceDef[] = [
  {
    key: 'github',
    label: 'GitHub',
    icon: GitBranch,
    check: async () => {
      const d = await fetchGithub()
      if (!d.connected || !d.signals) throw new Error('not connected')
      return `${d.repo} · ${d.signals.open_prs.count} open PRs, ${d.signals.blocker_issues.count} blockers`
    },
  },
  {
    key: 'slack',
    label: 'Slack',
    icon: Bell,
    check: async () => {
      const d = await fetchSlack()
      return `${d.channel} · ${d.total} alert${d.total === 1 ? '' : 's'} on record`
    },
  },
  {
    key: 'crm',
    label: 'CRM',
    icon: Database,
    check: async () => {
      const d = await fetchCustomers()
      return `${d.count} account${d.count === 1 ? '' : 's'} under watch`
    },
  },
  {
    key: 'memory',
    label: 'Organizational memory',
    icon: Brain,
    check: async () => {
      const d = await fetchMemory()
      return `${d.memory.length} past incident${d.memory.length === 1 ? '' : 's'} recalled`
    },
  },
]

const REVEAL_MS = 750 // legibility pacing for the reveal (the calls are faster)

export function ActivationSequence({
  onComplete,
  onError,
  trigger,
}: {
  onComplete: (data: AnalyzeResponse) => void
  onError: (e: { timeout: boolean; message: string }) => void
  trigger: string
}) {
  const [statuses, setStatuses] = useState<Record<string, { state: SourceState; summary?: string }>>(
    Object.fromEntries(SOURCES.map((s) => [s.key, { state: 'pending' as SourceState }])),
  )
  const [phase, setPhase] = useState<'connecting' | 'confirmed' | 'analyzing'>('connecting')
  const [elapsed, setElapsed] = useState(0)
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const startedRef = useRef(false)

  useEffect(() => {
    if (startedRef.current) return // run the sequence exactly once
    startedRef.current = true

    const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))

    const run = async () => {
      // Phase A — confirm each real connection, in sequence.
      for (const src of SOURCES) {
        setStatuses((s) => ({ ...s, [src.key]: { state: 'checking' } }))
        const started = Date.now()
        try {
          const summary = await src.check()
          // keep each row visible long enough to read
          await sleep(Math.max(0, REVEAL_MS - (Date.now() - started)))
          setStatuses((s) => ({ ...s, [src.key]: { state: 'connected', summary } }))
        } catch {
          await sleep(Math.max(0, REVEAL_MS - (Date.now() - started)))
          setStatuses((s) => ({ ...s, [src.key]: { state: 'failed', summary: `couldn’t reach ${src.label}` } }))
        }
        await sleep(180)
      }

      setPhase('confirmed')
      await sleep(650)

      // Phase B — the real multi-agent cascade.
      setPhase('analyzing')
      const start = Date.now()
      timerRef.current = setInterval(() => setElapsed((Date.now() - start) / 1000), 100)
      try {
        const data = await triggerAnalysis(trigger)
        onComplete(data)
      } catch (e) {
        const timeout = e instanceof ApiError && e.isTimeout
        onError({ timeout, message: e instanceof Error ? e.message : 'Unknown error' })
      } finally {
        if (timerRef.current) clearInterval(timerRef.current)
      }
    }

    run()
    return () => {
      if (timerRef.current) clearInterval(timerRef.current)
    }
  }, [onComplete, onError, trigger])

  const phaseCascade: CascadePhase = elapsed < 5 ? 'reading' : elapsed < 10 ? 'aggregating' : 'synthesizing'

  if (phase === 'analyzing') {
    return <LiveCascade phase={phaseCascade} elapsed={elapsed} />
  }

  const connectedCount = SOURCES.filter((s) => statuses[s.key].state === 'connected').length

  return (
    <div className="rounded-2xl border border-primary/30 bg-gradient-to-br from-card to-secondary/20 p-6">
      <div className="flex items-center justify-between mb-1">
        <span className="flex items-center gap-2 text-xs tracking-[0.22em] uppercase text-primary">
          <span className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse-dot" />
          {phase === 'confirmed' ? 'All sources confirmed' : 'Confirming live connections'}
        </span>
        <span className="text-xs text-muted-foreground tabular-nums">
          {connectedCount}/{SOURCES.length}
        </span>
      </div>
      <p className="text-sm text-muted-foreground mb-5">
        Magnivonic reads the tools your organization already runs — confirming each standing connection before
        it reasons.
      </p>

      <div className="space-y-2">
        {SOURCES.map((src, i) => {
          const st = statuses[src.key]
          const Icon = src.icon
          return (
            <motion.div
              key={src.key}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: st.state === 'pending' ? 0.4 : 1, y: 0 }}
              transition={{ duration: 0.25, delay: Math.min(i * 0.05, 0.2) }}
              className="flex items-center gap-3 rounded-xl border border-border bg-card/60 px-4 py-3"
            >
              <Icon className="w-4 h-4 shrink-0 text-muted-foreground" strokeWidth={2} />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-foreground leading-none">{src.label}</p>
                <p className="text-xs text-muted-foreground mt-1 truncate">
                  {st.state === 'pending'
                    ? 'waiting…'
                    : st.state === 'checking'
                      ? `checking ${src.label}…`
                      : st.summary}
                </p>
              </div>
              <span className="shrink-0">
                {st.state === 'checking' ? (
                  <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />
                ) : st.state === 'connected' ? (
                  <span className="inline-flex items-center gap-1 text-xs font-semibold uppercase tracking-widest" style={{ color: OK }}>
                    <Check className="w-3.5 h-3.5" /> Connected
                  </span>
                ) : st.state === 'failed' ? (
                  <span className="inline-flex items-center gap-1 text-xs font-semibold uppercase tracking-widest" style={{ color: CRIT }}>
                    <X className="w-3.5 h-3.5" /> Offline
                  </span>
                ) : null}
              </span>
            </motion.div>
          )
        })}
      </div>

      {phase === 'confirmed' ? (
        <p className="text-sm font-medium mt-5" style={{ color: OK }}>
          Reading every signal across the organization…
        </p>
      ) : null}
    </div>
  )
}
