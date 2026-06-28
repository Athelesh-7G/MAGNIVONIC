'use client'

import { useState } from 'react'
import Link from 'next/link'
import { motion } from 'framer-motion'
import useSWR from 'swr'
import { fetchCustomers, fetchRisks, formatCurrency, daysUntil, type Customer } from '@/lib/api'
import { PageHeader } from '@/components/platform/page-header'
import { SignalLanes } from '@/components/platform/signal-lanes'
import { SeverityBadge, severityColor, Stat } from '@/components/platform/signal-ui'
import { AtRest } from '@/components/platform/at-rest'
import { useActivation } from '@/lib/activation'

export default function DossiersPage() {
  const { data: customersData, error, isLoading, mutate } = useSWR('customers', fetchCustomers)
  const { data: risksData } = useSWR('risks', fetchRisks)
  const { activated } = useActivation()

  const customers = customersData?.customers ?? []
  // Data-driven: an account "has briefs" if a real /risks row references it by title.
  const briefCountFor = (name: string) =>
    (risksData?.risks ?? []).filter((r) => r.title.toLowerCase().includes(name.toLowerCase())).length

  // Open the lead account by default (highest-ARR at-risk), not a hardcoded name.
  const atRisk = customers.filter((c) => c.account_stage === 'at_risk')
  const leadPool = atRisk.length > 0 ? atRisk : customers
  const leadAccountId = leadPool.length > 0 ? leadPool.reduce((b, c) => (c.arr > b.arr ? c : b), leadPool[0]).id : null

  if (!activated) {
    return <AtRest eyebrow="The Record" title="Dossiers" surface="The account dossiers" />
  }

  return (
    <div className="max-w-[1100px] mx-auto px-8 py-8">
      <PageHeader
        eyebrow="The Record"
        title="Dossiers"
        subtitle="Every account under watch, with its live cross-domain state in one place — health, renewal exposure, security posture, and the findings tied to it."
      />

      <div className="mt-6 space-y-3">
        {isLoading ? (
          <div className="rounded-2xl border border-border bg-card/40 px-6 py-16 text-center">
            <p className="text-sm text-muted-foreground animate-pulse">Loading accounts from AWS…</p>
          </div>
        ) : error ? (
          <div className="rounded-2xl border border-border bg-card/40 px-6 py-12 text-center">
            <p className="text-sm mb-4" style={{ color: 'oklch(0.58 0.22 25)' }}>
              Could not load accounts. The service may be warming up.
            </p>
            <button
              type="button"
              onClick={() => mutate()}
              className="h-9 px-4 inline-flex items-center rounded-lg text-sm font-medium bg-muted text-foreground hover:bg-muted/70 transition-colors"
            >
              Retry
            </button>
          </div>
        ) : customers.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-border bg-card/40 px-6 py-14 text-center">
            <p className="text-sm text-muted-foreground">No accounts returned.</p>
          </div>
        ) : (
          customers.map((c, i) => (
            <AccountCard
              key={c.id}
              c={c}
              index={i}
              briefCount={briefCountFor(c.name)}
              defaultOpen={c.id === leadAccountId}
            />
          ))
        )}
      </div>
    </div>
  )
}

function healthColor(score: number): string {
  return score >= 70 ? 'oklch(0.62 0.17 150)' : score >= 50 ? 'oklch(0.68 0.17 65)' : 'oklch(0.58 0.22 25)'
}

function AccountCard({
  c,
  index,
  briefCount,
  defaultOpen,
}: {
  c: Customer
  index: number
  briefCount: number
  defaultOpen: boolean
}) {
  const [open, setOpen] = useState(defaultOpen)
  const days = daysUntil(c.renewal_date)
  const atRisk = c.account_stage === 'at_risk'
  const accent = atRisk ? severityColor('critical') : 'var(--border)'

  return (
    <motion.article
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, delay: Math.min(index * 0.05, 0.4), ease: 'easeOut' }}
      whileHover={!open ? { y: -4 } : undefined}
      className="rounded-xl border bg-gradient-to-br from-card to-secondary/20 overflow-hidden"
      style={{ borderColor: atRisk ? `color-mix(in oklch, ${accent} 30%, var(--border))` : 'var(--border)' }}
    >
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="w-full text-left px-5 py-4 flex items-center gap-4 hover:bg-muted/40 transition-colors"
        aria-expanded={open}
      >
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2.5 mb-1 flex-wrap">
            <h3 className="text-base font-bold tracking-tight text-foreground">{c.name}</h3>
            {atRisk ? <SeverityBadge severity="critical" /> : null}
            <span className="text-xs uppercase tracking-wider text-muted-foreground border border-border rounded px-1.5 py-0.5">
              {c.cs_tier}
            </span>
          </div>
          <p className="text-xs text-muted-foreground">
            {briefCount > 0 ? (
              <>
                {briefCount} synthesized brief{briefCount === 1 ? '' : 's'} ·{' '}
                <Link href="/platform/briefs" className="text-primary hover:underline">
                  view in Executive Briefs →
                </Link>
              </>
            ) : (
              'No briefs raised for this account yet'
            )}
          </p>
        </div>

        <div className="flex items-start gap-6 shrink-0">
          <Stat label="Health" value={`${c.health_score}`} accent={healthColor(c.health_score)} />
          <Stat label="ARR" value={formatCurrency(c.arr)} />
          <Stat
            label="Renewal"
            value={`${days}d`}
            accent={days <= 35 ? 'oklch(0.58 0.22 25)' : undefined}
          />
          <span className="text-muted-foreground text-xs mt-2 w-3 text-center">{open ? '↑' : '↓'}</span>
        </div>
      </button>

      {open ? (
        <div className="px-5 pb-5 pt-1">
          <p className="text-xs tracking-[0.18em] uppercase text-muted-foreground mb-3">
            Live signal · CRM, support desk &amp; security monitoring
          </p>
          <SignalLanes customer={c} />
        </div>
      ) : null}
    </motion.article>
  )
}
