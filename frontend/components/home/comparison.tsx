'use client'

import { Reveal } from '@/components/reveal'

const ROWS = [
  { feature: 'Cross-domain signal reading',          traditional: false, magnivonic: true },
  { feature: 'Four insight types — not just alerts',  traditional: false, magnivonic: true },
  { feature: 'Cited, grounded answers (not a black box)', traditional: false, magnivonic: true },
  { feature: 'Continuous — not on schedule',          traditional: false, magnivonic: true },
  { feature: 'Multi-agent coordination',              traditional: false, magnivonic: true },
  { feature: 'Per-team scoped intelligence',          traditional: false, magnivonic: true },
  { feature: 'Organizational memory',                 traditional: false, magnivonic: true },
  { feature: 'No data migration — reads tools you already run', traditional: false, magnivonic: true },
  { feature: 'Department-level action routing',       traditional: false, magnivonic: true },
  { feature: 'Proactive — not reactive',              traditional: false, magnivonic: true },
  { feature: 'Single synthesized understanding',      traditional: false, magnivonic: true },
]

function Check() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden>
      <circle cx="8" cy="8" r="7.5" className="fill-primary" />
      <path d="M4.5 8l2.5 2.5 4.5-5" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

function Cross() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden>
      <circle cx="8" cy="8" r="7.5" className="fill-border" />
      <path d="M5.5 5.5l5 5M10.5 5.5l-5 5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" className="text-muted-foreground/40" />
    </svg>
  )
}

export function Comparison() {
  return (
    <section id="why" className="bg-background border-t border-border">
      <div className="max-w-[1280px] mx-auto px-8">
        <div className="flex items-center border-b border-border py-4">
          <span className="font-mono text-[11px] tracking-[0.25em] uppercase text-muted-foreground">
            {'>'} Why Magnivonic
          </span>
        </div>

        <div className="py-24 grid lg:grid-cols-2 gap-12 lg:gap-20 items-start">

          <Reveal>
            <h2 className="text-[clamp(28px,3.2vw,42px)] font-bold tracking-[-0.03em] leading-[1.08] text-foreground text-balance">
              Dashboards report the past. Magnivonic prevents the future.
            </h2>
            <p className="mt-4 text-[17px] text-muted-foreground leading-relaxed max-w-[400px]">
              Dashboards show you one domain at a time, and only when you go looking. Magnivonic reasons across all of them at once, continuously — and remembers what it learned.
            </p>
          </Reveal>

          {/* Table */}
          <div>
            {/* Header */}
            <div className="grid grid-cols-[1fr_120px_140px] gap-4 pb-3 border-b border-border">
              <span className="font-mono text-[10px] tracking-[0.2em] uppercase text-muted-foreground/60">Capability</span>
              <span className="font-mono text-[10px] tracking-[0.2em] uppercase text-muted-foreground/60 text-center">Traditional</span>
              <span className="font-mono text-[10px] tracking-[0.2em] uppercase text-primary text-center">Magnivonic</span>
            </div>

            {ROWS.map(({ feature, traditional, magnivonic }, i) => (
              <Reveal
                key={feature}
                delay={i * 0.05}
                y={12}
                className="grid grid-cols-[1fr_120px_140px] gap-4 py-3.5 border-b border-border/50 items-center transition-colors hover:bg-muted/40 rounded-lg"
              >
                <span className="text-[14px] text-foreground/90">{feature}</span>
                <div className="flex justify-center">
                  {traditional ? <Check /> : <Cross />}
                </div>
                <div className="flex justify-center bg-primary/5 rounded-lg py-1">
                  {magnivonic ? <Check /> : <Cross />}
                </div>
              </Reveal>
            ))}

            {/* Best column footer */}
            <div className="grid grid-cols-[1fr_120px_140px] gap-4 pt-3 items-center">
              <span />
              <span />
              <div className="flex justify-center">
                <span className="inline-flex items-center gap-1 bg-primary text-primary-foreground font-mono text-[10px] tracking-widest uppercase px-3 py-1 rounded-full font-semibold">
                  Best
                </span>
              </div>
            </div>
          </div>

        </div>
      </div>
    </section>
  )
}
