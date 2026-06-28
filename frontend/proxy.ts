import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { SESSION_COOKIE, verifySessionToken } from '@/lib/auth'

/**
 * Gate the live platform.
 *
 * Every /platform/* route fires real AWS/Bedrock calls, so we require a valid
 * session cookie before any of them render. The marketing homepage and all of
 * its sub-paths stay fully public (no matcher entry below). This is a separate,
 * prior layer to the activation/demo mechanism — once authenticated, the
 * ?demo=1 replay and localStorage activation state behave exactly as before.
 */
export async function proxy(req: NextRequest) {
  const token = req.cookies.get(SESSION_COOKIE)?.value
  const valid = await verifySessionToken(token)

  if (!valid) {
    const url = req.nextUrl.clone()
    url.pathname = '/login'
    // Preserve where they were headed so login can bounce them back.
    url.searchParams.set('from', req.nextUrl.pathname + req.nextUrl.search)
    return NextResponse.redirect(url)
  }

  return NextResponse.next()
}

export const config = {
  matcher: ['/platform/:path*'],
}
