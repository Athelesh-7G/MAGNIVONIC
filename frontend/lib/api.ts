const BASE_URL = 'https://tjysjf32v9.execute-api.us-east-1.amazonaws.com/prod'

// Default timeout for simple reads. Analyze gets a longer one (see triggerAnalysis).
const DEFAULT_TIMEOUT_MS = 10_000

/**
 * Typed API error so the UI can distinguish a timeout/abort (cold-start, or a
 * request that exceeded API Gateway's 29s hard cap) from an HTTP failure and
 * render the appropriate, demo-presentable state.
 */
export class ApiError extends Error {
  status?: number
  isTimeout: boolean
  constructor(message: string, opts?: { status?: number; isTimeout?: boolean }) {
    super(message)
    this.name = 'ApiError'
    this.status = opts?.status
    this.isTimeout = opts?.isTimeout ?? false
  }
}

async function apiFetch<T>(
  path: string,
  options?: RequestInit,
  timeoutMs: number = DEFAULT_TIMEOUT_MS,
): Promise<T> {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeoutMs)
  try {
    const res = await fetch(`${BASE_URL}${path}`, {
      ...options,
      signal: controller.signal,
      headers: {
        'Content-Type': 'application/json',
        ...(options?.headers ?? {}),
      },
    })
    if (!res.ok) {
      throw new ApiError(`API error ${res.status}: ${res.statusText}`, { status: res.status })
    }
    return (await res.json()) as T
  } catch (e) {
    if (e instanceof ApiError) throw e
    if (e instanceof DOMException && e.name === 'AbortError') {
      throw new ApiError(`Request timed out after ${Math.round(timeoutMs / 1000)}s`, { isTimeout: true })
    }
    throw new ApiError(e instanceof Error ? e.message : 'Network error')
  } finally {
    clearTimeout(timer)
  }
}

// ── Types ──────────────────────────────────────────────────────────────────

export interface HealthResponse {
  service: string
  status: string
  version: string
  timestamp: string
}

export interface Customer {
  id: string
  name: string
  arr: number
  health_score: number
  renewal_date: string
  account_stage: string
  cs_tier: string
  tickets: number
  sentiment: number
  adoption: number
  anomaly_score: number
  api_calls: number
  api_baseline: number
}

export interface CustomersResponse {
  customers: Customer[]
  count: number
}

export interface Recommendation {
  department: string
  action: string
  priority: number
  urgency_hint: string
  status: string
}

export type InsightType = 'Risk' | 'Opportunity' | 'CoordinationGap' | 'Drift'

export interface Risk {
  id: string
  title: string
  severity: 'low' | 'medium' | 'high' | 'critical'
  confidence_score: number
  revenue_exposure: number
  root_cause: string
  status: string
  created_at: string
  insight_type: InsightType
  recommendations: Recommendation[] | null
}

export interface RisksResponse {
  risks: Risk[]
  count: number
}

export interface AnalyzeAction {
  department: string
  action: string
  urgency: string
  rationale: string
}

/** One typed insight from a live /analyze run — a run now yields 1-4 of these. */
export interface Insight {
  insight_type: InsightType
  account: string | null
  risk_title: string
  severity: 'low' | 'medium' | 'high' | 'critical'
  confidence: number
  overall_score: number
  root_cause: string
  confidence_narrative: string
  cross_domain_connections: string[]
  recommended_actions: AnalyzeAction[]
  historical_precedent: string | null
  estimated_resolution_hours: number
  risk_id: string | null
}

/** One domain's real finding as assembled by the Chief of Staff (coordinator).
 *  Keys: 'revenue' | 'operations' | 'customer' | 'security'. */
export interface AgentSummary {
  signal: string | null
  severity: string | null
  confidence: number | null
  affected: string[]
  description: string
}

export interface AnalyzeResponse {
  insights: Insight[]
  context: {
    combined_severity: string
    combined_confidence: number
    all_affected_customers: string[]
    evidence_count: number
    past_risks_found: number
    insight_type_counts: Partial<Record<InsightType, number>>
    /** Real per-domain summaries the Chief of Staff aggregated (may be absent
     *  if the deployed backend predates this field). */
    agent_summaries?: Record<string, AgentSummary>
  }
}

// ── Organizational Memory (GET /memory) ─────────────────────────────────────

export interface MemoryEntry {
  id: string
  summary: string
  outcome: string | null
  lessons_learned: string | null
  prevented_churn: boolean
  revenue_saved: number
  contributing_agents: string[]
  resolution_time_hours: number | null
  created_at: string | null
}

export interface MemoryResponse {
  memory: MemoryEntry[]
  count: number
}

// ── Debrief (POST /debrief) ──────────────────────────────────────────────────

export interface DebriefPrecedent {
  summary: string
  outcome: string | null
  lessons_learned: string | null
  similarity: number
}

export interface DebriefEvidence {
  id: string
  title: string
  severity: string
  confidence_score: number
  revenue_exposure: number
  root_cause: string
  created_at: string | null
}

export interface DebriefResponse {
  answer: string
  agents_consulted: string[]
  precedents: DebriefPrecedent[]
  evidence_used: DebriefEvidence[]
  /** Echoed back when the query was scoped to a team; null/absent when org-wide. */
  department?: string | null
}

/** The four real domain teams a Debrief chat can be scoped to. */
export type TeamDepartment = 'revenue' | 'operations' | 'customer' | 'security'

// ── Connections: GitHub (GET /github) ────────────────────────────────────────

export interface GithubSignals {
  open_prs: { count: number; titles: string[]; error: boolean }
  blocker_issues: { count: number; issues: string[]; error: boolean }
  recent_failures: { count: number; runs: string[]; error: boolean }
  commit_velocity: { commits_7d: number; commits_14d: number; trend: string; error: boolean }
}

export interface GithubResponse {
  connected: boolean
  repo: string
  repo_url: string
  signals: GithubSignals | null
  checked_at: string
}

// ── Connections: Slack (GET /slack) ──────────────────────────────────────────

export interface SlackAlert {
  id: string
  created_at: string | null
  severity: string
  risk_title: string
  account: string | null
  score: number | null
  confidence: number | null
  delivered: boolean
  status_code: number | null
  summary: string | null
}

export interface SlackResponse {
  connected: boolean
  channel: string
  alerts: SlackAlert[]
  total: number
}

export type SlackTemplate = 'risk' | 'opportunity' | 'coordination' | 'sync'

export interface SlackSendResponse {
  ok: boolean
  template: SlackTemplate
  delivered: boolean
  status_code: number | null
  alert: SlackAlert
}

/** Send one of the four real Block Kit templates via the live webhook (POST
 *  /slack). It actually posts to Slack and logs to slack_alerts. */
export const sendSlackTemplate = (template: SlackTemplate): Promise<SlackSendResponse> =>
  apiFetch<SlackSendResponse>(
    '/slack',
    { method: 'POST', body: JSON.stringify({ template }) },
    15_000,
  )

// ── Voice output (POST /speak — Amazon Polly) ───────────────────────────────

export interface SpeakResponse {
  audio: string // base64-encoded MP3
  format: string
  voice: string
}

/** Convert answer text to speech via Amazon Polly (neural). Returns a base64
 *  MP3 the client plays directly — no S3/presign. */
export const speakAnswer = (text: string): Promise<SpeakResponse> =>
  apiFetch<SpeakResponse>(
    '/speak',
    { method: 'POST', body: JSON.stringify({ text }) },
    20_000,
  )

// ── Fetchers ───────────────────────────────────────────────────────────────

export const fetchHealth = (): Promise<HealthResponse> =>
  apiFetch<HealthResponse>('/health')

export const fetchGithub = (): Promise<GithubResponse> =>
  apiFetch<GithubResponse>('/github')

export const fetchSlack = (): Promise<SlackResponse> =>
  apiFetch<SlackResponse>('/slack')

export const fetchCustomers = (): Promise<CustomersResponse> =>
  apiFetch<CustomersResponse>('/customers')

export const fetchRisks = (): Promise<RisksResponse> =>
  apiFetch<RisksResponse>('/risks')

export const fetchMemory = (): Promise<MemoryResponse> =>
  apiFetch<MemoryResponse>('/memory')

// 35s: above API Gateway's 29s hard cap so a real 504 surfaces as a catchable
// ApiError rather than the client aborting first; clears warm-path latency easily.
export const triggerAnalysis = (trigger = 'manual'): Promise<AnalyzeResponse> =>
  apiFetch<AnalyzeResponse>(
    '/analyze',
    { method: 'POST', body: JSON.stringify({ trigger }) },
    35_000,
  )

// 35s for the same reason as triggerAnalysis. /debrief does one embed + one
// Nova synthesis (lighter than /analyze's multi-agent cascade), but the binding
// limit is still API Gateway's 29s cap — going higher than ~30s buys nothing.
// Optional `department` scopes retrieval to one team's corpus at the SQL level
// (constraint applied before LIMIT, server-side) — omitted means org-wide.
export const debrief = (
  question: string,
  department?: TeamDepartment,
): Promise<DebriefResponse> =>
  apiFetch<DebriefResponse>(
    '/debrief',
    { method: 'POST', body: JSON.stringify(department ? { question, department } : { question }) },
    35_000,
  )

// ── Formatters ─────────────────────────────────────────────────────────────

export function formatCurrency(n: number): string {
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(2)}M`
  if (n >= 1_000) return `$${(n / 1_000).toFixed(0)}K`
  return `$${n}`
}

export function formatARR(n: number): string {
  return `$${(n / 1000).toFixed(0)}K ARR`
}

export function daysUntil(isoDate: string): number {
  const diff = new Date(isoDate).getTime() - Date.now()
  return Math.ceil(diff / (1000 * 60 * 60 * 24))
}
