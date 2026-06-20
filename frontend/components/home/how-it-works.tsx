'use client'

import { Reveal } from '@/components/reveal'

const STEPS = [
  {
    index: '01',
    slug:  'SENSE',
    headline: 'Four agents read the organization as it happens.',
    body: 'Revenue, Operations, Security, and Customer Success agents run continuously — each fluent in its own domain, reading the signals that matter there the moment they change.',
    visual: (
      <div className="bg-primary h-full min-h-[280px] rounded-xl p-8 flex flex-col justify-between relative overflow-hidden">
        {/* Corner markers like Supermemory */}
        <span className="absolute top-3 left-3 w-2 h-2 border-t border-l border-white/30" />
        <span className="absolute top-3 right-3 w-2 h-2 border-t border-r border-white/30" />
        <span className="absolute bottom-3 left-3 w-2 h-2 border-b border-l border-white/30" />
        <span className="absolute bottom-3 right-3 w-2 h-2 border-b border-r border-white/30" />
        <div className="grid grid-cols-2 gap-3 flex-1">
          {['Revenue', 'Security', 'Customer Success', 'Operations'].map((d, i) => (
            <div
              key={d}
              className="rounded-lg border border-white/20 bg-white/10 px-3 py-3 flex items-center gap-2"
              style={{ animationDelay: `${i * 0.2}s` }}
            >
              <span className="w-1.5 h-1.5 rounded-full bg-white/60 animate-pulse-dot shrink-0" />
              <span className="text-white text-[13px] font-semibold">{d}</span>
            </div>
          ))}
        </div>
        <p className="font-mono text-[10px] text-white/40 tracking-widest uppercase mt-4">Reading continuously</p>
      </div>
    ),
  },
  {
    index: '02',
    slug:  'GATHER',
    headline: 'A Coordinator collects all four signals in parallel.',
    body: 'The Coordinator agent receives what every domain agent is seeing — simultaneously — and assembles them into one unified picture of the organization at that moment.',
    visual: (
      <div className="bg-[#060912] border border-white/[0.07] h-full min-h-[280px] rounded-xl p-8 flex items-center gap-5 relative overflow-hidden">
        <span className="absolute top-3 left-3 w-2 h-2 border-t border-l border-white/10" />
        <span className="absolute top-3 right-3 w-2 h-2 border-t border-r border-white/10" />
        <span className="absolute bottom-3 left-3 w-2 h-2 border-b border-l border-white/10" />
        <span className="absolute bottom-3 right-3 w-2 h-2 border-b border-r border-white/10" />

        {/* Four incoming signal rows */}
        <div className="flex-1 flex flex-col gap-2.5">
          {['Sales', 'Support', 'Security', 'Operations'].map((d) => (
            <div
              key={d}
              className="flex items-center justify-between rounded-lg border border-white/10 bg-white/[0.03] px-3 py-2"
            >
              <span className="text-[12px] font-semibold text-white/85">{d}</span>
              <span className="font-mono text-[9px] tracking-widest uppercase text-primary/80">signal</span>
            </div>
          ))}
        </div>

        {/* Converging arrows */}
        <div className="flex flex-col items-center gap-1 text-primary/70" aria-hidden>
          <span className="font-mono text-[13px] leading-none">&rarr;</span>
          <span className="font-mono text-[13px] leading-none">&rarr;</span>
          <span className="font-mono text-[13px] leading-none">&rarr;</span>
          <span className="font-mono text-[13px] leading-none">&rarr;</span>
        </div>

        {/* Coordinator output card */}
        <div className="flex-1 rounded-xl border border-primary/40 bg-primary/[0.08] px-4 py-5 text-center">
          <span className="font-mono text-[9px] tracking-[0.2em] uppercase text-primary/80 block mb-1.5">
            Coordinator
          </span>
          <p className="text-[13px] font-semibold text-white leading-snug">One unified picture</p>
          <p className="text-[11px] text-white/55 mt-1">4 signals · assembled in parallel</p>
        </div>
      </div>
    ),
  },
  {
    index: '03',
    slug:  'CONNECT',
    headline: 'The Orchestrator finds what no single team could see.',
    body: 'The Orchestrator reasons across the unified picture — finding the moment signals that looked unrelated in isolation are actually the same event, requiring a coordinated response.',
    visual: (
      <div className="bg-primary h-full min-h-[280px] rounded-xl p-8 relative overflow-hidden">
        <span className="absolute top-3 left-3 w-2 h-2 border-t border-l border-white/30" />
        <span className="absolute top-3 right-3 w-2 h-2 border-t border-r border-white/30" />
        <span className="absolute bottom-3 left-3 w-2 h-2 border-b border-l border-white/30" />
        <span className="absolute bottom-3 right-3 w-2 h-2 border-b border-r border-white/30" />
        <div className="space-y-3">
          <div className="rounded-lg bg-white/10 border border-white/20 px-4 py-3">
            <p className="font-mono text-[10px] text-white/40 uppercase tracking-widest">Security signal</p>
            <p className="text-white text-sm mt-0.5">Unusual access pattern detected</p>
          </div>
          <div className="flex items-center gap-2 px-4">
            <div className="flex-1 h-px bg-white/20" />
            <span className="font-mono text-[10px] text-white/40">linked to</span>
            <div className="flex-1 h-px bg-white/20" />
          </div>
          <div className="rounded-lg bg-white/10 border border-white/20 px-4 py-3">
            <p className="font-mono text-[10px] text-white/40 uppercase tracking-widest">Revenue signal</p>
            <p className="text-white text-sm mt-0.5">Renewal at risk — same account</p>
          </div>
          <div className="rounded-lg bg-white/25 border border-white/30 px-4 py-3">
            <p className="font-mono text-[10px] text-white/60 uppercase tracking-widest">Orchestrator</p>
            <p className="text-white text-sm font-semibold mt-0.5">Same event. Coordinated response needed.</p>
          </div>
        </div>
      </div>
    ),
  },
  {
    index: '04',
    slug:  'REMEMBER',
    headline: 'The organization\'s history is part of every decision.',
    body: 'Every situation is checked against how the organization has handled something similar before — what actions were taken, what was learned — so the same lessons compound over time.',
    visual: (
      <div className="bg-[#060912] border border-white/[0.07] h-full min-h-[280px] rounded-xl p-8 flex flex-col justify-center gap-0 relative overflow-hidden">
        <span className="absolute top-3 left-3 w-2 h-2 border-t border-l border-white/10" />
        <span className="absolute top-3 right-3 w-2 h-2 border-t border-r border-white/10" />
        <span className="absolute bottom-3 left-3 w-2 h-2 border-b border-l border-white/10" />
        <span className="absolute bottom-3 right-3 w-2 h-2 border-b border-r border-white/10" />
        {[
          { tag: 'Now', label: 'Current situation', text: 'Access anomaly · renewal in 42 days', strong: true },
          { tag: 'Match', label: 'Historical match', text: 'Q3 2024 — same pattern · score 0.91', accent: true },
          { tag: 'Lesson', label: 'What was learned', text: 'Escalate to AE first → churn risk −63%' },
        ].map((row, i) => (
          <div key={i}>
            <div className="rounded-lg border border-white/10 bg-white/[0.03] px-4 py-3">
              <div className="flex items-center justify-between mb-1">
                <span
                  className="font-mono text-[10px] tracking-[0.2em] uppercase font-semibold"
                  style={{ color: row.accent ? 'oklch(0.70 0.22 255)' : 'oklch(1 0 0 / 0.35)' }}
                >
                  {row.tag}
                </span>
                <span className="font-mono text-[10px] text-white/25">{row.label}</span>
              </div>
              <p className={`text-[13px] leading-snug ${row.strong ? 'text-white font-semibold' : 'text-white/65'}`}>
                {row.text}
              </p>
            </div>
            {i < 2 && (
              <div className="flex justify-center py-1.5" aria-hidden>
                <span className="font-mono text-[12px] text-primary/70 leading-none">&darr;</span>
              </div>
            )}
          </div>
        ))}
      </div>
    ),
  },
  {
    index: '05',
    slug:  'ACT',
    headline: 'One synthesized understanding becomes department-level action.',
    body: 'A single, coordinated understanding reaches every relevant team with specific recommended actions — not a report to be reviewed, but a directive delivered the moment it matters.',
    visual: (
      <div className="bg-primary h-full min-h-[280px] rounded-xl p-8 relative overflow-hidden">
        <span className="absolute top-3 left-3 w-2 h-2 border-t border-l border-white/30" />
        <span className="absolute top-3 right-3 w-2 h-2 border-t border-r border-white/30" />
        <span className="absolute bottom-3 left-3 w-2 h-2 border-b border-l border-white/30" />
        <span className="absolute bottom-3 right-3 w-2 h-2 border-b border-r border-white/30" />
        <div className="space-y-2.5">
          {[
            { dept: 'Account Executive', action: 'Reach out — renewal urgency elevated' },
            { dept: 'Security',          action: 'Review access logs for this account' },
            { dept: 'Customer Success',  action: 'Schedule health check immediately' },
          ].map(({ dept, action }) => (
            <div key={dept} className="rounded-lg bg-white/10 border border-white/20 px-4 py-3">
              <p className="font-mono text-[10px] text-white/50 uppercase tracking-widest">{dept}</p>
              <p className="text-white text-[13px] font-medium mt-0.5">{action}</p>
            </div>
          ))}
        </div>
      </div>
    ),
  },
]

export function HowItWorks() {
  return (
    <section id="how-it-works" className="bg-background">
      {/* Section header row — exactly like Supermemory */}
      <div className="max-w-[1280px] mx-auto px-8">
        <div className="flex items-center border-b border-border py-4">
          <span className="font-mono text-[11px] tracking-[0.25em] uppercase text-muted-foreground">
            {'>'} How it works
          </span>
        </div>
      </div>

      <div className="max-w-[1280px] mx-auto px-8 py-6 space-y-0">

        {/* Section intro */}
        <div className="py-14 max-w-xl">
          <h2 className="text-[clamp(28px,3.2vw,42px)] font-black tracking-[-0.03em] leading-[1.08] text-foreground text-balance">
            Five steps. One system.
          </h2>
          <p className="mt-4 text-[17px] text-muted-foreground leading-relaxed">
            Sense, gather, connect, remember, act. The full cycle runs continuously — not on a schedule, not on request.
          </p>
        </div>

        {/* Steps */}
        <div className="space-y-0">
          {STEPS.map((step, i) => (
            <Reveal key={step.index} className="border-t border-border py-14 grid md:grid-cols-2 gap-10 md:gap-16 items-center">

              {/* Left: index + text */}
              <div>
                <div className="flex items-baseline gap-3 mb-5">
                  <span className="font-mono text-[11px] tracking-[0.25em] uppercase text-muted-foreground/60">
                    {step.index} / {step.slug}
                  </span>
                </div>
                <h3 className="text-[32px] font-black tracking-[-0.025em] leading-[1.1] text-foreground text-balance">
                  {step.headline}
                </h3>
                <p className="mt-4 text-[16px] text-muted-foreground leading-relaxed max-w-[420px]">
                  {step.body}
                </p>
              </div>

              {/* Right: visual — alternate order on even steps */}
              <div className={i % 2 === 1 ? 'md:order-first' : ''}>
                {step.visual}
              </div>

            </Reveal>
          ))}
        </div>

      </div>
    </section>
  )
}
