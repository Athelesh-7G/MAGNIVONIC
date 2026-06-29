'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { MagnivonicLockup } from '@/components/brand'

export default function LoginPage() {
  const router = useRouter()
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [comingSoon, setComingSoon] = useState('')
  const [loading, setLoading] = useState(false)

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setComingSoon('')
    setLoading(true)
    try {
      const res = await fetch('/api/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password }),
      })
      if (res.ok) {
        // Bounce back to where they were headed, defaulting to the platform.
        const from = new URLSearchParams(window.location.search).get('from')
        const dest = from && from.startsWith('/platform') ? from : '/platform'
        router.replace(dest)
        return
      }
      const data = await res.json().catch(() => ({}))
      setError(data.error || 'Sign in failed. Please try again.')
    } catch {
      setError('Network error. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  function notWired(provider: string) {
    setError('')
    setComingSoon(`${provider} sign-in is coming soon.`)
  }

  return (
    <div className="platform-scope min-h-screen flex flex-col bg-background text-foreground">
      {/* Ambient violet field */}
      <div
        aria-hidden
        className="pointer-events-none fixed inset-0"
        style={{
          background:
            'radial-gradient(ellipse 70% 55% at 50% 0%, oklch(0.541 0.247 293 / 0.10) 0%, transparent 60%)',
        }}
      />

      <div className="relative flex-1 flex items-center justify-center px-6 py-12">
        <div className="w-full max-w-[400px]">
          {/* Brand lockup */}
          <a href="/" className="flex items-center justify-center mb-8" aria-label="Magnivonic home">
            <MagnivonicLockup height={40} />
          </a>

          <div className="rounded-2xl border border-border bg-card shadow-[0_20px_60px_-20px_oklch(0.2_0.05_293/0.25)] p-8">
            <div className="text-center mb-7">
              <h1 className="text-[22px] font-semibold tracking-tight">Sign in to the platform</h1>
              <p className="mt-1.5 text-[13px] text-muted-foreground">
                The live intelligence desk is private. Sign in to continue.
              </p>
            </div>

            {/* OAuth (decorative — not wired) */}
            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => notWired('Google')}
                className="h-11 inline-flex items-center justify-center gap-2 rounded-xl border border-border bg-background text-[14px] font-medium hover:bg-muted transition-colors"
              >
                <GoogleIcon /> Google
              </button>
              <button
                type="button"
                onClick={() => notWired('Apple')}
                className="h-11 inline-flex items-center justify-center gap-2 rounded-xl border border-border bg-background text-[14px] font-medium hover:bg-muted transition-colors"
              >
                <AppleIcon /> Apple
              </button>
            </div>

            <div className="flex items-center gap-3 my-6">
              <div className="flex-1 h-px bg-border" />
              <span className="text-[11px] uppercase tracking-[0.15em] text-muted-foreground">or</span>
              <div className="flex-1 h-px bg-border" />
            </div>

            {/* Credentials */}
            <form onSubmit={onSubmit} className="space-y-4">
              <div>
                <label htmlFor="username" className="block text-[13px] font-medium mb-1.5">
                  Username
                </label>
                <input
                  id="username"
                  type="text"
                  autoComplete="username"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  required
                  className="w-full h-11 px-3.5 rounded-xl border border-input bg-background text-[14px] outline-none transition-shadow focus:ring-2 focus:ring-ring/40 focus:border-ring"
                />
              </div>
              <div>
                <label htmlFor="password" className="block text-[13px] font-medium mb-1.5">
                  Password
                </label>
                <input
                  id="password"
                  type="password"
                  autoComplete="current-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  className="w-full h-11 px-3.5 rounded-xl border border-input bg-background text-[14px] outline-none transition-shadow focus:ring-2 focus:ring-ring/40 focus:border-ring"
                />
              </div>

              {error && (
                <p className="text-[13px] text-destructive" role="alert">
                  {error}
                </p>
              )}
              {comingSoon && (
                <p className="text-[13px] text-muted-foreground" role="status">
                  {comingSoon}
                </p>
              )}

              <button
                type="submit"
                disabled={loading}
                className="w-full h-11 rounded-xl bg-primary text-primary-foreground text-[14px] font-semibold hover:bg-primary/90 transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
              >
                {loading ? 'Signing in…' : 'Sign in'}
              </button>
            </form>
          </div>

          <p className="mt-6 text-center text-[12px] text-muted-foreground">
            Protected access · authorized users only.{' '}
            <a href="/" className="text-foreground hover:underline">
              Back to site
            </a>
          </p>
        </div>
      </div>
    </div>
  )
}

function GoogleIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 18 18" aria-hidden>
      <path
        fill="#4285F4"
        d="M17.64 9.2c0-.64-.06-1.25-.16-1.84H9v3.48h4.84a4.14 4.14 0 0 1-1.8 2.72v2.26h2.92c1.7-1.57 2.68-3.88 2.68-6.62z"
      />
      <path
        fill="#34A853"
        d="M9 18c2.43 0 4.47-.8 5.96-2.18l-2.92-2.26c-.8.54-1.84.86-3.04.86-2.34 0-4.32-1.58-5.03-3.7H.96v2.33A9 9 0 0 0 9 18z"
      />
      <path
        fill="#FBBC05"
        d="M3.97 10.72a5.4 5.4 0 0 1 0-3.44V4.95H.96a9 9 0 0 0 0 8.1l3.01-2.33z"
      />
      <path
        fill="#EA4335"
        d="M9 3.58c1.32 0 2.5.45 3.44 1.35l2.58-2.58C13.47.9 11.43 0 9 0A9 9 0 0 0 .96 4.95l3.01 2.33C4.68 5.16 6.66 3.58 9 3.58z"
      />
    </svg>
  )
}

function AppleIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
      <path d="M16.36 12.78c.02 2.5 2.19 3.33 2.21 3.34-.02.06-.35 1.2-1.15 2.37-.69 1.02-1.41 2.03-2.55 2.05-1.12.02-1.48-.66-2.76-.66s-1.68.64-2.74.68c-1.1.04-1.94-1.1-2.64-2.11-1.42-2.07-2.51-5.85-1.05-8.4.72-1.27 2.02-2.07 3.42-2.09 1.08-.02 2.1.73 2.76.73.66 0 1.9-.9 3.2-.77.54.02 2.07.22 3.05 1.65-.08.05-1.82 1.07-1.8 3.2zM14.28 5.1c.6-.72 1-1.73.89-2.73-.86.03-1.9.57-2.52 1.29-.55.64-1.04 1.66-.91 2.64.96.07 1.94-.49 2.54-1.2z" />
    </svg>
  )
}
