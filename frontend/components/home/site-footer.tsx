import { MagnivonicMark } from '@/components/nav'

const FOOTER_COLS = [
  {
    heading: 'Product',
    links: [
      { label: 'Platform', href: '/#platform' },
      { label: 'How it works', href: '/#how-it-works' },
      { label: 'Proof', href: '/#proof' },
      { label: 'Why Magnivonic', href: '/#why' },
    ],
  },
  {
    heading: 'Architecture',
    links: [
      { label: 'Agent hierarchy', href: '/#platform' },
      { label: 'Infrastructure', href: '/#infrastructure' },
      { label: 'Organizational memory', href: '/#org-memory' },
    ],
  },
  {
    heading: 'Company',
    links: [
      { label: 'About', href: '/' },
      { label: 'Careers', href: '/' },
      { label: 'Privacy', href: '/' },
      { label: 'Terms', href: '/' },
    ],
  },
]

export function SiteFooter() {
  return (
    <footer className="bg-background border-t border-border overflow-hidden">
      <div className="max-w-[1280px] mx-auto px-8">

        {/* Top section */}
        <div className="py-16 grid grid-cols-2 md:grid-cols-[1.5fr_1fr_1fr_1fr] gap-10 md:gap-12">

          {/* Brand column */}
          <div>
            <div className="flex items-center gap-2 mb-4">
              <MagnivonicMark size={20} />
              <span className="text-[14px] font-semibold text-foreground">Magnivonic</span>
            </div>
            <p className="text-[13px] text-muted-foreground leading-relaxed max-w-[240px]">
              The core organizational intelligence layer for enterprises &mdash; reading, coordinating, and acting across every department, continuously.
            </p>
            <p className="mt-6 font-mono text-[10px] tracking-[0.15em] uppercase text-muted-foreground/50">
              © 2026 Magnivonic Inc.
            </p>
          </div>

          {/* Link columns */}
          {FOOTER_COLS.map(col => (
            <div key={col.heading}>
              <p className="font-mono text-[10px] tracking-[0.2em] uppercase text-muted-foreground/60 mb-4">
                {col.heading}
              </p>
              <ul className="space-y-2.5">
                {col.links.map(link => (
                  <li key={link.label}>
                    <a
                      href={link.href}
                      className="text-[13px] text-muted-foreground hover:text-foreground transition-colors"
                    >
                      {link.label}
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        {/* Bottom divider */}
        <div className="border-t border-border" />

        {/* Giant pale wordmark — Supermemory closing pattern */}
        <div className="relative overflow-hidden py-8 select-none pointer-events-none" aria-hidden>
          <p
            className="text-[clamp(80px,14vw,180px)] font-black tracking-[-0.04em] leading-none text-foreground/[0.04]"
            style={{ marginLeft: '-0.02em' }}
          >
            Magnivonic.
          </p>
        </div>

      </div>
    </footer>
  )
}
