'use client'

import { useMemo } from 'react'
import { useParams, notFound } from 'next/navigation'
import Link from 'next/link'
import useSWR from 'swr'
import { fetchRisks, fetchCustomers, type TeamDepartment } from '@/lib/api'
import { groupBriefs, isDirectedAt } from '@/lib/brief-grouping'
import { PageHeader } from '@/components/platform/page-header'
import { DebriefChat } from '@/components/platform/debrief-chat'
import { BriefCard } from '@/components/platform/brief-card'
import { TeamSignalStrip } from '@/components/platform/signal-lanes'
import { AtRest } from '@/components/platform/at-rest'
import { useActivation } from '@/lib/activation'

type TeamConfig = {
  slug: string
  department: TeamDepartment
  label: string
  title: string
  subtitle: string
  /** false = deterministic (Security); true = Nova-backed reasoning agent. */
  ai: boolean
  /** Per-domain accent, grounded in the domain's nature — Revenue=green,
   *  Operations=amber, Customer=sky, Security=crimson (all distinct). Security's
   *  deterministic nature is signalled by the crisp, gradient-free card treatment
   *  (config.ai === false), not by the colour. */
  accent: string
  /** What the agent DOES, in plain language (leads the identity panel). */
  nature: string
  /** The real enterprise channel this team's signal comes from. */
  channel: string
  examples: string[]
}

const TEAMS: Record<string, TeamConfig> = {
  revenue: {
    slug: 'revenue',
    department: 'revenue',
    label: 'Revenue',
    accent: 'oklch(0.723 0.192 149.6)', // emerald — money
    title: 'The Revenue team’s desk.',
    subtitle:
      'Pipeline, renewals, and account value — everything the engine is watching on the revenue side, in one place.',
    ai: true,
    channel: 'CRM · renewal pipeline',
    nature:
      'Watches every account’s renewal exposure — reading ARR, renewal windows, account stage, and CS tier to judge what revenue is genuinely at risk and what’s worth expanding. Runs on Amazon Nova Pro.',
    examples: [
      'Which renewals are most at risk right now and what has worked before?',
      'How have we saved an account heading into a budget freeze?',
      'What revenue exposure pattern should we watch this quarter?',
    ],
  },
  security: {
    slug: 'security',
    department: 'security',
    label: 'Security',
    accent: 'oklch(0.585 0.22 18)', // crimson — security alert; distinct from Customer's sky
    title: 'The Security team’s desk.',
    subtitle:
      'Access and anomalies — everything the engine is flagging on the security side, in one place.',
    ai: false,
    channel: 'Security monitoring · API telemetry',
    nature:
      'Flags access and API anomalies the moment telemetry crosses a fixed threshold — API-call volume against baseline, unusual access patterns. Deterministic by design: every flag traces to a rule, never to a model’s judgment, so security findings stay fully auditable. See the Engine Room for the rationale.',
    examples: [
      'What should we do about an API anomaly threatening a renewal?',
      'How have we handled an API key compromise before?',
      'What access-pattern anomalies have preceded a real incident?',
    ],
  },
  operations: {
    slug: 'operations',
    department: 'operations',
    label: 'Operations',
    accent: 'oklch(0.705 0.187 47.6)', // amber — delivery / build
    title: 'The Operations team’s desk.',
    subtitle:
      'Delivery and coordination — everything the engine is watching across engineering, in one place.',
    ai: true,
    channel: 'GitHub',
    nature:
      'Tracks delivery health across engineering — open PRs, blocker issues, CI failures, and commit velocity from GitHub — to surface delivery risk and coordination gaps before they hit a customer commitment. Runs on Amazon Nova Pro.',
    examples: [
      'What delivery blockers are putting commitments at risk?',
      'How have we recovered from an engineering delay on a committed integration?',
      'What coordination gaps have caused problems before?',
    ],
  },
  customer: {
    slug: 'customer',
    department: 'customer',
    label: 'Customer',
    accent: 'oklch(0.62 0.16 240)', // sky — health / sentiment
    title: 'The Customer team’s desk.',
    subtitle:
      'Health and sentiment — everything the engine is watching on the customer side, in one place.',
    ai: true,
    channel: 'Support desk · CS platform',
    nature:
      'Reads the earliest signs of churn — health score, support-ticket volume, sentiment, and feature adoption — and judges which accounts are slipping and why. Runs on Amazon Nova Pro.',
    examples: [
      'Which accounts are showing the earliest churn signals?',
      'How have we handled a support-ticket spike that put revenue at risk?',
      'What sentiment drift has preceded a churn before?',
    ],
  },
}

export default function TeamPage() {
  const params = useParams<{ team: string }>()
  const config = TEAMS[params.team]
  if (!config) notFound()

  return <TeamView config={config!} />
}

function TeamView({ config }: { config: TeamConfig }) {
  const { data: risksData } = useSWR('risks', fetchRisks)
  const { data: customersData } = useSWR('customers', fetchCustomers)

  const customers = customersData?.customers ?? []
  const accountNames = customers.map((c) => c.name)

  const directed = useMemo(() => {
    const groups = groupBriefs(risksData?.risks ?? [], accountNames)
    return groups.filter((g) => isDirectedAt(g, config.department))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [risksData, customersData, config.department])

  const { activated } = useActivation()

  if (!activated) {
    return <AtRest eyebrow="Department Intelligence" title={config.label} surface={`The ${config.label} team desk`} />
  }

  const accent = config.accent
  return (
    <div className="max-w-[1100px] mx-auto px-8 py-8">
      {/* Per-team accent rule — color-codes the domain at a glance */}
      <div className="h-1 w-16 rounded-full mb-4" style={{ background: accent }} aria-hidden />

      <PageHeader eyebrow="Department Intelligence" title={config.label} subtitle={config.subtitle} />

      {/* Vertical stack: who this agent is, then what it's reading right now —
          each box sized to its OWN content (no shared/stretched height). AI
          teams get a soft accent-tinted identity card; Security (the one
          deterministic agent) gets a harder, gradient-free, crisp-bordered
          treatment so the rules-not-probabilistic nature is felt visually. */}
      <div className="mt-6 space-y-5">
        {/* Agent identity */}
        <div
          className={'rounded-xl border px-4 py-4 ' + (config.ai ? 'bg-gradient-to-br from-card to-secondary/20' : 'bg-card')}
          style={{
            borderColor: config.ai
              ? `color-mix(in oklch, ${accent} 30%, var(--border))`
              : `color-mix(in oklch, ${accent} 55%, var(--border))`,
          }}
        >
          <div className="flex items-center justify-between gap-3 mb-2 flex-wrap">
            <span className="text-sm font-semibold text-foreground">{config.label} Agent</span>
            <div className="flex items-center gap-1.5 flex-wrap">
              <span
                className="text-xs uppercase tracking-widest px-1.5 py-0.5 rounded border font-semibold"
                style={{ color: accent, borderColor: `color-mix(in oklch, ${accent} 45%, transparent)` }}
              >
                {config.ai ? 'Nova Pro' : 'Deterministic'}
              </span>
              <span className="text-xs uppercase tracking-widest px-1.5 py-0.5 rounded border border-border text-muted-foreground">
                {config.channel}
              </span>
            </div>
          </div>
          <p className="text-sm text-foreground/85 leading-relaxed">
            {config.nature}
            {!config.ai ? (
              <>
                {' '}
                <Link href="/platform/engine" className="text-primary hover:underline">
                  Engine Room →
                </Link>
              </>
            ) : null}
          </p>
        </div>

        {/* Live signal feeding this team, across accounts */}
        <div className="rounded-xl border border-border bg-card/40 px-4 py-4">
          <p className="text-xs tracking-[0.2em] uppercase mb-1" style={{ color: accent }}>
            {'>'} Live signal · {config.channel}
          </p>
          <p className="text-sm text-muted-foreground mb-3">The raw feed this team reads, across every account.</p>
          {!customersData ? (
            <div className="rounded-xl border border-border bg-card/40 px-4 py-8 text-center">
              <p className="text-sm text-muted-foreground animate-pulse">Loading the live feed…</p>
            </div>
          ) : (
            <TeamSignalStrip customers={customers} department={config.department} />
          )}
          <p className="mt-3 text-xs text-muted-foreground">
            {config.department === 'operations'
              ? 'Live from the connected GitHub workspace'
              : `Live from ${config.channel}`}
          </p>
        </div>
      </div>

      {/* PRIMARY 1 — query the engine, scoped to this team (the centre of gravity) */}
      <section className="mt-8">
        <p className="text-xs tracking-[0.2em] uppercase mb-1" style={{ color: accent }}>
          {'>'} Query the {config.label} intelligence
        </p>
        <p className="text-sm text-muted-foreground mb-3 max-w-[640px]">
          Ask the same engine that produces these findings — answered from the {config.label} team’s real
          history and active risks, with the evidence shown for every claim.
        </p>
        <DebriefChat
          department={config.department}
          examples={config.examples}
          placeholder={`Ask about ${config.label.toLowerCase()} — renewals, risks, what’s worked before…`}
          boxed
          accent={accent}
        />
      </section>

      {/* PRIMARY 2 — insights directed at this team */}
      <section id="team-insights" className="mt-10 scroll-mt-20">
        <p className="text-xs tracking-[0.2em] uppercase mb-3" style={{ color: accent }}>
          {'>'} Insights directed at {config.label}
        </p>
        {!risksData ? (
          <div className="rounded-2xl border border-border bg-card/40 px-6 py-12 text-center">
            <p className="text-sm text-muted-foreground animate-pulse">Loading insights from AWS…</p>
          </div>
        ) : directed.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-border bg-card/40 px-6 py-12 text-center">
            <p className="text-sm text-muted-foreground">
              Nothing needs the {config.label} team’s attention right now. When the engine raises a finding
              for {config.label}, it appears here.
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {directed.map((g, i) => {
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
        )}
      </section>

    </div>
  )
}
