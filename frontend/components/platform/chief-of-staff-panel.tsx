'use client'

import { motion } from 'framer-motion'
import type { AgentSummary } from '@/lib/api'
import { SeverityBadge, severityColor } from '@/components/platform/signal-ui'
import { ScoreProvenance, type ScoreKind } from '@/components/platform/score-provenance'

/** Fixed display order + the real provenance kind for each domain's confidence. */
const DOMAINS: { key: string; label: string; kind: ScoreKind }[] = [
  { key: 'revenue', label: 'Revenue', kind: 'revenue' },
  { key: 'operations', label: 'Operations', kind: 'operations' },
  { key: 'customer', label: 'Customer', kind: 'customer' },
  { key: 'security', label: 'Security', kind: 'security' },
]

/**
 * "Chief of Staff — what each domain reported."
 *
 * Surfaces the REAL per-domain summaries the Coordinator already assembles
 * (agent_summaries), shown before the General Manager's synthesized insights so
 * the aggregation step is visible rather than opaque. Rows reveal in sequence
 * (staggered) the moment the real result lands — honest "movement" from real
 * data, not scripted mid-run text. Nothing here is invented: if a domain has no
 * summary, it says so.
 */
export function ChiefOfStaffPanel({ summaries }: { summaries?: Record<string, AgentSummary> }) {
  if (!summaries || Object.keys(summaries).length === 0) return null

  return (
    <div className="rounded-xl border border-border bg-card/60 p-5">
      <div className="flex items-center justify-between mb-1">
        <p className="text-sm font-semibold tracking-tight text-foreground">Chief of Staff</p>
        <span className="text-[11px] uppercase tracking-widest text-muted-foreground">
          what each domain reported
        </span>
      </div>
      <p className="text-xs text-muted-foreground mb-4">
        The four domain agents’ real findings, assembled into one picture — the input the General Manager
        synthesized into the insights below.
      </p>

      <div className="space-y-2">
        {DOMAINS.map((d, i) => {
          const s = summaries[d.key]
          const reveal = {
            initial: { opacity: 0, y: 6 },
            animate: { opacity: 1, y: 0 },
            transition: { delay: i * 0.12, duration: 0.3 },
          }
          if (!s) {
            return (
              <motion.div
                key={d.key}
                {...reveal}
                className="flex items-center justify-between rounded-lg border border-border/60 bg-background/40 px-3.5 py-2.5"
              >
                <span className="text-sm font-medium text-foreground">{d.label}</span>
                <span className="text-xs text-muted-foreground">no signal this scan</span>
              </motion.div>
            )
          }
          const conf = typeof s.confidence === 'number' ? Math.round(s.confidence * 100) : null
          return (
            <motion.div
              key={d.key}
              {...reveal}
              className="rounded-lg border px-3.5 py-2.5"
              style={{ borderColor: `color-mix(in oklch, ${severityColor(s.severity ?? 'low')} 28%, transparent)` }}
            >
              <div className="flex items-center justify-between gap-3 mb-1">
                <div className="flex items-center gap-2 min-w-0">
                  <span className="text-sm font-semibold text-foreground shrink-0">{d.label}</span>
                  {s.signal ? (
                    <span className="font-mono text-[10px] tracking-wide text-muted-foreground/70 truncate">
                      {s.signal}
                    </span>
                  ) : null}
                  {s.severity ? <SeverityBadge severity={s.severity} /> : null}
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  {conf !== null ? (
                    <span className="text-xs tabular-nums text-muted-foreground">{conf}% conf.</span>
                  ) : null}
                  <ScoreProvenance kind={d.kind} label="scored" />
                </div>
              </div>
              <p className="text-[13px] text-foreground/90 leading-snug">
                {s.description || s.signal || '—'}
              </p>
            </motion.div>
          )
        })}
      </div>
    </div>
  )
}
