'use client'

import { Reveal } from '@/components/reveal'

const STACK = [
  { layer: 'Reasoning', tech: 'Amazon Bedrock — Nova Pro' },
  { layer: 'Compute',   tech: 'AWS Lambda — parallel agents' },
  { layer: 'Events',    tech: 'Amazon EventBridge' },
  { layer: 'Data',      tech: 'Aurora PostgreSQL + pgvector' },
  { layer: 'Live feed', tech: 'GitHub API' },
  { layer: 'Alerts',    tech: 'Slack' },
]

export function InfraStrip() {
  return (
    <section id="infrastructure" className="bg-background border-t border-border scroll-mt-[60px]">
      <div className="max-w-[1280px] mx-auto px-8">
        <div className="flex items-center border-b border-border py-4">
          <span className="font-mono text-[11px] tracking-[0.25em] uppercase text-muted-foreground">
            {'>'} Infrastructure
          </span>
        </div>

        <div className="py-16">
          <Reveal className="max-w-xl mb-10">
            <h2 className="text-[clamp(28px,3.2vw,42px)] font-black tracking-[-0.03em] leading-[1.08] text-foreground text-balance">
              Built on infrastructure your security team will recognize.
            </h2>
          </Reveal>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {STACK.map((s, i) => (
              <Reveal
                key={s.layer}
                delay={i * 0.06}
                className="rounded-xl border border-border bg-card px-5 py-4 transition-all duration-300 hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-[0_8px_30px_-12px_oklch(0.50_0.22_255/0.35)]"
              >
                <p className="font-mono text-[10px] tracking-[0.18em] uppercase text-muted-foreground/70 mb-1">{s.layer}</p>
                <p className="text-[14px] font-semibold text-foreground">{s.tech}</p>
              </Reveal>
            ))}
          </div>
        </div>
      </div>
    </section>
  )
}
