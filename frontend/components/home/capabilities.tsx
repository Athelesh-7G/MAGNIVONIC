'use client'

import { Reveal } from '@/components/reveal'

const DOMAINS = [
  {
    index: '01',
    name: 'Revenue Protection',
    phrase: 'Every deal. Every signal. Nothing missed.',
    detail: 'Pipeline drift, champion changes, competitive activity, and usage drops – surfaced the moment they matter to a renewal outcome.',
  },
  {
    index: '02',
    name: 'Security Intelligence',
    phrase: 'Anomalies understood in business context.',
    detail: 'Access irregularities connected to customer health, contract status, and operational state – so security events carry the meaning the business needs.',
  },
  {
    index: '03',
    name: 'Churn Prevention',
    phrase: 'The whole account, not the last ticket.',
    detail: 'Support patterns, product usage, sentiment, and commercial signals assembled into one health picture – before the conversation arrives too late.',
  },
  {
    index: '04',
    name: 'Operational Resilience',
    phrase: 'Process breaks surface before they cascade.',
    detail: 'Capacity constraints, delivery delays, and workflow failures connected to their downstream commercial and customer impact in real time.',
  },
]

export function Capabilities() {
  return (
    <section id="capabilities" className="bg-background border-t border-border scroll-mt-20">
      <div className="max-w-[1280px] mx-auto px-8">
        <div className="flex items-center border-b border-border py-4">
          <span className="font-mono text-[11px] tracking-[0.25em] uppercase text-muted-foreground">
            {'>'} Capabilities
          </span>
        </div>

        <div className="py-16">
          <div className="max-w-xl mb-14">
            <h2 className="text-[clamp(28px,3.2vw,42px)] font-bold tracking-[-0.03em] leading-[1.08] text-foreground text-balance">
              One system.{' '}
              <span className="text-primary">Four domains.</span>
            </h2>
            <p className="mt-4 text-[17px] text-muted-foreground leading-relaxed">
              These are the applications of the operating system – what happens when specialized intelligence runs continuously across each part of your organization.
            </p>
          </div>

          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {DOMAINS.map(({ index, name, phrase, detail }, i) => (
              <Reveal
                key={index}
                delay={i * 0.08}
                className="border border-border rounded-xl p-6 bg-card hover:border-primary/50 hover:shadow-[0_0_0_1px_oklch(0.50_0.24_293/0.15)] transition-colors group"
              >
                <span className="font-mono text-[10px] tracking-[0.2em] uppercase text-muted-foreground/50 block mb-4">
                  {index}
                </span>
                <h3 className="text-[16px] font-bold text-foreground leading-snug mb-2 group-hover:text-primary transition-colors">
                  {name}
                </h3>
                <p className="text-[13px] text-foreground/90 leading-snug mb-3 font-semibold">
                  {phrase}
                </p>
                <p className="text-[13px] text-muted-foreground leading-relaxed">
                  {detail}
                </p>
              </Reveal>
            ))}
          </div>
        </div>
      </div>
    </section>
  )
}
