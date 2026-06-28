'use client'

import useSWR from 'swr'
import { motion } from 'framer-motion'
import { formatCurrency, fetchGithub, type Customer, type GithubResponse } from '@/lib/api'

export type Lane = { domain: string; signals: { label: string; value: string }[] }

/** Real raw signals from GET /customers, grouped into domain lanes. Shared by
 *  The Wire and Dossiers so the raw-signal display lives in exactly one place. */
export function lanesFor(c: Customer): Lane[] {
  const deviation = c.api_baseline > 0 ? `${(c.api_calls / c.api_baseline).toFixed(1)}×` : '—'
  return [
    {
      domain: 'Customer Success',
      signals: [
        { label: 'Health score', value: `${c.health_score} / 100` },
        { label: 'Tickets (7-day)', value: `${c.tickets}` },
        { label: 'Avg sentiment', value: c.sentiment.toFixed(2) },
        { label: 'Feature adoption', value: `${c.adoption} / 100` },
      ],
    },
    {
      domain: 'Security',
      signals: [
        { label: 'Anomaly score', value: c.anomaly_score.toFixed(2) },
        { label: 'API calls / hr', value: `${c.api_calls}` },
        { label: 'Baseline calls / hr', value: `${c.api_baseline}` },
        { label: 'Deviation vs baseline', value: deviation },
      ],
    },
    {
      domain: 'Revenue / Account',
      signals: [
        { label: 'ARR', value: formatCurrency(c.arr) },
        { label: 'Renewal date', value: (c.renewal_date ?? '—').slice(0, 10) },
        { label: 'CS tier', value: c.cs_tier },
        { label: 'Account stage', value: c.account_stage },
      ],
    },
  ]
}

function LaneCard({ lane, index }: { lane: Lane; index: number }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, delay: Math.min(index * 0.05, 0.4), ease: 'easeOut' }}
      whileHover={{ y: -4 }}
      className="rounded-xl border border-border bg-gradient-to-br from-card to-secondary/20 p-4"
    >
      <p className="text-xs tracking-[0.18em] uppercase text-muted-foreground mb-3">{lane.domain}</p>
      <div className="space-y-2">
        {lane.signals.map((s) => (
          <div
            key={s.label}
            className="flex items-baseline justify-between gap-3 border-b border-border/50 pb-1.5 last:border-b-0 last:pb-0"
          >
            <span className="text-xs text-muted-foreground">{s.label}</span>
            <span className="text-sm text-foreground">{s.value}</span>
          </div>
        ))}
      </div>
    </motion.div>
  )
}

export function SignalLanes({ customer }: { customer: Customer }) {
  return (
    <div className="grid md:grid-cols-2 gap-4">
      {lanesFor(customer).map((lane, i) => (
        <LaneCard key={lane.domain} lane={lane} index={i} />
      ))}
    </div>
  )
}

// Map each team to the one customer-signal lane that belongs to it. Operations
// has no per-account customer lane — its real signal is the GitHub delivery feed
// (now exposed by GET /github), rendered directly below.
const TEAM_LANE_NAME: Record<string, string | null> = {
  revenue: 'Revenue / Account',
  security: 'Security',
  customer: 'Customer Success',
  operations: null,
}

/**
 * The domain-centric, compact raw readout for a team page: ONE domain's lane
 * shown across every watched account (the horizontal slice that distinguishes a
 * team page from The Wire's one-account/all-domains view). Deliberately compact —
 * on a team page the scoped chat and directed insights are the main content;
 * this is secondary context.
 */
export function TeamSignalStrip({
  customers,
  department,
}: {
  customers: Customer[]
  department: string
}) {
  const laneName = TEAM_LANE_NAME[department]

  // Operations' real signal is the live GitHub delivery feed, not per-account
  // customer telemetry — show it directly.
  if (laneName === null) {
    return <OperationsGithubStrip />
  }

  return (
    <div className="rounded-xl border border-border bg-card/50 overflow-hidden divide-y divide-border/60">
      {customers.map((c, i) => {
        const lane = lanesFor(c).find((l) => l.domain === laneName)
        if (!lane) return null
        return (
          <motion.div
            key={c.id}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.25, delay: Math.min(i * 0.04, 0.3), ease: 'easeOut' }}
            className="px-4 py-2.5 flex items-center gap-4 flex-wrap"
          >
            <span className="text-xs font-semibold text-foreground w-36 shrink-0 truncate">{c.name}</span>
            <div className="flex items-center gap-x-5 gap-y-1 flex-wrap">
              {lane.signals.map((s) => (
                <span key={s.label} className="inline-flex items-baseline gap-1.5">
                  <span className="text-xs uppercase tracking-wider text-muted-foreground">{s.label}</span>
                  <span className="text-xs text-foreground tabular-nums">{s.value}</span>
                </span>
              ))}
            </div>
          </motion.div>
        )
      })}
    </div>
  )
}

/** The Operations team's real raw signal — the live GitHub delivery feed from
 *  GET /github (PRs, blockers, CI, commit velocity). Real, not placeholder. */
function OperationsGithubStrip() {
  const { data } = useSWR<GithubResponse>('github', fetchGithub)
  const s = data?.signals
  if (!data) {
    return (
      <div className="rounded-xl border border-border bg-card/50 px-4 py-3">
        <p className="text-sm text-muted-foreground animate-pulse">Loading live delivery feed…</p>
      </div>
    )
  }
  if (!s) {
    return (
      <div className="rounded-xl border border-dashed border-border bg-card/40 px-4 py-3">
        <p className="text-sm text-muted-foreground">GitHub is not connected right now.</p>
      </div>
    )
  }
  const cells = [
    { label: 'Open PRs', value: `${s.open_prs.count}` },
    { label: 'Blocker issues', value: `${s.blocker_issues.count}` },
    { label: 'CI failures', value: `${s.recent_failures.count}` },
    { label: 'Commits (7d)', value: `${s.commit_velocity.commits_7d} · ${s.commit_velocity.trend}` },
  ]
  return (
    <div className="rounded-xl border border-border bg-card/50 px-4 py-3">
      <div className="flex items-center gap-x-8 gap-y-1.5 flex-wrap">
        {cells.map((c) => (
          <span key={c.label} className="inline-flex items-baseline gap-1.5">
            <span className="text-xs uppercase tracking-wider text-muted-foreground">{c.label}</span>
            <span className="text-sm text-foreground tabular-nums">{c.value}</span>
          </span>
        ))}
        <a
          href={data.repo_url}
          target="_blank"
          rel="noopener noreferrer"
          className="ml-auto text-xs text-primary hover:underline"
        >
          {data.repo} →
        </a>
      </div>
    </div>
  )
}
