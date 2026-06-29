'use client'

import { useState } from 'react'
import Link from 'next/link'
import { motion } from 'framer-motion'
import { ChevronDown } from 'lucide-react'
import type { Risk, Insight, InsightType } from '@/lib/api'
import { formatCurrency } from '@/lib/api'
import { SeverityBadge, InsightTypeBadge, insightTypeColor, formatTimestamp, OK, Stat } from './signal-ui'
import { DomainSignalCard, type RawSignal } from './domain-signal-card'
import { ScoreProvenance } from './score-provenance'

// The four domains, in canonical order, mapped to the department keys used in
// recommendations[]/recommended_actions[] (Option A: domain cards are
// directive-driven, since neither /risks nor /analyze returns per-domain findings).
const DOMAINS: { key: string; label: string }[] = [
  { key: 'revenue', label: 'Revenue' },
  { key: 'operations', label: 'Operations' },
  { key: 'customer', label: 'Customer' },
  { key: 'security', label: 'Security' },
]

export type RawByDomain = Partial<Record<string, RawSignal[]>>

function scoreLabel(type: InsightType): string {
  if (type === 'Risk') return 'Risk score'
  if (type === 'Opportunity') return 'Opportunity score'
  return 'Score'
}

/**
 * When several real /risks rows are the same event re-analyzed (same account,
 * severity, exposure), Executive Briefs collapses them into one card and passes
 * the full real run history here — the DB rows are never deleted, just grouped
 * for display. `runs` is newest-first; runs[0] is the canonical displayed brief.
 */
export interface RunHistory {
  runCount: number
  firstRun: string | null
  lastRun: string | null
  runs: { id: string; created_at: string | null; confidence: number }[]
}

type Directive = { action: string; rationale: string }

interface Metric {
  label: string
  value: string
  accent?: string
}

interface BriefCardProps {
  /** Static brief from GET /risks (Day 8 shape). */
  risk?: Risk
  /** One live insight from POST /analyze — genuinely richer (0-100 score, connections, precedent). */
  live?: Insight
  /** 'hero' = always expanded; 'feed' = collapsible row. Live is always hero. */
  variant?: 'hero' | 'feed'
  /** Front-Page-only: real raw signals from /customers, keyed by domain. */
  rawByDomain?: RawByDomain
  rawUnavailableByDomain?: Partial<Record<string, string>>
  /** When the live precedent matches a known memory entry, link to it. */
  precedentHref?: string
  /** Grouped re-analyses of the same event (Executive Briefs feed only). */
  runHistory?: RunHistory
  /** Stagger index for entrance animation (feed lists). */
  index?: number
}

export function BriefCard({
  risk,
  live,
  variant = 'feed',
  rawByDomain,
  rawUnavailableByDomain,
  precedentHref,
  runHistory,
  index = 0,
}: BriefCardProps) {
  const isLive = !!live
  const effectiveVariant: 'hero' | 'feed' = variant
  const [open, setOpen] = useState(effectiveVariant === 'hero')
  const [historyOpen, setHistoryOpen] = useState(false)
  const grouped = !!runHistory && runHistory.runCount > 1
  const expanded = effectiveVariant === 'hero' ? true : open

  // ── Normalize either source into one model ──────────────────────────────
  const severity = isLive ? live!.severity : risk!.severity
  const insightType: InsightType = isLive ? live!.insight_type : risk!.insight_type
  const headline = isLive ? live!.risk_title : risk!.title
  const rootCause = isLive ? live!.root_cause : risk!.root_cause
  const createdAt = isLive ? null : risk!.created_at
  // Accent is driven by insight TYPE (valence), not severity (magnitude) —
  // Risk/Opportunity/CoordinationGap/Drift read as visually distinct kinds
  // of finding; severity is still shown via the badge text.
  const accent = insightTypeColor(insightType)
  const isOpportunity = insightType === 'Opportunity'

  const byDept = new Map<string, Directive>()
  if (isLive) {
    for (const a of live!.recommended_actions) {
      if (!byDept.has(a.department)) byDept.set(a.department, { action: a.action, rationale: a.rationale })
    }
  } else {
    for (const r of risk!.recommendations ?? []) {
      if (!byDept.has(r.department)) byDept.set(r.department, { action: r.action, rationale: r.urgency_hint })
    }
  }
  const executive = byDept.get('executive')

  const metrics: Metric[] = isLive
    ? [
        { label: `${scoreLabel(insightType)} / 100`, value: `${live!.overall_score}`, accent },
        { label: 'Confidence', value: `${Math.round(live!.confidence * 100)}%` },
      ]
    : [
        { label: 'Confidence', value: `${Math.round(risk!.confidence_score * 100)}%` },
        {
          label: isOpportunity ? 'Expansion value' : 'Revenue exposure',
          value: formatCurrency(risk!.revenue_exposure),
          accent,
        },
      ]

  return (
    <motion.article
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, delay: Math.min(index * 0.05, 0.4), ease: 'easeOut' }}
      whileHover={effectiveVariant === 'feed' && !expanded ? { y: -4 } : undefined}
      className="group/card rounded-xl border bg-gradient-to-br from-card to-secondary/20 overflow-hidden"
      style={{ borderColor: `color-mix(in oklch, ${accent} 30%, var(--border))` }}
    >
      <div className="relative">
        <div className="absolute left-0 top-0 bottom-0 w-1" style={{ background: accent }} />
        <button
          type="button"
          onClick={() => effectiveVariant === 'feed' && setOpen((v) => !v)}
          className={
            'w-full text-left pl-5 pr-5 py-4 flex items-start gap-4 ' +
            (effectiveVariant === 'feed' ? 'hover:bg-muted/40 transition-colors cursor-pointer' : 'cursor-default')
          }
          aria-expanded={effectiveVariant === 'feed' ? expanded : undefined}
        >
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2.5 mb-2 flex-wrap">
              <InsightTypeBadge type={insightType} />
              <SeverityBadge severity={severity} />
              {isLive ? (
                <span
                  className="text-xs uppercase tracking-widest px-1.5 py-0.5 rounded border"
                  style={{ color: OK, borderColor: `color-mix(in oklch, ${OK} 35%, transparent)`, background: `color-mix(in oklch, ${OK} 8%, transparent)` }}
                >
                  Live result
                </span>
              ) : (
                <span className="text-xs text-muted-foreground">{formatTimestamp(createdAt)}</span>
              )}
              {grouped ? (
                <span
                  className="text-xs uppercase tracking-widest px-1.5 py-0.5 rounded border border-border text-muted-foreground"
                  title="Same event, re-analyzed — all runs preserved below"
                >
                  analyzed {runHistory!.runCount}×
                  {runHistory!.firstRun && runHistory!.lastRun
                    ? ` · ${runHistory!.firstRun.slice(0, 10)}${
                        runHistory!.firstRun.slice(0, 10) !== runHistory!.lastRun.slice(0, 10)
                          ? ` → ${runHistory!.lastRun.slice(0, 10)}`
                          : ''
                      }`
                    : ''}
                </span>
              ) : null}
            </div>
            <h3 className="text-base font-bold tracking-tight text-foreground leading-snug">{headline}</h3>
            {isLive ? (
              <p className="text-xs uppercase tracking-widest text-muted-foreground mt-1">
                {live!.account ?? 'Org-internal · no single account'}
              </p>
            ) : null}
            {effectiveVariant === 'feed' && !expanded ? (
              <p className="text-xs text-muted-foreground mt-1 line-clamp-1">{rootCause}</p>
            ) : null}
          </div>

          <div className="flex items-start gap-6 shrink-0">
            {metrics.map((m, i) => (
              <Stat
                key={m.label}
                label={m.label}
                value={m.value}
                accent={m.accent}
                size={effectiveVariant === 'hero' && i === 0 ? 'lg' : 'md'}
              />
            ))}
            {effectiveVariant === 'feed' ? (
              <span className="flex items-center gap-1 mt-1.5 text-xs text-muted-foreground group-hover/card:text-foreground transition-colors shrink-0">
                <span className="hidden sm:inline whitespace-nowrap">{expanded ? 'Hide' : 'View full analysis'}</span>
                <ChevronDown
                  size={15}
                  strokeWidth={2.2}
                  className={'transition-transform ' + (expanded ? 'rotate-180' : '')}
                />
              </span>
            ) : null}
          </div>
        </button>
      </div>

      {expanded ? (
        <div className="px-5 pb-5 pt-1 space-y-4">
          {/* Cross-domain story */}
          <div className="rounded-lg border border-border bg-muted/30 px-4 py-3">
            <p className="text-xs uppercase tracking-widest text-muted-foreground mb-1">
              Cross-domain synthesis
            </p>
            <p className="text-sm text-foreground/85 leading-relaxed">{rootCause}</p>
            {/* "How this was scored" — shown for BOTH live insights and historical
                risk cards, so every insights card (Canvas, Briefs, Dossiers, and
                every team page's "Insights directed at" section — Security
                included) carries the provenance control consistently. */}
            <div className="flex items-start gap-1.5 mt-2">
              <p className="text-xs text-muted-foreground leading-relaxed flex-1">
                <span className="font-semibold text-foreground/90">Why this confidence &amp; score: </span>
                {isLive
                  ? live!.confidence_narrative ||
                    'The General Manager weighed how many independent domains corroborate this finding.'
                  : 'Computed from how many domains corroborate this finding, weighted by their severity.'}
              </p>
              <ScoreProvenance kind="gm" />
            </div>
          </div>

          {/* Live-only: explicit cross-domain connections */}
          {isLive && live!.cross_domain_connections.length > 0 ? (
            <div>
              <p className="text-xs uppercase tracking-widest text-muted-foreground mb-2">
                Cross-domain connections
              </p>
              <ul className="space-y-1.5">
                {live!.cross_domain_connections.map((c, i) => (
                  <li key={i} className="flex items-start gap-2">
                    <span className="text-primary text-xs mt-0.5">→</span>
                    <span className="text-xs text-foreground/90 leading-relaxed">{c}</span>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}

          {/* Domain breakdown */}
          <div>
            <p className="text-xs uppercase tracking-widest text-muted-foreground mb-2">
              Domain breakdown
            </p>
            <div className="grid sm:grid-cols-2 gap-3">
              {DOMAINS.map((d) => {
                const rec = byDept.get(d.key)
                return (
                  <DomainSignalCard
                    key={d.key}
                    domain={d.label}
                    directive={rec?.action}
                    rationale={rec?.rationale}
                    severity={severity}
                    rawSignals={rawByDomain?.[d.key]}
                    rawUnavailableNote={rawUnavailableByDomain?.[d.key]}
                  />
                )
              })}
            </div>
          </div>

          {/* Executive directive */}
          {executive ? (
            <div
              className="rounded-lg border px-4 py-3"
              style={{
                borderColor: 'color-mix(in oklch, var(--primary) 30%, transparent)',
                background: 'color-mix(in oklch, var(--primary) 6%, transparent)',
              }}
            >
              <p className="text-xs uppercase tracking-widest text-primary mb-1">Executive directive</p>
              <p className="text-sm text-foreground/85 leading-relaxed">{executive.action}</p>
              {executive.rationale ? (
                <p className="text-xs text-muted-foreground leading-relaxed mt-1">{executive.rationale}</p>
              ) : null}
            </div>
          ) : null}

          {/* Live-only: historical precedent (real string from /analyze) */}
          {isLive && live!.historical_precedent ? (
            <div
              className="rounded-lg border px-4 py-3"
              style={{
                borderColor: `color-mix(in oklch, ${OK} 25%, transparent)`,
                background: `color-mix(in oklch, ${OK} 6%, transparent)`,
              }}
            >
              <div className="flex items-center justify-between mb-1">
                <p className="text-xs uppercase tracking-widest" style={{ color: OK }}>
                  What happened last time
                </p>
                {precedentHref ? (
                  <Link
                    href={precedentHref}
                    className="text-xs text-primary hover:underline"
                  >
                    View in Organizational Memory →
                  </Link>
                ) : null}
              </div>
              <p className="text-xs text-foreground/90 leading-relaxed">{live!.historical_precedent}</p>
            </div>
          ) : null}

          {/* Run history — every real re-analysis of this event, never hidden */}
          {grouped ? (
            <div>
              <button
                type="button"
                onClick={() => setHistoryOpen((v) => !v)}
                className="flex items-center gap-2 text-xs uppercase tracking-widest text-muted-foreground hover:text-foreground transition-colors"
              >
                Run history · {runHistory!.runCount} analyses of this event
                <span>{historyOpen ? '↑' : '↓'}</span>
              </button>
              {historyOpen ? (
                <div className="mt-2 rounded-lg border border-border bg-muted/30 divide-y divide-border/60">
                  {runHistory!.runs.map((run, i) => (
                    <div key={run.id} className="flex items-center justify-between gap-3 px-3 py-2">
                      <span className="text-xs text-foreground/90">
                        {formatTimestamp(run.created_at)}
                        {i === 0 ? (
                          <span className="ml-2 text-xs uppercase tracking-widest" style={{ color: OK }}>
                            latest · shown above
                          </span>
                        ) : null}
                      </span>
                      <span className="text-xs text-muted-foreground">
                        {Math.round(run.confidence * 100)}% confidence
                      </span>
                    </div>
                  ))}
                </div>
              ) : null}
            </div>
          ) : null}
        </div>
      ) : null}
    </motion.article>
  )
}
