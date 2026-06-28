'use client'

import { useEffect, useRef, useState } from 'react'
import { Info } from 'lucide-react'

/**
 * "How this was scored" — an honest, per-type provenance affordance.
 *
 * The discipline: never show a number without a real account of where it came
 * from, and never dress up an LLM's holistic judgment as an arithmetic formula
 * it isn't. So each `kind` says exactly what's true in the backend:
 *  - security / coordinator  → real deterministic formulas (described precisely)
 *  - similarity              → real pgvector cosine + the relevance threshold
 *  - gm / revenue / customer / operations → Nova Pro's judgment, with the real
 *    criteria the prompt tells it to weigh (NOT presented as a fixed formula)
 */
export type ScoreKind =
  | 'security'
  | 'coordinator'
  | 'similarity'
  | 'gm'
  | 'revenue'
  | 'customer'
  | 'operations'

const COPY: Record<ScoreKind, { title: string; computed: boolean; body: string }> = {
  security: {
    title: 'How this was scored',
    computed: true,
    body:
      'Deterministic formula — no model judgment. security_score = anomaly×0.35 + API-spike tier (≤0.30) + off-hours access (0.10) + data-export tier (≤0.15) + failed-auth tier (≤0.10) + unusual-IPs tier (≤0.10), capped at 1.0. Every point traces to a fixed rule on real telemetry, so the finding is auditable.',
  },
  coordinator: {
    title: 'How this was scored',
    computed: true,
    body:
      'Computed, not guessed. The Chief of Staff’s combined confidence is the severity-weighted average of the four domain agents’ own confidences — higher-severity findings carry proportionally more weight in the mean.',
  },
  similarity: {
    title: 'How this was scored',
    computed: true,
    body:
      'Real vector similarity — pgvector cosine (1 − cosine distance) between this past incident’s embedding and the current situation, over Aurora PostgreSQL. A score of 0.35 or higher is treated as genuinely relevant.',
  },
  gm: {
    title: 'How this was scored',
    computed: false,
    body:
      'The General Manager’s (Amazon Nova Pro) judgment of this classification — not an arithmetic score. It reflects how many independent domains corroborate the finding; the one-line rationale shown with the insight states why it’s high, medium, or low.',
  },
  revenue: {
    title: 'How this was scored',
    computed: false,
    body:
      'Nova Pro’s judgment per account, weighing health score (~30%), renewal urgency, close probability and sentiment. The model is guided by those criteria — it is not a fixed code formula.',
  },
  customer: {
    title: 'How this was scored',
    computed: false,
    body:
      'Nova Pro’s judgment per account, weighing the triggered churn signals — health, sentiment, ticket trend, feature adoption and NPS — by severity. Guided by those criteria, not a fixed code formula.',
  },
  operations: {
    title: 'How this was scored',
    computed: false,
    body:
      'Nova Pro’s judgment from real GitHub delivery signals — open PRs, blocker issues, CI failures and commit velocity. Guided by those signals, not a fixed code formula.',
  },
}

export function ScoreProvenance({ kind, className }: { kind: ScoreKind; className?: string }) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLSpanElement>(null)
  const copy = COPY[kind]

  useEffect(() => {
    if (!open) return
    const onDoc = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    const onEsc = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false)
    document.addEventListener('mousedown', onDoc)
    document.addEventListener('keydown', onEsc)
    return () => {
      document.removeEventListener('mousedown', onDoc)
      document.removeEventListener('keydown', onEsc)
    }
  }, [open])

  return (
    <span ref={ref} className={`relative inline-flex ${className ?? ''}`}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-label="How this was scored"
        aria-expanded={open}
        className="inline-flex items-center justify-center text-muted-foreground/60 hover:text-foreground transition-colors align-middle"
      >
        <Info size={13} strokeWidth={2} />
      </button>
      {open ? (
        <span
          role="dialog"
          className="absolute right-0 top-full mt-1.5 z-50 w-[300px] rounded-lg border border-border bg-popover p-3 text-left shadow-[0_16px_40px_-16px_rgba(0,0,0,0.35)]"
        >
          <span className="flex items-center gap-1.5 mb-1.5">
            <span className="text-[11px] font-semibold uppercase tracking-wider text-foreground">
              {copy.title}
            </span>
            <span
              className="text-[9px] font-semibold uppercase tracking-wider px-1.5 py-0.5 rounded"
              style={{
                color: copy.computed ? 'oklch(0.723 0.192 149.6)' : 'var(--muted-foreground)',
                background: copy.computed
                  ? 'color-mix(in oklch, oklch(0.723 0.192 149.6) 12%, transparent)'
                  : 'color-mix(in oklch, var(--muted-foreground) 12%, transparent)',
              }}
            >
              {copy.computed ? 'Computed' : 'Model judgment'}
            </span>
          </span>
          <span className="block text-[12px] leading-relaxed text-muted-foreground">{copy.body}</span>
        </span>
      ) : null}
    </span>
  )
}
