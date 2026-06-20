const BASE_URL = 'https://tjysjf32v9.execute-api.us-east-1.amazonaws.com/prod'

async function apiFetch<T>(path: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE_URL}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(options?.headers ?? {}),
    },
  })
  if (!res.ok) {
    throw new Error(`API error ${res.status}: ${res.statusText}`)
  }
  return res.json() as Promise<T>
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

export interface Risk {
  id: string
  title: string
  severity: 'low' | 'medium' | 'high' | 'critical'
  confidence_score: number
  revenue_exposure: number
  root_cause: string
  status: string
  created_at: string
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

export interface AnalyzeResponse {
  risk_title: string
  root_cause: string
  overall_risk_score: number
  confidence_narrative: string
  cross_domain_connections: string[]
  recommended_actions: AnalyzeAction[]
  historical_precedent: string | null
  estimated_resolution_hours: number
  risk_id: string
  context: {
    combined_severity: string
    combined_confidence: number
    all_affected_customers: string[]
    evidence_count: number
    past_risks_found: number
  }
}

// ── Fetchers ───────────────────────────────────────────────────────────────

export const fetchHealth = (): Promise<HealthResponse> =>
  apiFetch<HealthResponse>('/health')

export const fetchCustomers = (): Promise<CustomersResponse> =>
  apiFetch<CustomersResponse>('/customers')

export const fetchRisks = (): Promise<RisksResponse> =>
  apiFetch<RisksResponse>('/risks')

export const triggerAnalysis = (trigger = 'manual'): Promise<AnalyzeResponse> =>
  apiFetch<AnalyzeResponse>('/analyze', {
    method: 'POST',
    body: JSON.stringify({ trigger }),
  })

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
