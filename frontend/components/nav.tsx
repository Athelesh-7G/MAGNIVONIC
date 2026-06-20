'use client'

import { Moon, Sun } from 'lucide-react'
import { useTheme } from '@/components/providers'

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

        {/* Logo + wordmark */}
        <a href="/" className="flex items-center gap-2.5">
          <MagnivonicMark />
          <span className="text-[15px] font-semibold tracking-tight text-foreground select-none">
            Magnivonic
          </span>
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
          {/* Launch Platform — disabled until the live dashboard ships */}
          <span
            role="button"
            aria-disabled="true"
            title="Coming soon"
            className="h-9 px-4 flex items-center gap-1.5 bg-primary/60 text-primary-foreground text-sm font-medium rounded-lg cursor-not-allowed select-none"
          >
            Launch Platform
            <span className="text-[10px] font-mono uppercase tracking-wider opacity-80 border border-primary-foreground/30 rounded px-1 py-px">
              Soon
            </span>
          </span>
        </div>

      </div>
    </header>
  )
}

/**
 * MagnivonicMark — a convergence aperture.
 * Six tapered blades angle inward to one bright core: many organizational
 * signals resolving into a single understanding. Rendered as a solid blue
 * badge with a white glyph so it reads as a real product logo at any size.
 */
// Six blades, evenly spaced, converging from outer radius 9 → inner 3.6.
// Coordinates are pre-rounded literals so server and client render identically
// (computing Math.sin at render time causes float-precision hydration mismatch).
const BLADES = [
  { x1: 21,   y1: 12,    x2: 15.6, y2: 12    },
  { x1: 16.5, y1: 19.79, x2: 13.8, y2: 15.12 },
  { x1: 7.5,  y1: 19.79, x2: 10.2, y2: 15.12 },
  { x1: 3,    y1: 12,    x2: 8.4,  y2: 12    },
  { x1: 7.5,  y1: 4.21,  x2: 10.2, y2: 8.88  },
  { x1: 16.5, y1: 4.21,  x2: 13.8, y2: 8.88  },
]

export function MagnivonicMark({ size = 24, plain = false }: { size?: number; plain?: boolean }) {
  const glyph = (stroke: string) => (
    <svg
      width={plain ? size : size * 0.64}
      height={plain ? size : size * 0.64}
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden="true"
    >
      {BLADES.map((b, i) => (
        <line
          key={i}
          x1={b.x1}
          y1={b.y1}
          x2={b.x2}
          y2={b.y2}
          stroke={stroke}
          strokeWidth="2.1"
          strokeLinecap="round"
        />
      ))}
      <circle cx="12" cy="12" r="2.2" fill={stroke} />
    </svg>
  )

  // Plain glyph (inherits currentColor) — used on dark cinematic surfaces
  if (plain) return glyph('currentColor')

  // Badge lockup — used in nav + footer
  return (
    <span
      className="inline-flex items-center justify-center rounded-[7px] bg-primary shrink-0"
      style={{ width: size, height: size }}
    >
      {glyph('var(--primary-foreground)')}
    </span>
  )
}
