'use client'

import { useMemo, useState } from 'react'
import useSWR from 'swr'
import { fetchRisks, fetchCustomers, type InsightType } from '@/lib/api'
import { groupBriefs, type BriefGroup } from '@/lib/brief-grouping'
import { BriefCard } from '@/components/platform/brief-card'
import { PageHeader } from '@/components/platform/page-header'
import { InsightTypeBadge } from '@/components/platform/signal-ui'
import { AtRest } from '@/components/platform/at-rest'
import { useActivation } from '@/lib/activation'

const ALL = '__all__'
const INSIGHT_TYPES: InsightType[] = ['Risk', 'Opportunity', 'CoordinationGap', 'Drift']

export default function BriefsPage() {
  const { data, error, isLoading, mutate } = useSWR('risks', fetchRisks)
  const { data: customersData } = useSWR('customers', fetchCustomers)
  const [account, setAccount] = useState<string>(ALL)
  const [insightType, setInsightType] = useState<string>(ALL)

  const accountNames = customersData?.customers.map((c) => c.name) ?? []
  const briefs = data?.risks ?? []

  const groups = useMemo(() => groupBriefs(briefs, accountNames), [briefs, accountNames])
  const filtered = useMemo(
    () =>
      groups.filter(
        (g) =>
          (account === ALL || g.account === account) &&
          (insightType === ALL || g.insightType === insightType),
      ),
    [groups, account, insightType],
  )

  const eventCount = filtered.length
  const analysisCount = filtered.reduce((n, g) => n + g.runs.length, 0)
  const { activated } = useActivation()

  if (!activated) {
    return <AtRest eyebrow="The Record" title="Executive Briefs" surface="The brief archive" />
  }

  return (
    <div className="max-w-[1100px] mx-auto px-8 py-8">
      <PageHeader
        eyebrow="The Record"
        title="Executive Briefs"
        subtitle="The organization's running record of every decision the engine has produced — time-stamped, grouped by event, and traceable to the evidence behind it."
      />

      {/* Filter */}
      <div className="mt-6 flex items-center gap-3 flex-wrap">
        <label htmlFor="acct" className="text-xs uppercase tracking-widest text-muted-foreground">
          Filter by account
        </label>
        <select
          id="acct"
          value={account}
          onChange={(e) => setAccount(e.target.value)}
          className="h-8 px-3 rounded-lg border border-border bg-card text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
        >
          <option value={ALL}>All accounts</option>
          {accountNames.map((n) => (
            <option key={n} value={n}>
              {n}
            </option>
          ))}
        </select>

        <label htmlFor="itype" className="text-xs uppercase tracking-widest text-muted-foreground">
          Type
        </label>
        <select
          id="itype"
          value={insightType}
          onChange={(e) => setInsightType(e.target.value)}
          className="h-8 px-3 rounded-lg border border-border bg-card text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
        >
          <option value={ALL}>All types</option>
          {INSIGHT_TYPES.map((t) => (
            <option key={t} value={t}>
              {t === 'CoordinationGap' ? 'Coordination Gap' : t}
            </option>
          ))}
        </select>
        {insightType !== ALL ? <InsightTypeBadge type={insightType as InsightType} /> : null}
        {data ? (
          <span className="ml-auto text-xs text-muted-foreground">
            {eventCount} event{eventCount === 1 ? '' : 's'} · {analysisCount} analyses
          </span>
        ) : null}
      </div>

      {/* Feed */}
      <div className="mt-5 space-y-3">
        {isLoading ? (
          <div className="rounded-2xl border border-border bg-card/40 px-6 py-16 text-center">
            <p className="text-sm text-muted-foreground animate-pulse">Loading briefs from AWS…</p>
          </div>
        ) : error ? (
          <div className="rounded-2xl border border-border bg-card/40 px-6 py-12 text-center">
            <p className="text-sm mb-4" style={{ color: 'oklch(0.58 0.22 25)' }}>
              Could not load briefs. The service may be warming up.
            </p>
            <button
              type="button"
              onClick={() => mutate()}
              className="h-9 px-4 inline-flex items-center rounded-lg text-sm font-medium bg-muted text-foreground hover:bg-muted/70 transition-colors"
            >
              Retry
            </button>
          </div>
        ) : filtered.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-border bg-card/40 px-6 py-14 text-center">
            <p className="text-sm text-muted-foreground">
              No {insightType !== ALL ? `${insightType === 'CoordinationGap' ? 'Coordination Gap' : insightType} ` : ''}
              briefs{account !== ALL ? ` for ${account}` : ''} yet.
            </p>
          </div>
        ) : (
          bucketize(filtered).map((bucket) => (
            <div key={bucket.label}>
              <div className="flex items-center gap-3 mb-3 mt-2 first:mt-0">
                <span className="text-xs uppercase tracking-widest font-medium text-muted-foreground">{bucket.label}</span>
                <span className="h-px flex-1 bg-border" />
                <span className="text-xs text-muted-foreground/60">
                  {bucket.groups.length} event{bucket.groups.length === 1 ? '' : 's'}
                </span>
              </div>
              <div className="space-y-3">
                {bucket.groups.map((g, i) => {
                  const canonical = g.runs[0]
                  return (
                    <BriefCard
                      key={canonical.id}
                      risk={canonical}
                      variant="feed"
                      index={i}
                      runHistory={{
                        runCount: g.runs.length,
                        firstRun: g.runs[g.runs.length - 1].created_at,
                        lastRun: g.runs[0].created_at,
                        runs: g.runs.map((r) => ({
                          id: r.id,
                          created_at: r.created_at,
                          confidence: r.confidence_score,
                        })),
                      }}
                    />
                  )
                })}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  )
}

/** Bucket events into a chronological ledger — Today / This week / Earlier —
 *  so Briefs reads as a time-stamped record (distinct from the Canvas's single
 *  live moment). Buckets keep the newest-first order within each. */
function bucketize(groups: BriefGroup[]): { label: string; groups: BriefGroup[] }[] {
  const now = Date.now()
  const DAY = 86_400_000
  const buckets: Record<string, BriefGroup[]> = { Today: [], 'This week': [], Earlier: [] }
  for (const g of groups) {
    const ts = g.runs[0]?.created_at ? new Date(g.runs[0].created_at).getTime() : 0
    const age = now - ts
    if (age < DAY) buckets['Today'].push(g)
    else if (age < 7 * DAY) buckets['This week'].push(g)
    else buckets['Earlier'].push(g)
  }
  return (['Today', 'This week', 'Earlier'] as const)
    .map((label) => ({ label, groups: buckets[label] }))
    .filter((b) => b.groups.length > 0)
}
