'use client'

import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Moon, Sun, Power, LogOut } from 'lucide-react'
import { useTheme } from '@/components/providers'
import { MagnivonicMark } from '@/components/nav'
import { useActivation, resetActivation } from '@/lib/activation'
import { OK, CRIT } from '@/components/platform/signal-ui'

/** Veloquity-style 64px sticky app header: backdrop-blur, brand left, theme right. */
export function PlatformTopbar() {
  const { theme, toggle } = useTheme()
  const { activated } = useActivation()
  return (
    <header className="h-16 border-b border-border bg-background/80 backdrop-blur-xl sticky top-0 z-40">
      <div className="flex items-center justify-between h-full px-4">
        <div className="flex items-center gap-3">
          <Link href="/" className="flex items-center gap-2.5 hover:opacity-80 transition-opacity">
            <MagnivonicMark size={24} />
            <span className="text-base font-semibold tracking-tight text-foreground">Magnivonic</span>
          </Link>
          <div className="h-6 w-px bg-border hidden md:block" />
          {/* The cross-page "alive" signal — at rest until the first scan, then
              live across the whole product in one motion. */}
          {activated ? (
            <span className="flex items-center gap-1.5 text-xs tracking-[0.2em] uppercase hidden md:flex" style={{ color: OK }}>
              <span className="w-1.5 h-1.5 rounded-full animate-pulse-dot" style={{ background: OK }} />
              Live
            </span>
          ) : (
            <span className="flex items-center gap-1.5 text-xs tracking-[0.2em] uppercase text-muted-foreground hidden md:flex">
              <span className="w-1.5 h-1.5 rounded-full" style={{ background: 'var(--muted-foreground)' }} />
              At rest
            </span>
          )}
        </div>

        <div className="flex items-center gap-2">
          {/* Disconnect — only when the platform is live. A distinct, more total
              action than "Run again": it clears every activation key and returns
              the WHOLE platform to its true cold-open state. */}
          {activated ? <DisconnectControl /> : null}

          <button
            onClick={toggle}
            aria-label="Toggle theme"
            className="w-9 h-9 flex items-center justify-center rounded-lg text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
          >
            {theme === 'dark' ? <Sun size={16} strokeWidth={2} /> : <Moon size={16} strokeWidth={2} />}
          </button>

          <LogoutControl />
        </div>
      </div>
    </header>
  )
}

/** Sign out: clears the session cookie, then returns to the login gate. */
function LogoutControl() {
  const router = useRouter()
  const [busy, setBusy] = useState(false)

  async function logout() {
    setBusy(true)
    try {
      await fetch('/api/logout', { method: 'POST' })
    } catch {
      /* clearing the cookie best-effort; navigate regardless */
    }
    router.replace('/login')
  }

  return (
    <button
      type="button"
      onClick={logout}
      disabled={busy}
      aria-label="Sign out"
      title="Sign out"
      className="w-9 h-9 flex items-center justify-center rounded-lg text-muted-foreground hover:text-foreground hover:bg-accent transition-colors disabled:opacity-60"
    >
      <LogOut size={16} strokeWidth={2} />
    </button>
  )
}

/** Two-click confirm so a stray click can't wipe a live demo mid-flow. */
function DisconnectControl() {
  const [confirming, setConfirming] = useState(false)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    if (confirming) {
      timerRef.current = setTimeout(() => setConfirming(false), 3500)
    }
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current)
    }
  }, [confirming])

  if (confirming) {
    return (
      <div className="flex items-center gap-1.5">
        <button
          type="button"
          onClick={() => {
            resetActivation()
            setConfirming(false)
          }}
          className="h-8 px-2.5 inline-flex items-center gap-1.5 rounded-lg text-xs font-semibold transition-colors"
          style={{ color: CRIT, background: `color-mix(in oklch, ${CRIT} 12%, transparent)` }}
        >
          <Power size={13} strokeWidth={2.2} />
          Reset platform
        </button>
        <button
          type="button"
          onClick={() => setConfirming(false)}
          className="h-8 px-2 inline-flex items-center rounded-lg text-xs text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
        >
          cancel
        </button>
      </div>
    )
  }

  return (
    <button
      type="button"
      onClick={() => setConfirming(true)}
      title="Disconnect — reset every page to its pre-connection state"
      className="h-8 px-2.5 inline-flex items-center gap-1.5 rounded-lg text-xs font-medium text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
    >
      <Power size={13} strokeWidth={2} />
      <span className="hidden sm:inline">Disconnect</span>
    </button>
  )
}
