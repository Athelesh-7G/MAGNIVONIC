import { Nav } from '@/components/nav'
import { LivePlatform } from '@/components/platform/live-platform'
import { SiteFooter } from '@/components/home/site-footer'
import { Reveal } from '@/components/reveal'

export const metadata = {
  title: 'Platform — Magnivonic',
  description:
    'The architecture behind the organizational intelligence layer. Four domain agents, a Coordinator, and an Orchestrator — running live on AWS against real data.',
}

export default function PlatformPage() {
  return (
    <>
      <Nav />
      <main className="bg-background">
        {/* Platform hero */}
        <section className="dot-grid border-b border-border">
          <div className="max-w-[1280px] mx-auto px-8 pt-[128px] pb-16">
            <Reveal className="max-w-2xl">
              <span className="inline-flex items-center gap-1.5 mb-6 font-mono text-[11px] tracking-[0.25em] uppercase text-primary">
                <span className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse-dot" />
                Platform
              </span>
              <h1 className="text-[clamp(40px,5vw,64px)] font-black tracking-[-0.035em] leading-[1.0] text-foreground text-balance">
                The mechanism behind{' '}
                <span className="text-primary">the understanding.</span>
              </h1>
              <p className="mt-6 text-[18px] text-muted-foreground leading-relaxed max-w-[560px]">
                Four parallel domain agents, a Coordinator, and an Orchestrator with live
                organizational memory — wired to real AWS infrastructure and real data.
              </p>
            </Reveal>
          </div>
        </section>

        <LivePlatform />
      </main>
      <SiteFooter />
    </>
  )
}
