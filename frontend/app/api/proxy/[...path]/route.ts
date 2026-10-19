export const maxDuration = 60
export const dynamic = 'force-dynamic'

const ALLOWED_ROOTS = new Set([
  'analyze',
  'debrief',
  'speak',
  'customers',
  'risks',
  'memory',
  'health',
  'github',
  'slack',
])

type RouteContext = { params: Promise<{ path: string[] }> }

async function forward(req: Request, ctx: RouteContext): Promise<Response> {
  const { path } = await ctx.params
  if (!path || path.length === 0 || !ALLOWED_ROOTS.has(path[0])) {
    return new Response('Not found', { status: 404 })
  }

  const baseUrl = process.env.MAGNIVONIC_API_URL
  const apiKey = process.env.MAGNIVONIC_API_KEY
  if (!baseUrl || !apiKey) {
    return new Response('Proxy not configured', { status: 500 })
  }

  const target = `${baseUrl.replace(/\/+$/, '')}/${path.map(encodeURIComponent).join('/')}${new URL(req.url).search}`

  const headers: Record<string, string> = { 'x-api-key': apiKey }
  const init: RequestInit = { method: req.method, headers, cache: 'no-store' }
  if (req.method === 'POST') {
    headers['Content-Type'] = 'application/json'
    init.body = await req.text()
  }

  try {
    const upstream = await fetch(target, init)
    return new Response(await upstream.arrayBuffer(), {
      status: upstream.status,
      headers: {
        'Content-Type': upstream.headers.get('Content-Type') ?? 'application/json',
      },
    })
  } catch {
    return new Response('Upstream unavailable', { status: 502 })
  }
}

export async function GET(req: Request, ctx: RouteContext): Promise<Response> {
  return forward(req, ctx)
}

export async function POST(req: Request, ctx: RouteContext): Promise<Response> {
  return forward(req, ctx)
}
