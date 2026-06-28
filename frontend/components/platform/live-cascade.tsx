'use client'

import { cn } from '@/lib/utils'

export type CascadePhase = 'reading' | 'aggregating' | 'synthesizing'

const PHASE_ORDER: CascadePhase[] = ['reading', 'aggregating', 'synthesizing']
const DOMAIN_AGENTS = ['Revenue', 'Operations', 'Customer', 'Security']

function stageState(target: CascadePhase, current: CascadePhase): 'done' | 'active' | 'pending' {
  const ti = PHASE_ORDER.indexOf(target)
  const ci = PHASE_ORDER.indexOf(current)
  if (ti < ci) return 'done'
  if (ti === ci) return 'active'
  return 'pending'
}

/**
 * The live cascade visual. Phases are time-paced over ONE real in-flight
 * POST /analyze request (the response is a single merged brief — there is no
 * per-agent streaming), so the four domain agents share one "reading in
 * parallel" state and resolve together. Honest by design: no fabricated
 * per-agent incremental output. The elapsed timer is real.
 */
export function LiveCascade({ phase, elapsed }: { phase: CascadePhase; elapsed: number }) {
  const agents = stageState('reading', phase)
  const coord = stageState('aggregating', phase)
  const orch = stageState('synthesizing', phase)

  return (
    <section className="rounded-2xl border border-primary/30 bg-card p-6">
      <div className="flex items-center justify-between mb-6">
        <span className="flex items-center gap-2 text-xs tracking-[0.22em] uppercase text-primary">
          <span className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse-dot" />
          Live cascade · running
        </span>
        <span className="text-xs tabular-nums text-foreground">{elapsed.toFixed(1)}s</span>
      </div>

      <div className="flex flex-col items-center">
        {/* Tier 1 — four domain agents, shared state */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 w-full">
          {DOMAIN_AGENTS.map((a) => (
            <StageCard key={a} state={agents} title={a} sub={agents === 'done' ? 'signal read' : 'reading…'} />
          ))}
        </div>
        <Connector active={agents === 'done'} />

        {/* Tier 2 — chief of staff */}
        <div className="w-full max-w-[320px]">
          <StageCard
            state={coord}
            title="Chief of Staff"
            sub={coord === 'done' ? 'context assembled' : coord === 'active' ? 'aggregating…' : 'waiting'}
            emphatic
          />
        </div>
        <Connector active={coord === 'done'} />

        {/* Tier 3 — general manager */}
        <div className="w-full max-w-[360px]">
          <StageCard
            state={orch}
            title="General Manager"
            sub={orch === 'active' ? 'synthesizing · searching memory…' : orch === 'done' ? 'synthesized' : 'waiting'}
            hero
          />
        </div>
      </div>

      <p className="text-center text-xs text-muted-foreground mt-6">
        {phase === 'reading'
          ? 'Four agents reading signals in parallel…'
          : phase === 'aggregating'
            ? 'Chief of Staff assembling the unified context package…'
            : 'General Manager reasoning across domains and searching organizational memory…'}
      </p>
    </section>
  )
}

function StageCard({
  state,
  title,
  sub,
  emphatic,
  hero,
}: {
  state: 'done' | 'active' | 'pending'
  title: string
  sub: string
  emphatic?: boolean
  hero?: boolean
}) {
  const base = 'rounded-xl px-4 py-3 transition-all duration-500 text-center border'
  return (
    <div
      className={cn(
        base,
        hero && 'rounded-2xl',
        state === 'pending' && 'border-border bg-card/40 opacity-50',
        state === 'active' && 'border-primary/60 bg-primary/[0.08]',
        state === 'done' && 'border-border bg-card',
        emphatic && state !== 'pending' && 'border-primary/50',
      )}
      // Active glow derives from the accent token (color-mix preserves the 10% alpha).
      style={
        state === 'active'
          ? { boxShadow: '0 0 0 3px color-mix(in oklch, var(--primary) 10%, transparent)' }
          : undefined
      }
    >
      <div className="flex items-center justify-center gap-2">
        <span
          className={cn(
            'w-1.5 h-1.5 rounded-full shrink-0',
            state === 'active' && 'bg-primary animate-pulse-dot',
            state === 'done' && 'bg-[oklch(0.62_0.17_150)]',
            state === 'pending' && 'bg-muted-foreground/30',
          )}
        />
        <span className={cn('text-sm font-semibold leading-none', hero ? 'text-foreground' : 'text-foreground')}>
          {title}
        </span>
      </div>
      <p className="text-xs tracking-wide text-muted-foreground mt-1.5">{sub}</p>
    </div>
  )
}

function Connector({ active }: { active: boolean }) {
  return (
    <div className="h-7 w-px my-1 overflow-hidden relative" aria-hidden>
      <div className="absolute inset-0 bg-border" />
      {active ? (
        <span
          className="absolute left-1/2 -translate-x-1/2 w-0.5 h-3 rounded-full"
          style={{ background: 'oklch(0.62 0.17 150)' }}
        />
      ) : null}
    </div>
  )
}
