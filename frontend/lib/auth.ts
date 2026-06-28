/**
 * Lightweight session auth for the live platform gate.
 *
 * This is intentionally simple — its job is to stop casual/accidental use of a
 * public demo URL, NOT to be enterprise-grade security. A signed (HMAC-SHA256)
 * httpOnly cookie is issued on successful credential check and verified in
 * middleware. Credentials live in env vars (ADMIN_USERNAME / ADMIN_PASSWORD),
 * never in committed source.
 *
 * Uses the Web Crypto API so the same code runs in both the Edge middleware and
 * Node route handlers.
 */

export const SESSION_COOKIE = 'mv_session'
const MAX_AGE_SECONDS = 60 * 60 * 24 * 7 // 7 days

function getSecret(): string {
  // SESSION_SECRET should be set in production (Vercel). The dev fallback keeps
  // local development frictionless; it is NOT a security boundary.
  return process.env.SESSION_SECRET || 'magnivonic-dev-session-secret-change-in-prod'
}

const enc = new TextEncoder()

function base64url(bytes: Uint8Array): string {
  let bin = ''
  for (const b of bytes) bin += String.fromCharCode(b)
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

function fromBase64url(s: string): Uint8Array {
  const pad = s.length % 4 === 0 ? '' : '='.repeat(4 - (s.length % 4))
  const bin = atob(s.replace(/-/g, '+').replace(/_/g, '/') + pad)
  const out = new Uint8Array(bin.length)
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i)
  return out
}

async function hmac(payload: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    'raw',
    enc.encode(getSecret()),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  )
  const sig = await crypto.subtle.sign('HMAC', key, enc.encode(payload))
  return base64url(new Uint8Array(sig))
}

/** Create a signed session token for a username. */
export async function createSessionToken(username: string): Promise<string> {
  const payload = base64url(
    enc.encode(JSON.stringify({ u: username, iat: Date.now() })),
  )
  const sig = await hmac(payload)
  return `${payload}.${sig}`
}

/** Verify a session token's signature and expiry. Returns true if valid. */
export async function verifySessionToken(token: string | undefined): Promise<boolean> {
  if (!token) return false
  const [payload, sig] = token.split('.')
  if (!payload || !sig) return false
  const expected = await hmac(payload)
  // Constant-ish-time compare (length + char equality).
  if (sig.length !== expected.length) return false
  let diff = 0
  for (let i = 0; i < sig.length; i++) diff |= sig.charCodeAt(i) ^ expected.charCodeAt(i)
  if (diff !== 0) return false
  try {
    const data = JSON.parse(new TextDecoder().decode(fromBase64url(payload))) as {
      iat?: number
    }
    if (!data.iat) return false
    if (Date.now() - data.iat > MAX_AGE_SECONDS * 1000) return false
    return true
  } catch {
    return false
  }
}

export const sessionCookieOptions = {
  httpOnly: true,
  sameSite: 'lax' as const,
  secure: process.env.NODE_ENV === 'production',
  path: '/',
  maxAge: MAX_AGE_SECONDS,
}
