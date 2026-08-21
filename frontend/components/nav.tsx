'use client'

import { useTheme } from '@/components/providers'
import { MagnivonicLockup } from '@/components/brand'

const NAV_LINKS = [
  { label: 'Platform',     href: '/#platform' },
  { label: 'How it works', href: '/#how-it-works' },
  { label: 'Proof',        href: '/#proof' },
]

export function Nav() {
  const { theme, toggle } = useTheme()

  return (
    <header className="fixed top-0 left-0 right-0 z-50 bg-background/95 backdrop-blur-sm border-b border-border">
      <div className="max-w-[1280px] mx-auto px-8 h-[60px] flex items-center justify-between">

        {/* Logo lockup (mark + wordmark), ~30px tall */}
        <a href="/" className="flex items-center" aria-label="Magnivonic home">
          <MagnivonicLockup height={30} />
        </a>

        {/* Center nav */}
        <nav className="flex items-center">
          {NAV_LINKS.map(l => (
            <a
              key={l.label}
              href={l.href}
              className="px-4 py-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
            >
              {l.label}
            </a>
          ))}
        </nav>

        {/* Right: theme toggle + CTA */}
        <div className="flex items-center gap-2">
          <button
            onClick={toggle}
            aria-label="Toggle theme"
            className="w-9 h-9 flex items-center justify-center rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
          >
            {theme === 'dark' ? <Sun size={15} strokeWidth={2} /> : <Moon size={15} strokeWidth={2} />}
          </button>
          <a
            href="/platform"
            className="h-9 px-4 flex items-center gap-1.5 bg-primary text-primary-foreground text-sm font-medium rounded-lg hover:bg-primary/90 transition-colors"
          >
            Launch Platform
            <span className="opacity-70">→</span>
          </a>
        </div>

      </div>
    </header>
  )
}
