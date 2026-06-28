'use client'

import { useEffect, useRef, useState } from 'react'

const CASCADE = [
  {
    agent: 'Security',
    time:  'T + 0',
    signal: 'Unusual access pattern detected on Vantage Retail Group account.',
    color:  'border-amber-400/60 bg-amber-400/5',
    dot:    'bg-amber-400',
  },
  {
    agent: 'Customer Success',
    time:  'T + 2 min',
    signal: 'Support ticket volume spikes – three product confusion tickets in 90 minutes.',
    color:  'border-sky-400/60 bg-sky-400/5',
    dot:    'bg-sky-400',
  },
  {
    agent: 'Revenue',
    time:  'T + 4 min',
    signal: 'Renewal opportunity flagged. Contract value material.',
    color:  'border-emerald-400/60 bg-emerald-400/5',
    dot:    'bg-emerald-400',
  },
  {
    agent: 'Chief of Staff',
    time:  'T + 4 min',
    signal: 'Three signals. Same account. Same 48-hour window. Unified picture assembled.',
    color:  'border-primary/60 bg-primary/5',
    dot:    'bg-primary',
  },
  {
    agent: 'General Manager',
    time:  'T + 5 min',
    signal: 'Single event. Coordinated response issued to Account Executive, Security, and CS – before any team acted alone.',
    color:  'border-primary bg-primary/10',
    dot:    'bg-primary',
    highlight: true,
  },
]

export function Proof() {
  const [revealed, setRevealed] = useState(0)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          let i = 0
          const id = setInterval(() => {
            i++
            setRevealed(i)
            if (i >= CASCADE.length) clearInterval(id)
          }, 480)
        }
      },
      { threshold: 0.25 }
    )
    if (ref.current) observer.observe(ref.current)
    return () => observer.disconnect()
  }, [])

  return (
    <section id="proof" className="bg-background border-t border-border">
      <div className="max-w-[1280px] mx-auto px-8">

        {/* Section label row */}
        <div className="flex items-center border-b border-border py-4">
          <span className="font-mono text-[11px] tracking-[0.25em] uppercase text-muted-foreground">
            {'>'} Proof
          </span>
        </div>

        <div className="py-24 grid lg:grid-cols-2 gap-12 lg:gap-20 items-start">

          {/* Left: the narrative */}
          <div>
            <p className="font-mono text-[11px] tracking-[0.2em] uppercase text-muted-foreground mb-5">Vantage Retail Group – a real situation</p>
            <h2 className="text-[clamp(28px,3.2vw,42px)] font-bold tracking-[-0.03em] leading-[1.08] text-foreground text-balance">
              A $1.41M renewal almost slipped through the gaps between three teams.
              <br />
              <span className="text-primary">Magnivonic saw the whole thing.</span>
            </h2>

            <div className="mt-8 space-y-5 text-[16px] text-muted-foreground leading-relaxed max-w-[440px]">
              <p>
                A security irregularity on Vantage Retail Group&apos;s account looked, on its own, like a routine access review. A rise in support tickets at the same account looked, on its own, like a product confusion issue. A renewal sitting on the pipeline looked, on its own, like any other deal.
              </p>
              <p>
                Magnivonic&apos;s domain agents each saw their own signal. The Chief of Staff brought them together. The General Manager recognized they were the same event – a customer showing friction, confusion, and access concerns simultaneously – and connected it to a renewal at risk.
              </p>
              <p>
                The coordinated response reached the Account Executive, Security team, and Customer Success manager before any of the three had individually escalated. The renewal closed.
              </p>
            </div>

            <div className="mt-10 inline-flex items-center gap-3 border border-border rounded-xl px-5 py-4">
              <div>
                <p className="text-[13px] text-muted-foreground">Revenue protected</p>
                <p className="text-[22px] font-black text-foreground tracking-tight">$1.41M</p>
              </div>
              <div className="w-px h-10 bg-border mx-2" />
              <div>
                <p className="text-[13px] text-muted-foreground">Teams coordinated</p>
                <p className="text-[22px] font-black text-foreground tracking-tight">3</p>
              </div>
              <div className="w-px h-10 bg-border mx-2" />
              <div>
                <p className="text-[13px] text-muted-foreground">Manual escalations</p>
                <p className="text-[22px] font-black text-foreground tracking-tight">0</p>
              </div>
            </div>
          </div>

          {/* Right: animated cascade timeline */}
          <div ref={ref} className="space-y-3 pt-2">
            {CASCADE.map((step, i) => (
              <div
                key={i}
                className={`border rounded-xl px-5 py-4 transition-all duration-500 ${step.color} ${
                  i < revealed ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-3'
                }`}
                style={{ transitionDelay: `${i * 60}ms` }}
              >
                <div className="flex items-center justify-between mb-1.5">
                  <div className="flex items-center gap-2">
                    <span className={`w-2 h-2 rounded-full shrink-0 ${step.dot}`} />
                    <span className="font-mono text-[10px] tracking-[0.2em] uppercase text-muted-foreground font-semibold">
                      {step.agent}
                    </span>
                  </div>
                </div>
                <p className={`text-[14px] leading-snug ${step.highlight ? 'text-foreground font-semibold' : 'text-foreground/90'}`}>
                  {step.signal}
                </p>
              </div>
            ))}
          </div>

        </div>
      </div>
    </section>
  )
}
