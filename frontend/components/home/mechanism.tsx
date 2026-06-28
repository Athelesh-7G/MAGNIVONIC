'use client'

import { useEffect, useRef, useState } from 'react'
import { Reveal } from '@/components/reveal'

const DOMAIN_AGENTS = [
  { id: 'revenue',  label: 'Revenue',          sub: 'Pipeline & expansion' },
  { id: 'security', label: 'Security',          sub: 'Access & anomalies' },
  { id: 'cx',       label: 'Customer Success',  sub: 'Health & usage' },
  { id: 'ops',      label: 'Operations',        sub: 'Capacity & process' },
]

const TIERS = [
  { tier: '01', label: 'Domain Agents', desc: 'Four specialists, each fluent in its own area.' },
  { tier: '02', label: 'Chief of Staff', desc: 'Gathers all four signals into one unified picture.' },
  { tier: '03', label: 'General Manager', desc: 'Connects the dots. Produces the decision.' },
]

export function Mechanism() {
  const [tick, setTick] = useState(0)
  const ref = useRef<HTMLDivElement>(null)
  const [live, setLive] = useState(false)

  useEffect(() => {
    const el = ref.current
    if (!el) return
    const obs = new IntersectionObserver(
      ([e]) => setLive(e.isIntersecting),
      { threshold: 0.2 },
    )
    obs.observe(el)
    return () => obs.disconnect()
  }, [])

  useEffect(() => {
    if (!live) return
    const id = setInterval(() => setTick((t) => (t + 1) % 4), 1100)
    return () => clearInterval(id)
  }, [live])

  return (
    <section id="platform" className="relative bg-[#060912] overflow-hidden border-y border-white/[0.06]">
      {/* Subtle blue radial glow */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            'radial-gradient(ellipse 80% 60% at 50% 30%, oklch(0.50 0.24 293 / 0.08) 0%, transparent 70%)',
        }}
      />

      <div className="relative max-w-[1280px] mx-auto px-8 pt-14 pb-24">
        {/* Section label row */}
        <div className="flex items-center mb-10 border-b border-white/[0.08] pb-4">
          <span className="font-mono text-[11px] tracking-[0.25em] uppercase text-white/55">
            {'>'} The Architecture
          </span>
        </div>

        <div className="grid lg:grid-cols-2 gap-16 items-center">
          {/* Left: text */}
          <Reveal>
            <h2 className="text-[clamp(28px,3.2vw,42px)] font-bold tracking-[-0.03em] leading-[1.08] text-white text-balance">
              Four specialists. Two layers of reasoning.{' '}
              <span className="text-primary">One recommendation you can stand behind.</span>
            </h2>
            <p className="mt-6 text-[17px] text-white/70 leading-relaxed max-w-[460px]">
              Four domain agents each read their corner of the business in parallel. A Chief of Staff
              assembles what they found into one picture. A General Manager reasons across it and produces
              the recommendation &ndash; the evidence, the cross-domain connections, and the suggested move
              &ndash; for the people who actually make the call.
            </p>

            <div className="mt-10 space-y-5">
              {TIERS.map(({ tier, label, desc }) => (
                <div key={tier} className="flex items-start gap-4">
                  <span className="font-mono text-[11px] tracking-[0.15em] text-primary/70 pt-[3px] shrink-0">
                    {tier}
                  </span>
                  <div>
                    <span className="text-[15px] font-semibold text-white">{label}</span>
                    <span className="text-[15px] text-white/60 ml-2">{desc}</span>
                  </div>
                </div>
              ))}
            </div>
          </Reveal>

          {/* Right: clean HTML flow diagram – no overflow, fully legible */}
          <Reveal delay={0.1}>
            <div ref={ref} className="flex flex-col items-center">
              {/* Tier 1 – domain agents */}
              <div className="grid grid-cols-2 gap-3 w-full max-w-[440px]">
                {DOMAIN_AGENTS.map((a, i) => {
                  const active = live && tick === i
                  return (
                    <div
                      key={a.id}
                      className="rounded-xl border px-4 py-3.5 transition-all duration-500"
                      style={{
                        borderColor: active
                          ? 'oklch(0.60 0.24 293 / 0.6)'
                          : 'oklch(1 0 0 / 0.1)',
                        background: active
                          ? 'oklch(0.50 0.24 293 / 0.14)'
                          : 'oklch(1 0 0 / 0.03)',
                      }}
                    >
                      <div className="flex items-center gap-2 mb-1">
                        <span
                          className="w-1.5 h-1.5 rounded-full transition-colors duration-500"
                          style={{
                            background: active
                              ? 'oklch(0.70 0.24 293)'
                              : 'oklch(1 0 0 / 0.35)',
                          }}
                        />
                        <span className="text-[14px] font-semibold text-white leading-none">
                          {a.label}
                        </span>
                      </div>
                      <p className="font-mono text-[10px] tracking-wide text-white/40">{a.sub}</p>
                    </div>
                  )
                })}
              </div>

              {/* Connector down to chief of staff */}
              <Connector active={live} />

              {/* Tier 2 – chief of staff */}
              <div className="w-full max-w-[300px] rounded-xl border border-primary/45 bg-primary/[0.12] px-5 py-3.5 text-center">
                <p className="text-[15px] font-bold text-white leading-none">Chief of Staff</p>
                <p className="font-mono text-[10px] text-primary/80 mt-1.5">Unified picture assembled</p>
              </div>

              {/* Connector down to general manager */}
              <Connector active={live} />

              {/* Tier 3 – general manager */}
              <div className="w-full max-w-[340px] rounded-2xl bg-primary px-6 py-4 text-center shadow-[0_8px_40px_-8px_oklch(0.50_0.24_293/0.6)]">
                <p className="text-[17px] font-black text-primary-foreground leading-none">
                  General Manager
                </p>
                <p className="font-mono text-[10px] text-primary-foreground/70 mt-2 tracking-wide">
                  Risk · Opportunity · Coordination Gap · Drift
                </p>
              </div>
            </div>
          </Reveal>
        </div>
      </div>
    </section>
  )
}

/** Vertical connector with a travelling pulse – pure CSS, never overflows. */
function Connector({ active }: { active: boolean }) {
  return (
    <div className="relative h-12 w-px my-1 overflow-hidden" aria-hidden>
      <div className="absolute inset-0 bg-white/12" />
      {active && (
        <span
          className="absolute left-1/2 -translate-x-1/2 w-1 h-4 rounded-full"
          style={{
            background:
              'linear-gradient(to bottom, transparent, oklch(0.70 0.24 293), transparent)',
            animation: 'pulse-travel 1.6s linear infinite',
          }}
        />
      )}
    </div>
  )
}
