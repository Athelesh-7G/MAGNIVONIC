'use client'

import Link from 'next/link'
import { PageHeader } from './page-header'

/** The genuinely-empty pre-activation state for a standing surface. Until the
 *  first real scan brings the platform online, every page (except the two
 *  activation surfaces — the Canvas and the Engine Room, which carry the
 *  trigger) reads as at rest, with a single path to activate. */
export function AtRest({
  eyebrow,
  title,
  surface,
}: {
  eyebrow: string
  title: string
  surface: string
}) {
  return (
    <div className="max-w-[1100px] mx-auto px-8 py-8">
      <PageHeader
        eyebrow={eyebrow}
        title={title}
        subtitle="At rest — this surface comes online once the organization's intelligence layer is activated."
      />
      <div className="mt-6 rounded-2xl border border-dashed border-border bg-card/40 px-8 py-16 text-center">
        <span className="inline-flex items-center gap-2 text-xs uppercase tracking-widest text-muted-foreground mb-4">
          <span className="w-1.5 h-1.5 rounded-full" style={{ background: 'var(--muted-foreground)' }} />
          At rest · not yet activated
        </span>
        <h3 className="text-base font-semibold text-foreground">{surface} comes online with the first scan.</h3>
        <p className="text-sm text-muted-foreground mt-2 max-w-md mx-auto leading-relaxed">
          Nothing has run this session — no data is shown rather than a stale or pre-populated view. Run the first
          scan to bring the intelligence layer online.
        </p>
        <Link
          href="/platform"
          className="mt-5 h-9 px-4 inline-flex items-center gap-2 rounded-lg text-sm font-semibold bg-primary text-primary-foreground hover:bg-primary/90 transition-colors"
        >
          Go to the Intervention Canvas →
        </Link>
      </div>
    </div>
  )
}
