import { NextResponse } from 'next/server'
import { SESSION_COOKIE } from '@/lib/auth'

/** Clear the session cookie. */
export async function POST(req: Request) {
  const res = NextResponse.json({ ok: true })
  res.cookies.set(SESSION_COOKIE, '', {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: 0,
  })
  // Clear the readable account cookie too.
  res.cookies.set('mv_user', '', {
    httpOnly: false,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: 0,
  })
  // Some callers prefer a redirect; honour ?redirect=1 by sending them home.
  const url = new URL(req.url)
  if (url.searchParams.get('redirect') === '1') {
    return NextResponse.redirect(new URL('/login', req.url), { headers: res.headers })
  }
  return res
}
