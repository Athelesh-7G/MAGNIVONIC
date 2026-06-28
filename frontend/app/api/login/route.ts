import { NextResponse } from 'next/server'
import { SESSION_COOKIE, createSessionToken, sessionCookieOptions } from '@/lib/auth'

/**
 * Real credential check, server-side only. Credentials come from env vars
 * (ADMIN_USERNAME / ADMIN_PASSWORD) — never hardcoded in committed source.
 * On success we set a signed httpOnly session cookie.
 */
export async function POST(req: Request) {
  let body: { username?: string; password?: string }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid request.' }, { status: 400 })
  }

  const username = (body.username || '').trim()
  const password = body.password || ''

  const expectedUser = process.env.ADMIN_USERNAME
  const expectedPass = process.env.ADMIN_PASSWORD

  if (!expectedUser || !expectedPass) {
    return NextResponse.json(
      { error: 'Login is not configured on the server.' },
      { status: 500 },
    )
  }

  if (username !== expectedUser || password !== expectedPass) {
    return NextResponse.json(
      { error: 'Incorrect username or password.' },
      { status: 401 },
    )
  }

  const token = await createSessionToken(username)
  const res = NextResponse.json({ ok: true })
  res.cookies.set(SESSION_COOKIE, token, sessionCookieOptions)
  // Readable companion cookie (NOT httpOnly) so the marketing nav can render
  // the signed-in account state. Carries only the (non-sensitive) username.
  res.cookies.set('mv_user', username, {
    httpOnly: false,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: sessionCookieOptions.maxAge,
  })
  return res
}
