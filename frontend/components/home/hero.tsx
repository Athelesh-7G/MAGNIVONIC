'use client'

import { useRef } from 'react'
import { motion, useMotionValue, useMotionTemplate, useScroll, useTransform } from 'framer-motion'
import { SignalFlow } from './signal-flow'

const MARQUEE_ITEMS = [
  'B2B Enterprise SaaS',
  'Healthcare Systems',
  'Public Sector & Government',
  'Financial Services',
  'High-Growth Startups',
  'Logistics & Supply Chain',
]
// Duplicated exactly twice so the -50% keyframe loops seamlessly
const LOOP = [...MARQUEE_ITEMS, ...MARQUEE_ITEMS]

export function Hero() {
  const ref = useRef<HTMLElement>(null)
  // Mouse-follow spotlight (Veloquity's hero pattern) + scroll parallax on the
  // animation layer — purposeful depth, not decoration.
  const mouseX = useMotionValue(0)
  const mouseY = useMotionValue(0)
  const spotlight = useMotionTemplate`radial-gradient(560px circle at ${mouseX}px ${mouseY}px, oklch(0.54 0.25 293 / 0.10), transparent 72%)`
  const { scrollYProgress } = useScroll({ target: ref, offset: ['start start', 'end start'] })
  const flowY = useTransform(scrollYProgress, [0, 1], [0, 110])

  return (
    <section
      ref={ref}
      onMouseMove={(e) => {
        const r = e.currentTarget.getBoundingClientRect()
        mouseX.set(e.clientX - r.left)
        mouseY.set(e.clientY - r.top)
      }}
      className="relative min-h-screen flex flex-col bg-background overflow-hidden"
    >
      {/* ── Background layers ── */}
      <div aria-hidden className="absolute inset-0 dot-grid" />
      {/* The signature animation — full-bleed, drifts gently on scroll */}
      <motion.div aria-hidden className="absolute inset-0" style={{ y: flowY }}>
        <SignalFlow variant="light" />
      </motion.div>
      {/* Mouse-follow violet spotlight */}
      <motion.div aria-hidden className="pointer-events-none absolute inset-0 hidden md:block" style={{ background: spotlight }} />
      {/* Vertical mask: keep the headline zone clean, let streams glow lower */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            'linear-gradient(to bottom, var(--background) 8%, transparent 46%, transparent 82%, var(--background) 100%)',
        }}
      />
      {/* Horizontal edge fade */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            'linear-gradient(to right, var(--background), transparent 16%, transparent 84%, var(--background))',
        }}
      />

      {/* ── Content: everything centered as one group in the convergence zone ── */}
      <div className="relative flex-1 flex flex-col items-center justify-center w-full max-w-[1180px] mx-auto px-8 pt-[72px] pb-6 text-center">
        {/* Announcement chip */}
        <div className="inline-flex items-center mb-8 border border-border rounded-full overflow-hidden text-sm bg-card/70 backdrop-blur-sm animate-fade-up">
          <span className="flex items-center gap-1.5 bg-primary px-3 py-[5px] text-primary-foreground font-mono text-[11px] tracking-widest uppercase font-semibold">
            <span className="w-1.5 h-1.5 rounded-full bg-primary-foreground/80 animate-pulse-dot" />
            New
          </span>
          <span className="px-3 py-[5px] text-muted-foreground">
            Organizational Memory is now active &rarr;
          </span>
        </div>

        {/* Headline — Supermemory-scale, balanced with breathing room */}
        <h1
          className="text-[clamp(40px,5.4vw,76px)] leading-[1.02] font-black tracking-[-0.035em] text-foreground text-balance max-w-[920px] mx-auto animate-fade-up"
          style={{ animationDelay: '0.05s' }}
        >
          The organizational intelligence layer
          {' '}
          <span className="text-primary">for the enterprise.</span>
        </h1>

        {/* Subtitle — one coherent thought */}
        <p
          className="mt-7 text-[19px] md:text-[20px] leading-relaxed text-muted-foreground max-w-[860px] mx-auto text-pretty animate-fade-up"
          style={{ animationDelay: '0.12s' }}
        >
          Magnivonic reads every team your business runs on &mdash; sales, engineering, support,
          security &mdash; and reasons across them to surface what no single team sees on its own:
          risks, opportunities, and coordination gaps. Each finding is carried through to a clear,
          evidence-backed recommendation for the people who decide.
        </p>

        {/* CTAs */}
        <div
          className="mt-9 flex items-center justify-center gap-3 flex-wrap animate-fade-up"
          style={{ animationDelay: '0.19s' }}
        >
          <a
            href="/platform"
            className="h-12 px-6 inline-flex items-center gap-2 bg-primary text-primary-foreground text-[15px] font-semibold rounded-xl hover:bg-primary/90 transition-colors shadow-[0_8px_30px_-8px_oklch(0.50_0.24_293/0.5)]"
          >
            Launch Platform
            <span>→</span>
          </a>
          <a
            href="#how-it-works"
            className="h-12 px-6 inline-flex items-center border border-border bg-card/70 backdrop-blur-sm text-foreground text-[15px] font-medium rounded-xl hover:bg-muted transition-colors"
          >
            See how it works
          </a>
        </div>

        {/* Continuous marquee — part of the centered group, no dead gap */}
        <div
          className="w-full max-w-[940px] mx-auto mt-8 animate-fade-up"
          style={{ animationDelay: '0.26s' }}
        >
          <p className="font-mono text-[13px] tracking-[0.25em] uppercase text-foreground/70 mb-4">
            Built for every kind of organization, in every industry
          </p>
          <div className="border-y border-border py-4 relative overflow-hidden group">
            <div className="absolute left-0 top-0 bottom-0 w-24 bg-gradient-to-r from-background to-transparent z-10 pointer-events-none" />
            <div className="absolute right-0 top-0 bottom-0 w-24 bg-gradient-to-l from-background to-transparent z-10 pointer-events-none" />

            <div className="flex w-max animate-marquee group-hover:[animation-play-state:paused]">
              {LOOP.map((item, i) => (
                <div key={i} className="flex items-center shrink-0">
                  <span className="text-[18px] font-semibold text-foreground/90 tracking-tight px-6 whitespace-nowrap">
                    {item}
                  </span>
                  <span className="w-1.5 h-1.5 rounded-full bg-primary/50 select-none" />
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
