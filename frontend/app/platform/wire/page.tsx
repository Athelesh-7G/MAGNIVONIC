'use client'

import useSWR from 'swr'
import { motion } from 'framer-motion'
import { GitPullRequest, CircleAlert, GitCommitHorizontal, ArrowUpRight } from 'lucide-react'
import { fetchCustomers, fetchGithub, type GithubResponse } from '@/lib/api'
import { PageHeader } from '@/components/platform/page-header'
import { SignalLanes } from '@/components/platform/signal-lanes'
import { formatTimestamp, OK, WARN, CRIT } from '@/components/platform/signal-ui'
import { AtRest } from '@/components/platform/at-rest'
import { useActivation } from '@/lib/activation'

export default function WirePage() {
  const { data, error, isLoading, mutate } = useSWR('customers', fetchCustomers)
  // Dynamic lead account (highest-ARR at-risk), not a hardcoded name.
  const customers = data?.customers ?? []
  const atRisk = customers.filter((c) => c.account_stage === 'at_risk')
  const pool = atRisk.length > 0 ? atRisk : customers
  const acme = pool.length > 0 ? pool.reduce((b, c) => (c.arr > b.arr ? c : b), pool[0]) : null
  const { activated } = useActivation()

  if (!activated) {
    return <AtRest eyebrow="The Record" title="The Wire" surface="The live signal feed" />
  }

  return (
    <div className="max-w-[1100px] mx-auto px-8 py-8">
      <PageHeader
        eyebrow="The Record"
        title="The Wire"
        subtitle="The live signal feed from every tool Magnivonic connects to — account telemetry from the CRM and the delivery stream from GitHub, straight from the source. This is the ground truth the agents reason over."
      />

      {/* Raw delivery feed — the real GitHub signal, unique to this page */}
      <GithubRawFeed />

      {/* Raw account telemetry */}
      <div className="mt-8">
        <p className="text-xs tracking-[0.2em] uppercase text-muted-foreground mb-3">{'>'} Account telemetry</p>
        {isLoading ? (
          <div className="rounded-2xl border border-border bg-card/40 px-6 py-16 text-center">
            <p className="text-sm text-muted-foreground animate-pulse">Loading raw signals from AWS…</p>
          </div>
        ) : error ? (
          <div className="rounded-2xl border border-border bg-card/40 px-6 py-12 text-center">
            <p className="text-sm mb-4" style={{ color: CRIT }}>
              Could not load raw signals. The service may be warming up.
            </p>
            <button
              type="button"
              onClick={() => mutate()}
              className="h-9 px-4 inline-flex items-center rounded-lg text-sm font-medium bg-muted text-foreground hover:bg-muted/70 transition-colors"
            >
              Retry
            </button>
          </div>
        ) : !acme ? (
          <div className="rounded-2xl border border-dashed border-border bg-card/40 px-6 py-14 text-center">
            <p className="text-sm text-muted-foreground">No live signal data for the active account yet.</p>
          </div>
        ) : (
          <>
            <div className="flex items-center gap-2.5 mb-4">
              <span className="text-xs uppercase tracking-widest text-muted-foreground">Account</span>
              <span className="text-sm font-semibold text-foreground">{acme.name}</span>
              <span className="text-xs uppercase tracking-widest border border-border rounded px-1.5 py-0.5 text-muted-foreground">
                Live feed
              </span>
            </div>
            <SignalLanes customer={acme} />
            <p className="mt-4 text-xs text-muted-foreground/60">Live from the connected CRM · customer health, renewal, and security telemetry</p>
          </>
        )}
      </div>
    </div>
  )
}

function GithubRawFeed() {
  const { data } = useSWR<GithubResponse>('github', fetchGithub)
  const s = data?.signals

  return (
    <div className="mt-6">
      <div className="flex items-center justify-between mb-3">
        <p className="text-xs tracking-[0.2em] uppercase text-muted-foreground">{'>'} Delivery feed · GitHub</p>
        {data ? (
          <a
            href={data.repo_url}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 text-xs text-primary hover:underline"
          >
            {data.repo}
            <ArrowUpRight className="w-3 h-3" />
          </a>
        ) : null}
      </div>

      {!data ? (
        <div className="rounded-2xl border border-border bg-card/40 px-6 py-10 text-center">
          <p className="text-sm text-muted-foreground animate-pulse">Loading live delivery feed…</p>
        </div>
      ) : !s ? (
        <div className="rounded-2xl border border-dashed border-border bg-card/40 px-6 py-10 text-center">
          <p className="text-sm text-muted-foreground">GitHub is not connected right now — no delivery signal to show.</p>
        </div>
      ) : (
        <div className="rounded-2xl border border-border bg-card/60 p-5">
          <div className="grid sm:grid-cols-2 gap-x-8 gap-y-4">
            <RawGroup
              icon={<CircleAlert className="w-4 h-4" style={{ color: CRIT }} />}
              label={`Blocker issues · ${s.blocker_issues.count}`}
              items={s.blocker_issues.issues}
              empty="No open blockers"
            />
            <RawGroup
              icon={<GitPullRequest className="w-4 h-4" style={{ color: WARN }} />}
              label={`Open pull requests · ${s.open_prs.count}`}
              items={s.open_prs.titles}
              empty="No open PRs"
            />
            <RawGroup
              icon={<GitCommitHorizontal className="w-4 h-4 text-muted-foreground" />}
              label={`Recent CI failures · ${s.recent_failures.count}`}
              items={s.recent_failures.runs}
              empty="No recent failures"
            />
            <div>
              <p className="text-xs uppercase tracking-widest text-muted-foreground mb-2">Commit velocity</p>
              <p className="text-sm text-foreground/85">
                {s.commit_velocity.commits_7d} commits in 7 days ·{' '}
                <span style={{ color: s.commit_velocity.trend === 'decreasing' ? WARN : OK }}>
                  {s.commit_velocity.trend}
                </span>
              </p>
              <p className="text-xs text-muted-foreground mt-0.5">{s.commit_velocity.commits_14d} in the last 14 days</p>
            </div>
          </div>
          <p className="mt-4 text-xs text-muted-foreground/60">Live from the connected GitHub workspace · checked {formatTimestamp(data.checked_at)}</p>
        </div>
      )}
    </div>
  )
}

function RawGroup({
  icon,
  label,
  items,
  empty,
}: {
  icon: React.ReactNode
  label: string
  items: string[]
  empty: string
}) {
  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.25 }}>
      <p className="text-xs uppercase tracking-widest text-muted-foreground mb-2">{label}</p>
      {items.length === 0 ? (
        <p className="text-sm text-muted-foreground/70">{empty}</p>
      ) : (
        <ul className="space-y-1.5">
          {items.map((t, i) => (
            <li key={i} className="flex items-start gap-2">
              <span className="mt-0.5 shrink-0">{icon}</span>
              <span className="text-sm text-foreground/85 leading-snug">{t}</span>
            </li>
          ))}
        </ul>
      )}
    </motion.div>
  )
}
