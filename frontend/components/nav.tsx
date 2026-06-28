'use client'

import { useEffect, useRef, useState } from 'react'
import { Moon, Sun, LogOut, ArrowRight } from 'lucide-react'
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
          <AccountControl />
        </div>

      </div>
    </header>
  )
}

function readCookie(name: string): string | null {
  if (typeof document === 'undefined') return null
  const m = document.cookie.match(new RegExp('(?:^|; )' + name + '=([^;]*)'))
  return m ? decodeURIComponent(m[1]) : null
}

/**
 * AccountControl — reflects login state in the marketing nav.
 * Signed out: "Launch Platform" → /login (the gate). Signed in (readable
 * mv_user cookie present): an initials avatar with a small dropdown to open the
 * platform or sign out. SSR-safe: renders the signed-out CTA until mount, then
 * resolves to the real state (no hydration flash of the wrong control).
 */
function AccountControl() {
  const [user, setUser] = useState<string | null>(null)
  const [ready, setReady] = useState(false)
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    setUser(readCookie('mv_user'))
    setReady(true)
  }, [])

  useEffect(() => {
    if (!open) return
    const onDoc = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', onDoc)
    return () => document.removeEventListener('mousedown', onDoc)
  }, [open])

  async function signOut() {
    try {
      await fetch('/api/logout', { method: 'POST' })
    } catch {
      /* best-effort */
    }
    setUser(null)
    setOpen(false)
  }

  // Until mounted (and when signed out), show the CTA → the login gate.
  if (!ready || !user) {
    return (
      <a
        href="/login"
        className="h-9 px-4 flex items-center gap-1.5 bg-primary text-primary-foreground text-sm font-medium rounded-lg hover:bg-primary/90 transition-colors"
      >
        Launch Platform
        <span className="opacity-70">→</span>
      </a>
    )
  }

  const initials = (user.match(/[a-zA-Z]/g)?.slice(0, 2).join('') || user.slice(0, 2))
    .toUpperCase()

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen((o) => !o)}
        aria-label="Account"
        aria-expanded={open}
        className="w-9 h-9 flex items-center justify-center rounded-full bg-primary text-primary-foreground text-xs font-semibold hover:bg-primary/90 transition-colors"
      >
        {initials}
      </button>

      {open && (
        <div className="absolute right-0 mt-2 w-52 rounded-xl border border-border bg-card shadow-[0_16px_40px_-16px_rgba(0,0,0,0.3)] p-1.5 z-50">
          <div className="px-3 py-2">
            <p className="text-[11px] uppercase tracking-wider text-muted-foreground">Signed in</p>
            <p className="text-sm font-medium text-foreground truncate">{user}</p>
          </div>
          <div className="h-px bg-border my-1" />
          <a
            href="/platform"
            className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm text-foreground hover:bg-muted transition-colors"
          >
            <ArrowRight size={15} strokeWidth={2} />
            Open platform
          </a>
          <button
            onClick={signOut}
            className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm text-foreground hover:bg-muted transition-colors"
          >
            <LogOut size={15} strokeWidth={2} />
            Sign out
          </button>
        </div>
      )}
    </div>
  )
}

/**
 * MagnivonicMark — the Monogram Peak.
 * A geometric "M" whose inner diagonals rise to a raised centre vertex — a peak
 * (magnitude / intelligence rising), with the negative space beneath reading as
 * a subtle "V" (Magni·vonic). Name-tied and ownable: hard to mistake for stock
 * aperture/sparkle iconography. A single round-joined polyline, so it stays
 * crisp from favicon size up and renders identically on server and client.
 */
// Pre-rounded literal coordinates (no runtime math → no hydration drift).
// Side stems (x=5, x=19) run y19→y11; inner diagonals rise to the apex (12, 4.5).
const PEAK_PATH = 'M5 19 L5 11 L12 4.5 L19 11 L19 19'

export function MagnivonicMark({ size = 24, plain = false }: { size?: number; plain?: boolean }) {
  const glyph = (stroke: string) => (
    <svg
      width={plain ? size : size * 0.64}
      height={plain ? size : size * 0.64}
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden="true"
    >
      <path
        d={PEAK_PATH}
        stroke={stroke}
        strokeWidth="2.2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
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
