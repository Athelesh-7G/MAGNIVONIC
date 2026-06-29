'use client'

import { SeverityBadge, OK } from './signal-ui'

export type RawSignal = { label: string; value: string }

// The real enterprise channel each domain's signal comes from — shown as
// source attribution on the evidence section (the reference app names channels, not
// "source: app_store").
const DOMAIN_CHANNEL: Record<string, string> = {
  Revenue: 'CRM',
  Operations: 'GitHub',
  Customer: 'Support desk',
  Security: 'Security monitoring',
}

interface DomainSignalCardProps {
  /** Display name, e.g. "Revenue" */
  domain: string
  /** Recommendation action for this domain (the "directive"). */
  directive?: string
  /** Recommendation rationale (urgency_hint from the API). */
  rationale?: string
  /** The parent brief's severity — domain findings inherit it. */
  severity: string
  /**
   * Front-Page-only enrichment: real raw signals from GET /customers,
   * shown as supporting evidence and explicitly labeled "raw signal"
   * to stay honestly distinct from the recommendation directive.
   */
  rawSignals?: RawSignal[]
  /** When this domain has no raw signal source exposed yet (e.g. Operations/GitHub). */
  rawUnavailableNote?: string
}

export function DomainSignalCard({
  domain,
  directive,
  rationale,
  severity,
  rawSignals,
  rawUnavailableNote,
}: DomainSignalCardProps) {
  return (
    <div className="rounded-lg border border-border bg-card/60 p-3.5 flex flex-col gap-2.5">
      <div className="flex items-center justify-between">
        <span className="text-sm font-semibold tracking-tight text-foreground">
          {domain}
        </span>
        {directive ? <SeverityBadge severity={severity} /> : null}
      </div>

      {/* Directive (from recommendations[] grouped by department) */}
      {directive ? (
        <div>
          <p className="text-xs uppercase tracking-widest text-primary/70 mb-1">
            Directive
          </p>
          <p className="text-sm text-foreground/85 leading-relaxed">{directive}</p>
          {rationale ? (
            <p className="text-xs text-muted-foreground leading-relaxed mt-1">{rationale}</p>
          ) : null}
        </div>
      ) : (
        <div className="flex items-center gap-2">
          <span
            className="inline-flex items-center justify-center w-4 h-4 rounded-full shrink-0"
            style={{ background: `color-mix(in oklch, ${OK} 15%, transparent)` }}
          >
            <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke={OK} strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
              <path d="M20 6 9 17l-5-5" />
            </svg>
          </span>
          <p className="text-xs leading-relaxed" style={{ color: OK }}>
            Clear — no action needed this event.
          </p>
        </div>
      )}

      {/* Evidence — the real signal this finding traces to, with its source
          channel. Given real weight (values in foreground), not a footnote. */}
      {rawSignals && rawSignals.length > 0 ? (
        <div className="pt-2.5 border-t border-border/60">
          <p className="text-xs uppercase tracking-widest text-muted-foreground mb-2">
            Evidence{DOMAIN_CHANNEL[domain] ? ` · ${DOMAIN_CHANNEL[domain]}` : ''}
          </p>
          <div className="grid grid-cols-2 gap-x-4 gap-y-1.5">
            {rawSignals.map((s) => (
              <div key={s.label} className="flex items-baseline justify-between gap-2">
                <span className="text-xs text-muted-foreground truncate">{s.label}</span>
                <span className="text-sm font-medium text-foreground tabular-nums shrink-0">{s.value}</span>
              </div>
            ))}
          </div>
        </div>
      ) : rawUnavailableNote ? (
        <div className="pt-2.5 border-t border-border/60">
          <p className="text-xs uppercase tracking-widest text-muted-foreground mb-1">
            Evidence{DOMAIN_CHANNEL[domain] ? ` · ${DOMAIN_CHANNEL[domain]}` : ''}
          </p>
          <p className="text-xs text-muted-foreground leading-relaxed">{rawUnavailableNote}</p>
        </div>
      ) : null}
    </div>
  )
}
