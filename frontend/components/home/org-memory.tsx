'use client'

import { useEffect, useRef, useState } from 'react'

const MEMORY_STEPS = [
  {
    stage: 'Now',
    label: 'Current situation',
    text: 'Security irregularity on Enterprise account. Renewal in 42 days.',
    active: true,
  },
  {
    stage: 'Match',
    label: 'Historical match found',
    text: 'Q3 2024 — TechCorp. Similar access pattern + renewal window. Score 0.91.',
    active: false,
  },
  {
    stage: 'Lesson',
    label: 'What was learned',
    text: 'Escalating AE first — before security review — reduced churn probability by 63%.',
    active: false,
  },
]

export function OrgMemory() {
  const [step, setStep] = useState(0)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          const id = setInterval(() => {
            setStep(s => {
              if (s >= MEMORY_STEPS.length - 1) { clearInterval(id); return s }
              return s + 1
            })
          }, 1100)
          return () => clearInterval(id)
        }
      },
      { threshold: 0.3 }
    )
    if (ref.current) observer.observe(ref.current)
    return () => observer.disconnect()
  }, [])

  return (
    <section id="org-memory" className="relative bg-[#060912] border-y border-white/[0.06] overflow-hidden scroll-mt-20">
      {/* Blue radial */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0"
        style={{
          background: 'radial-gradient(ellipse 60% 50% at 70% 50%, oklch(0.50 0.22 255 / 0.09) 0%, transparent 70%)',
        }}
      />

      <div className="relative max-w-[1280px] mx-auto px-8 py-24">
        <div className="flex items-center border-b border-white/[0.08] pb-4 mb-16">
          <span className="font-mono text-[11px] tracking-[0.25em] uppercase text-white/55">
            {'>'} Organizational Memory
          </span>
        </div>

        <div className="grid lg:grid-cols-2 gap-12 lg:gap-20 items-center">

          {/* Left: text */}
          <div>
            <h2 className="text-[clamp(28px,3.2vw,42px)] font-black tracking-[-0.03em] leading-[1.08] text-white text-balance">
              The organization remembers.
              <br />
              <span className="text-primary">So every decision compounds.</span>
            </h2>
            <p className="mt-6 text-[17px] text-white/70 leading-relaxed max-w-[420px]">
              The Orchestrator reasons over what is happening now — and what has happened before. Every situation is matched against the organization&apos;s own history of similar events, what actions were taken, and what was learned. The longer Magnivonic runs, the more precisely it reasons.
            </p>
            <div className="mt-10 flex items-start gap-4">
              <div className="w-px h-16 bg-primary/60 mt-1 shrink-0" />
              <p className="text-[15px] text-white/40 italic leading-relaxed">
                &ldquo;A system that learns from its own actions is an organization that gets better at being itself.&rdquo;
              </p>
            </div>
          </div>

          {/* Right: animated memory flow */}
          <div ref={ref} className="space-y-3">
            {MEMORY_STEPS.map(({ stage, label, text }, i) => {
              const isVisible = i <= step
              const isCurrent = i === step
              return (
                <div
                  key={stage}
                  className="rounded-xl border px-5 py-4 transition-all duration-700"
                  style={{
                    borderColor: isCurrent
                      ? 'oklch(0.50 0.22 255 / 0.7)'
                      : isVisible
                      ? 'oklch(1 0 0 / 0.12)'
                      : 'oklch(1 0 0 / 0.05)',
                    background: isCurrent
                      ? 'oklch(0.50 0.22 255 / 0.12)'
                      : isVisible
                      ? 'oklch(1 0 0 / 0.03)'
                      : 'transparent',
                    opacity: isVisible ? 1 : 0.2,
                    transform: isVisible ? 'translateY(0)' : 'translateY(8px)',
                  }}
                >
                  <div className="flex items-center justify-between mb-2">
                    <span
                      className="font-mono text-[10px] tracking-[0.2em] uppercase font-semibold"
                      style={{ color: isCurrent ? 'oklch(0.70 0.22 255)' : 'oklch(1 0 0 / 0.3)' }}
                    >
                      {stage}
                    </span>
                    <span className="font-mono text-[10px] text-white/20">{label}</span>
                  </div>
                  <p
                    className="text-[14px] leading-snug"
                    style={{ color: isCurrent ? 'white' : 'oklch(1 0 0 / 0.45)' }}
                  >
                    {text}
                  </p>
                </div>
              )
            })}

            {/* Connector arrows */}
            <div className="flex flex-col items-center gap-0 -mt-1 mb-0 px-5">
              {[0, 1].map(i => (
                <div
                  key={i}
                  className="w-px transition-all duration-700"
                  style={{
                    height: '0px',
                    background: 'oklch(0.50 0.22 255 / 0.3)',
                    display: 'none',
                  }}
                />
              ))}
            </div>
          </div>

        </div>
      </div>
    </section>
  )
}
