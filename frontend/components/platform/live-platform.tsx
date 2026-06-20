'use client'

import { useState } from 'react'
import useSWR from 'swr'
import { cn } from '@/lib/utils'
import { Reveal } from '@/components/reveal'
import {
  fetchCustomers,
  fetchRisks,
  triggerAnalysis,
  formatARR,
  daysUntil,
  type Customer,
  type Risk,
  type AnalyzeResponse,
} from '@/lib/api'

const customerFetcher = () => fetchCustomers()
const riskFetcher = () => fetchRisks()

// Semantic status colors (work in light + dark)
const OK = 'oklch(0.62 0.17 150)'
const WARN = 'oklch(0.68 0.17 65)'
const CRIT = 'oklch(0.58 0.22 25)'

function HealthBar({ score }: { score: number }) {
  const color = score >= 70 ? OK : score >= 50 ? WARN : CRIT
  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 h-1.5 rounded-full bg-muted">
        <div
          className="h-full rounded-full transition-all duration-700"
          style={{ width: `${score}%`, background: color }}
        />
      </div>
      <span className="text-[10px] font-mono text-muted-foreground w-5 text-right">{score}</span>
    </div>
  )
}

function SeverityBadge({ severity }: { severity: Risk['severity'] }) {
  const map: Record<string, string> = {
    critical: CRIT,
    high: WARN,
    medium: 'oklch(0.50 0.22 255)',
    low: 'oklch(0.55 0.01 240)',
  }
  const c = map[severity] ?? map.low
  return (
    <span
      className="px-1.5 py-0.5 text-[9px] font-mono uppercase tracking-widest rounded border"
      style={{ color: c, background: `color-mix(in oklch, ${c} 10%, transparent)`, borderColor: `color-mix(in oklch, ${c} 30%, transparent)` }}
    >
      {severity}
    </span>
  )
}

function CustomerRow({ c }: { c: Customer }) {
  const days = daysUntil(c.renewal_date)
  const isAtRisk = c.account_stage === 'at_risk'
  return (
    <div className="grid grid-cols-12 gap-3 py-3 border-b border-border/60 hover:bg-muted/50 transition-colors px-4 items-center">
      <div className="col-span-3">
        <p className="text-xs font-semibold text-foreground">{c.name}</p>
        <p className="text-[10px] font-mono text-muted-foreground mt-0.5">{formatARR(c.arr)}</p>
      </div>
      <div className="col-span-2">
        <HealthBar score={c.health_score} />
      </div>
      <div className="col-span-2 text-center">
        <p className="text-xs font-mono font-medium" style={{ color: days <= 35 ? CRIT : undefined }}>
          {days}d
        </p>
        <p className="text-[9px] text-muted-foreground">to renew</p>
      </div>
      <div className="col-span-2 text-center">
        <p className="text-xs font-mono text-foreground/80">{c.sentiment.toFixed(2)}</p>
        <p className="text-[9px] text-muted-foreground">sentiment</p>
      </div>
      <div className="col-span-2 text-center">
        <p className="text-xs font-mono text-foreground/80">{c.tickets}</p>
        <p className="text-[9px] text-muted-foreground">tickets</p>
      </div>
      <div className="col-span-1 flex justify-end">
        {isAtRisk && (
          <span
            className="px-1.5 py-0.5 text-[9px] font-mono uppercase tracking-wider rounded border"
            style={{ color: CRIT, background: `color-mix(in oklch, ${CRIT} 10%, transparent)`, borderColor: `color-mix(in oklch, ${CRIT} 30%, transparent)` }}
          >
            risk
          </span>
        )}
      </div>
    </div>
  )
}

function RiskRow({ r }: { r: Risk }) {
  const [expanded, setExpanded] = useState(false)
  return (
    <div className="border-b border-border/60 last:border-b-0">
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full grid grid-cols-12 gap-3 py-3 hover:bg-muted/50 transition-colors px-4 items-center text-left"
      >
        <div className="col-span-5">
          <p className="text-xs font-medium text-foreground line-clamp-1">{r.title}</p>
        </div>
        <div className="col-span-2 flex justify-center">
          <SeverityBadge severity={r.severity} />
        </div>
        <div className="col-span-2 text-center">
          <p className="text-xs font-mono text-foreground">{(r.confidence_score * 100).toFixed(0)}%</p>
          <p className="text-[9px] text-muted-foreground">confidence</p>
        </div>
        <div className="col-span-2 text-center">
          <p className="text-xs font-mono text-foreground">${(r.revenue_exposure / 1000).toFixed(0)}K</p>
          <p className="text-[9px] text-muted-foreground">exposure</p>
        </div>
        <div className="col-span-1 flex justify-end">
          <span className="text-muted-foreground text-[10px]">{expanded ? '↑' : '↓'}</span>
        </div>
      </button>
      {expanded && r.recommendations && (
        <div className="px-4 pb-4 space-y-2">
          <p className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground mb-2">Recommended Actions</p>
          {r.recommendations.map((rec, i) => (
            <div key={i} className="flex items-start gap-3 p-2.5 rounded-lg bg-muted/60 border border-border/60">
              <span className="text-[10px] font-mono text-muted-foreground w-20 flex-shrink-0 uppercase tracking-wider">{rec.department}</span>
              <p className="text-[11px] text-foreground/70 flex-1 leading-relaxed">{rec.action}</p>
              <span
                className="text-[9px] font-mono uppercase tracking-wider flex-shrink-0"
                style={{ color: rec.urgency_hint === 'immediate' ? CRIT : undefined }}
              >
                {rec.urgency_hint}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

function AnalyzePanel() {
  const [status, setStatus] = useState<'idle' | 'loading' | 'done' | 'error'>('idle')
  const [result, setResult] = useState<AnalyzeResponse | null>(null)
  const [elapsed, setElapsed] = useState(0)

  const run = async () => {
    setStatus('loading')
    setResult(null)
    const start = Date.now()
    const interval = setInterval(() => setElapsed(Math.round((Date.now() - start) / 100) / 10), 100)
    try {
      const data = await triggerAnalysis('platform_ui')
      setResult(data)
      setStatus('done')
    } catch {
      setStatus('error')
    } finally {
      clearInterval(interval)
    }
  }

  return (
    <div className="rounded-xl border border-border bg-card overflow-hidden">
      <div className="px-5 py-4 border-b border-border flex items-center justify-between bg-muted/40">
        <div>
          <p className="text-xs font-mono uppercase tracking-widest text-muted-foreground">Live Analysis</p>
          <p className="text-sm font-semibold text-foreground mt-0.5">POST /analyze</p>
        </div>
        <button
          onClick={run}
          disabled={status === 'loading'}
          className={cn(
            'px-4 py-2 text-xs font-semibold rounded-lg transition-all duration-200',
            status === 'loading'
              ? 'bg-muted text-muted-foreground cursor-not-allowed'
              : 'bg-primary text-primary-foreground hover:bg-primary/90'
          )}
        >
          {status === 'loading' ? (
            <span className="flex items-center gap-2">
              <span className="w-1.5 h-1.5 rounded-full bg-primary-foreground animate-pulse-dot" />
              {elapsed}s — analyzing…
            </span>
          ) : 'Trigger Analysis'}
        </button>
      </div>

      {status === 'idle' && (
        <div className="px-5 py-10 text-center">
          <p className="text-sm text-muted-foreground">
            Runs the live multi-agent cascade on AWS — real distributed work across all four domains.
          </p>
        </div>
      )}

      {status === 'loading' && (
        <div className="px-5 py-10 text-center space-y-3">
          <div className="flex justify-center gap-2">
            {['Revenue', 'Operations', 'Customer', 'Security'].map((a) => (
              <span
                key={a}
                className="px-2.5 py-1 text-[10px] font-mono rounded-md border border-border bg-muted/50 text-foreground/70"
              >
                {a}
              </span>
            ))}
          </div>
          <p className="text-sm text-muted-foreground">Four agents running in parallel…</p>
          <p className="text-xs text-muted-foreground/70">Coordinator aggregating → Orchestrator synthesizing → memory search</p>
        </div>
      )}

      {status === 'error' && (
        <div className="px-5 py-8">
          <p className="text-sm" style={{ color: CRIT }}>Analysis failed. The service may be warming up — try again in a moment.</p>
        </div>
      )}

      {status === 'done' && result && (
        <div className="p-5 space-y-4">
          <div className="flex items-start justify-between gap-4">
            <div className="flex-1">
              <p className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground mb-1">Risk Title</p>
              <h4 className="text-sm font-semibold text-foreground leading-snug">{result.risk_title}</h4>
            </div>
            <div className="text-right flex-shrink-0">
              <p className="text-3xl font-black tracking-tight" style={{ color: result.overall_risk_score >= 80 ? CRIT : WARN }}>
                {result.overall_risk_score}
              </p>
              <p className="text-[10px] text-muted-foreground">risk score</p>
            </div>
          </div>

          <div className="p-3 rounded-lg border border-border bg-muted/40">
            <p className="text-xs text-foreground/70 leading-relaxed">{result.confidence_narrative}</p>
          </div>

          {result.cross_domain_connections.length > 0 && (
            <div>
              <p className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground mb-2">Cross-Domain Connections</p>
              <ul className="space-y-1">
                {result.cross_domain_connections.map((c, i) => (
                  <li key={i} className="flex items-start gap-2">
                    <span className="text-primary text-[10px] mt-0.5">→</span>
                    <span className="text-xs text-foreground/70 leading-relaxed">{c}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          <div>
            <p className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground mb-2">Recommended Actions</p>
            <div className="space-y-2">
              {result.recommended_actions.map((a, i) => (
                <div key={i} className="flex items-start gap-3 p-2.5 rounded-lg bg-muted/60 border border-border/60">
                  <span className="text-[10px] font-mono text-muted-foreground w-20 flex-shrink-0 uppercase tracking-wider">{a.department}</span>
                  <p className="text-[11px] text-foreground/70 flex-1 leading-relaxed">{a.action}</p>
                  <span
                    className="text-[9px] font-mono uppercase tracking-wider flex-shrink-0"
                    style={{ color: a.urgency === 'immediate' ? CRIT : a.urgency === '24h' ? WARN : undefined }}
                  >
                    {a.urgency}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {result.historical_precedent && (
            <div className="p-3 rounded-lg border" style={{ borderColor: `color-mix(in oklch, ${OK} 25%, transparent)`, background: `color-mix(in oklch, ${OK} 6%, transparent)` }}>
              <p className="text-[10px] font-mono uppercase tracking-widest mb-1" style={{ color: OK }}>Historical Precedent</p>
              <p className="text-xs text-foreground/80 leading-relaxed">{result.historical_precedent}</p>
            </div>
          )}

          <div className="pt-3 border-t border-border flex items-center gap-6 text-[10px] font-mono text-muted-foreground flex-wrap">
            <span>Severity: <span className="text-foreground">{result.context.combined_severity}</span></span>
            <span>Evidence: <span className="text-foreground">{result.context.evidence_count}</span></span>
            <span>Past risks: <span className="text-foreground">{result.context.past_risks_found}</span></span>
            <span className="ml-auto" style={{ color: OK }}>Completed in {elapsed}s</span>
          </div>
        </div>
      )}
    </div>
  )
}

export function LivePlatform() {
  const [tab, setTab] = useState<'customers' | 'risks' | 'analyze'>('customers')
  const { data: customersData, error: customersError } = useSWR('customers', customerFetcher, { revalidateOnFocus: false })
  const { data: risksData, error: risksError } = useSWR('risks', riskFetcher, { revalidateOnFocus: false })

  return (
    <section id="live" className="bg-background border-t border-border scroll-mt-[60px]">
      <div className="max-w-[1280px] mx-auto px-8">
        <div className="flex items-center border-b border-border py-4">
          <span className="font-mono text-[11px] tracking-[0.25em] uppercase text-muted-foreground">
            {'>'} Live Platform
          </span>
        </div>

        <div className="py-16">
          <Reveal className="mb-8 max-w-xl">
            <h2 className="text-[clamp(28px,3.2vw,42px)] font-black tracking-[-0.03em] leading-[1.08] text-foreground text-balance">
              This is the actual system.{' '}
              <span className="text-primary">Live data. Real AWS.</span>
            </h2>
            <p className="mt-4 text-[16px] text-muted-foreground leading-relaxed">
              Every table below is fetched from the live API. Every analysis runs the real multi-agent cascade on AWS.
            </p>
          </Reveal>

          {/* Platform window */}
          <div className="rounded-2xl border border-border overflow-hidden shadow-sm bg-card">
            {/* Window bar */}
            <div className="flex items-center border-b border-border bg-muted/40">
              <div className="flex items-center gap-1.5 px-4 py-3 border-r border-border">
                <span className="w-2.5 h-2.5 rounded-full bg-border" />
                <span className="w-2.5 h-2.5 rounded-full bg-border" />
                <span className="w-2.5 h-2.5 rounded-full bg-border" />
              </div>
              <div className="flex items-center">
                {(['customers', 'risks', 'analyze'] as const).map((t) => (
                  <button
                    key={t}
                    onClick={() => setTab(t)}
                    className={cn(
                      'px-5 py-3 text-xs font-mono uppercase tracking-wider border-r border-border transition-colors',
                      tab === t
                        ? 'text-foreground bg-background'
                        : 'text-muted-foreground hover:text-foreground hover:bg-background/60'
                    )}
                  >
                    {t === 'customers' ? 'Customers' : t === 'risks' ? 'Risks' : 'Analyze'}
                  </button>
                ))}
              </div>
              <div className="ml-auto px-4 flex items-center gap-1.5 text-[10px] font-mono" style={{ color: OK }}>
                <span className="w-1.5 h-1.5 rounded-full animate-pulse-dot" style={{ background: OK }} />
                LIVE · TechVentures Inc
              </div>
            </div>

            {/* Customers tab */}
            {tab === 'customers' && (
              <div>
                <div className="grid grid-cols-12 gap-3 px-4 py-2.5 border-b border-border bg-muted/30">
                  {['Account', 'Health', 'Renewal', 'Sentiment', 'Tickets', ''].map((h, i) => (
                    <div key={i} className={cn('text-[9px] font-mono uppercase tracking-widest text-muted-foreground/70',
                      i === 0 ? 'col-span-3' : i === 1 ? 'col-span-2' : i === 2 ? 'col-span-2 text-center' : i === 3 ? 'col-span-2 text-center' : i === 4 ? 'col-span-2 text-center' : 'col-span-1'
                    )}>
                      {h}
                    </div>
                  ))}
                </div>
                {customersError && (
                  <div className="px-5 py-8 text-sm text-muted-foreground">
                    Failed to load customers. The API may be warming up — try refreshing.
                  </div>
                )}
                {!customersData && !customersError && (
                  <div className="px-5 py-8 text-sm text-muted-foreground animate-pulse">Loading customer data from AWS…</div>
                )}
                {customersData?.customers.map((c) => <CustomerRow key={c.id} c={c} />)}
                {customersData && (
                  <div className="px-4 py-2.5 border-t border-border bg-muted/30">
                    <p className="text-[10px] font-mono text-muted-foreground">{customersData.count} accounts · live from GET /customers</p>
                  </div>
                )}
              </div>
            )}

            {/* Risks tab */}
            {tab === 'risks' && (
              <div>
                <div className="grid grid-cols-12 gap-3 px-4 py-2.5 border-b border-border bg-muted/30">
                  {['Risk Title', 'Severity', 'Confidence', 'Exposure', ''].map((h, i) => (
                    <div key={i} className={cn('text-[9px] font-mono uppercase tracking-widest text-muted-foreground/70',
                      i === 0 ? 'col-span-5' : i === 1 ? 'col-span-2 text-center' : i === 2 ? 'col-span-2 text-center' : i === 3 ? 'col-span-2 text-center' : 'col-span-1'
                    )}>
                      {h}
                    </div>
                  ))}
                </div>
                {risksError && (
                  <div className="px-5 py-8 text-sm text-muted-foreground">Failed to load risks.</div>
                )}
                {!risksData && !risksError && (
                  <div className="px-5 py-8 text-sm text-muted-foreground animate-pulse">Loading risks from AWS…</div>
                )}
                {risksData?.risks.map((r) => <RiskRow key={r.id} r={r} />)}
                {risksData && (
                  <div className="px-4 py-2.5 border-t border-border bg-muted/30">
                    <p className="text-[10px] font-mono text-muted-foreground">{risksData.count} risks · live from GET /risks</p>
                  </div>
                )}
              </div>
            )}

            {/* Analyze tab */}
            {tab === 'analyze' && (
              <div className="p-5">
                <AnalyzePanel />
              </div>
            )}
          </div>
        </div>
      </div>
    </section>
  )
}
