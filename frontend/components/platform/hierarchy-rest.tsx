'use client'

// Static (non-animated) at-rest view of the agent hierarchy:
// four domain agents → Chief of Staff → General Manager.
// Adapted from the homepage Mechanism diagram's structure, but uses theme
// tokens (not hardcoded dark) so it renders correctly inside the platform
// shell in both light and dark. Animation is deliberately out of scope today.

const DOMAIN_AGENTS = [
  { label: 'Revenue', sub: 'Pipeline & renewal' },
  { label: 'Operations', sub: 'Delivery & blockers' },
  { label: 'Customer', sub: 'Health & sentiment' },
  { label: 'Security', sub: 'Access & anomalies' },
]

export function HierarchyRest() {
  return (
    <section className="rounded-2xl border border-border bg-card/40 p-6">
      <div className="flex items-center justify-between mb-6">
        <span className="text-xs tracking-[0.22em] uppercase text-muted-foreground">
          {'>'} Engine · at rest
        </span>
        <span className="text-xs tracking-[0.18em] uppercase text-muted-foreground/60">
          idle
        </span>
      </div>

      <div className="flex flex-col items-center">
        {/* Tier 1 — domain agents */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 w-full">
          {DOMAIN_AGENTS.map((a) => (
            <div key={a.label} className="rounded-xl border border-border bg-card px-4 py-3.5">
              <div className="flex items-center gap-2 mb-1">
                <span className="w-1.5 h-1.5 rounded-full bg-muted-foreground/40" />
                <span className="text-sm font-semibold text-foreground leading-none">{a.label}</span>
              </div>
              <p className="text-xs tracking-wide text-muted-foreground">{a.sub}</p>
            </div>
          ))}
        </div>

        <Connector />

        {/* Tier 2 — chief of staff */}
        <div className="w-full max-w-[300px] rounded-xl border-2 border-primary/40 bg-primary/[0.06] px-5 py-3 text-center">
          <p className="text-sm font-bold text-foreground leading-none">Chief of Staff</p>
          <p className="text-xs text-primary/80 mt-1.5">Unified context package</p>
        </div>

        <Connector />

        {/* Tier 3 — general manager */}
        <div className="w-full max-w-[340px] rounded-2xl bg-primary px-6 py-3.5 text-center shadow-lg shadow-primary/20">
          <p className="text-base font-black text-primary-foreground leading-none">General Manager</p>
          <p className="text-xs text-primary-foreground/70 mt-1.5">Synthesizes · decides · acts</p>
        </div>
      </div>
    </section>
  )
}

function Connector() {
  return (
    <div className="h-8 w-px my-1 bg-border" aria-hidden />
  )
}
