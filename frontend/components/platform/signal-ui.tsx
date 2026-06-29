'use client'

import { cn } from '@/lib/utils'
import type { Risk, InsightType } from '@/lib/api'

/**
 * Stat — the the reference app StatCard pairing: a prominent bold value over a small
 * muted label. tabular-nums keeps numeric values aligned. Used wherever a
 * big-number/small-label pairing appears (BriefCard metrics, etc.).
 */
export function Stat({
  value,
  label,
  size = 'md',
  accent,
  align = 'right',
}: {
  value: string
  label: string
  size?: 'md' | 'lg'
  accent?: string
  align?: 'left' | 'right'
}) {
  return (
    <div className={align === 'right' ? 'text-right' : 'text-left'}>
      <p
        className={cn(
          'font-bold tracking-tight tabular-nums leading-none',
          size === 'lg' ? 'text-3xl' : 'text-xl',
        )}
        style={accent ? { color: accent } : undefined}
      >
        {value}
      </p>
      <p className="text-xs text-muted-foreground mt-1.5">{label}</p>
    </div>
  )
}

// ── Semantic status colors (work in light + dark) ───────────────────────────
// Extracted from the original live-platform.tsx so every platform surface
// shares one source of truth rather than re-declaring these inline.
// Matched to the reference app's component semantic trio (Tailwind green/orange/red-500),
// converted to OKLCH. Reserved for severity/health — distinct from the violet accent.
export const OK = 'oklch(0.723 0.192 149.6)'
export const WARN = 'oklch(0.705 0.187 47.6)'
export const CRIT = 'oklch(0.637 0.208 25.3)'

export type Severity = Risk['severity']

export function severityColor(severity: string): string {
  const map: Record<string, string> = {
    critical: CRIT,
    high: WARN,
    medium: 'var(--primary)',
    low: 'oklch(0.55 0.01 240)',
  }
  return map[severity] ?? map.low
}

export function SeverityBadge({ severity }: { severity: string }) {
  const c = severityColor(severity)
  return (
    <span
      className="px-1.5 py-0.5 text-xs uppercase tracking-widest rounded border"
      style={{
        color: c,
        background: `color-mix(in oklch, ${c} 10%, transparent)`,
        borderColor: `color-mix(in oklch, ${c} 30%, transparent)`,
      }}
    >
      {severity}
    </span>
  )
}

// ── Insight type (valence) — distinct axis from severity (magnitude) ────────
// Risk = downside cascade, Opportunity = upside, CoordinationGap = internal
// delivery misalignment, Drift = a trajectory worth watching.
const INSIGHT_TYPE_LABEL: Record<InsightType, string> = {
  Risk: 'Risk',
  Opportunity: 'Opportunity',
  CoordinationGap: 'Coordination Gap',
  Drift: 'Drift',
}

export function insightTypeColor(type: InsightType): string {
  const map: Record<InsightType, string> = {
    Risk: CRIT,
    Opportunity: OK,
    CoordinationGap: WARN,
    Drift: 'var(--primary)',
  }
  return map[type] ?? CRIT
}

export function InsightTypeBadge({ type }: { type: InsightType }) {
  const c = insightTypeColor(type)
  return (
    <span
      className="px-1.5 py-0.5 text-xs uppercase tracking-widest rounded border font-semibold"
      style={{
        color: c,
        background: `color-mix(in oklch, ${c} 10%, transparent)`,
        borderColor: `color-mix(in oklch, ${c} 30%, transparent)`,
      }}
    >
      {INSIGHT_TYPE_LABEL[type]}
    </span>
  )
}

// ── Shared timestamp formatting ──────────────────────────────────────────────
// Deterministic ISO slice (no locale/timezone conversion) to avoid SSR/CSR
// hydration mismatches. Monospace timestamps are a platform design convention.
export function formatTimestamp(iso: string | null | undefined): string {
  if (!iso) return '—'
  // "2026-06-20T10:58:38.123+00:00" -> "2026-06-20 10:58 UTC"
  const m = iso.replace('T', ' ')
  return `${m.slice(0, 16)} UTC`
}
