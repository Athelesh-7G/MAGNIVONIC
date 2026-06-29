'use client'

import { useEffect, useState } from 'react'
import type { AnalyzeResponse } from './api'

/**
 * Activation state — the one-action "bring the organization online" gate.
 *
 * Before the first live scan this browser shows the platform AT REST (the live
 * surfaces — Intervention Canvas and Engine Room — are idle, with a single
 * prominent trigger). Running the real POST /analyze cascade flips activation on
 * and the live layer comes alive across the product in one motion.
 *
 * Honest framing: this is a presentation gate (localStorage), not a data reset.
 * The standing archive/substrate (Executive Briefs, Organizational Memory,
 * Dossiers, Connections) always shows its real data — only the "this session's
 * live scan" surfaces are gated. The scan itself is a real analysis run.
 * Clear localStorage to replay the cold-open before a demo.
 */
const ACTIVE_KEY = 'magnivonic_activated'
const SCAN_KEY = 'magnivonic_last_scan'
const RESULT_KEY = 'magnivonic_live_result'
const EVENT = 'magnivonic:activation'

/** Persist the most recent live /analyze result for the session so the Canvas
 *  keeps showing it across navigation, instead of reverting to the static
 *  /risks view on remount. Stored alongside activation; cleared on reset. The
 *  static-vs-live distinction is preserved — this only keeps the LIVE result
 *  available once a real scan has produced one. */
export function saveLiveResult(result: AnalyzeResponse): void {
  try {
    localStorage.setItem(RESULT_KEY, JSON.stringify(result))
  } catch {
    /* no-op */
  }
}

export function getLiveResult(): AnalyzeResponse | null {
  try {
    const raw = localStorage.getItem(RESULT_KEY)
    return raw ? (JSON.parse(raw) as AnalyzeResponse) : null
  } catch {
    return null
  }
}

/** Demo replay: visiting the platform with `?demo=1` (or `?replay=1`) forces the
 *  full two-phase activation sequence to play again, regardless of whether this
 *  browser has already activated — so a presenter can reliably show the
 *  connection-confirming moment on demand. Clearing localStorage achieves the
 *  same via resetActivation(). */
export function shouldReplay(): boolean {
  try {
    const q = new URLSearchParams(window.location.search)
    return q.has('demo') || q.has('replay')
  } catch {
    return false
  }
}

export function isActivated(): boolean {
  try {
    return localStorage.getItem(ACTIVE_KEY) === 'true'
  } catch {
    return false
  }
}

export function getLastScanAt(): string | null {
  try {
    return localStorage.getItem(SCAN_KEY)
  } catch {
    return null
  }
}

/** Mark the platform activated and stamp the scan time, then notify every
 *  mounted surface (same-tab via CustomEvent, cross-tab via storage). */
export function markActivated(): void {
  try {
    localStorage.setItem(ACTIVE_KEY, 'true')
    localStorage.setItem(SCAN_KEY, new Date().toISOString())
    window.dispatchEvent(new CustomEvent(EVENT))
  } catch {
    /* no-op */
  }
}

export function resetActivation(): void {
  try {
    localStorage.removeItem(ACTIVE_KEY)
    localStorage.removeItem(SCAN_KEY)
    localStorage.removeItem(RESULT_KEY)
    window.dispatchEvent(new CustomEvent(EVENT))
  } catch {
    /* no-op */
  }
}

/** Module-level cache of the last-known activation state. Populated only inside
 *  the effect (post-hydration), so the very first client render still matches
 *  the server (`false`) — no hydration mismatch. On every SUBSEQUENT mount (e.g.
 *  navigating between the four team pages, which re-mount the dynamic route) the
 *  hook initializes from this cache, so it renders the correct state on the
 *  first frame instead of flashing the AtRest cold-open and then correcting. */
let _activationCache: { activated: boolean; lastScanAt: string | null } | null = null

/** SSR-safe: renders `false` on the server and the first client paint (so no
 *  hydration mismatch), then resolves to the real localStorage value — and on
 *  later mounts uses the cache so navigation doesn't flash the cold-open. */
export function useActivation(): { activated: boolean; lastScanAt: string | null } {
  const [state, setState] = useState<{ activated: boolean; lastScanAt: string | null }>(
    () => _activationCache ?? { activated: false, lastScanAt: null },
  )

  useEffect(() => {
    const sync = () => {
      const next = { activated: isActivated(), lastScanAt: getLastScanAt() }
      _activationCache = next
      setState(next)
    }
    sync()
    window.addEventListener(EVENT, sync)
    window.addEventListener('storage', sync)
    return () => {
      window.removeEventListener(EVENT, sync)
      window.removeEventListener('storage', sync)
    }
  }, [])

  return state
}
