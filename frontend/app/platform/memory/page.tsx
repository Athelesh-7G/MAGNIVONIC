'use client'

import { Suspense, useEffect, useMemo, useRef, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import { motion } from 'framer-motion'
import useSWR from 'swr'
import { fetchMemory, formatCurrency, type MemoryEntry } from '@/lib/api'
import { PageHeader } from '@/components/platform/page-header'
import { Stat, OK } from '@/components/platform/signal-ui'
import { AtRest } from '@/components/platform/at-rest'
import { useActivation } from '@/lib/activation'

export default function MemoryPage() {
  return (
    <Suspense fallback={null}>
      <MemoryView />
    </Suspense>
  )
}

function MemoryView() {
  const { data, error, isLoading, mutate } = useSWR('memory', fetchMemory)
  const [query, setQuery] = useState('')
  const searchParams = useSearchParams()
  const highlightId = searchParams.get('id')
  const highlightRef = useRef<HTMLDivElement | null>(null)

  const entries = data?.memory ?? []
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return entries
    return entries.filter((e) =>
      [e.summary, e.outcome ?? '', e.lessons_learned ?? ''].join(' ').toLowerCase().includes(q),
    )
  }, [entries, query])

  // Scroll a precedent-linked entry into view once data is present.
  useEffect(() => {
    if (highlightId && highlightRef.current) {
      highlightRef.current.scrollIntoView({ behavior: 'smooth', block: 'center' })
    }
  }, [highlightId, data])

  const { activated } = useActivation()

  if (!activated) {
    return <AtRest eyebrow="Specialized Agents" title="Organizational Memory" surface="The memory ledger" />
  }

  return (
    <div className="max-w-[1100px] mx-auto px-8 py-8">
      <PageHeader
        eyebrow="Specialized Agents"
        title="Organizational Memory"
        subtitle="The institutional memory the engine reasons over — every past incident, its outcome, and the lesson it left behind, recalled when a new event resembles an old one. Recall is a pgvector similarity search (HNSW · cosine) over Aurora PostgreSQL — the same vector store the General Manager queries on every run."
      />

      {entries.length > 0 ? <MemorySynthesisBar entries={entries} /> : null}

      {/* Search */}
      <div className="mt-6 flex items-center gap-3">
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search incidents, outcomes, lessons…"
          className="flex-1 h-9 px-3 rounded-lg border border-border bg-card text-sm text-foreground placeholder:text-muted-foreground/60 focus:outline-none focus:ring-1 focus:ring-primary"
        />
        {data ? (
          <span className="text-xs text-muted-foreground shrink-0">
            {filtered.length} of {entries.length}
          </span>
        ) : null}
      </div>

      {/* List */}
      <div className="mt-5 space-y-3">
        {isLoading ? (
          <div className="rounded-2xl border border-border bg-card/40 px-6 py-16 text-center">
            <p className="text-sm text-muted-foreground animate-pulse">Loading organizational memory from AWS…</p>
          </div>
        ) : error ? (
          <div className="rounded-2xl border border-border bg-card/40 px-6 py-12 text-center">
            <p className="text-sm mb-4" style={{ color: 'oklch(0.58 0.22 25)' }}>
              Could not load memory. The service may be warming up.
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
            <p className="text-sm text-muted-foreground">No incidents match “{query}”.</p>
          </div>
        ) : (
          filtered.map((e, i) => (
            <MemoryRow
              key={e.id}
              entry={e}
              index={i}
              highlighted={e.id === highlightId}
              innerRef={e.id === highlightId ? highlightRef : undefined}
            />
          ))
        )}
      </div>
    </div>
  )
}

/** Top-of-page synthesis — frames Memory as a compounding institutional asset
 *  (what it has saved, what it has prevented) before the individual entries. */
function MemorySynthesisBar({ entries }: { entries: MemoryEntry[] }) {
  const saved = entries.reduce((n, e) => n + (e.revenue_saved || 0), 0)
  const churns = entries.filter((e) => e.prevented_churn).length
  const lessons = entries.filter((e) => e.lessons_learned).length
  return (
    <div className="mt-6 rounded-xl border border-border bg-gradient-to-br from-card to-secondary/20 px-5 py-4">
      <p className="text-sm text-muted-foreground mb-3">
        Everything the organization has learned, compounding — recalled the moment a new event resembles one of these.
      </p>
      <div className="flex items-start gap-10 flex-wrap">
        <Stat value={`${entries.length}`} label="Incidents remembered" align="left" />
        <Stat value={formatCurrency(saved)} label="Revenue saved" align="left" accent={OK} />
        <Stat value={`${churns}`} label="Churns prevented" align="left" accent={OK} />
        <Stat value={`${lessons}`} label="Lessons captured" align="left" />
      </div>
    </div>
  )
}

/** Each entry leads with the LESSON — the asset — then the incident that taught
 *  it, with what it saved/prevented pulled out as prominent stats. */
function MemoryRow({
  entry,
  index,
  highlighted,
  innerRef,
}: {
  entry: MemoryEntry
  index: number
  highlighted: boolean
  innerRef?: React.RefObject<HTMLDivElement | null>
}) {
  return (
    <motion.div
      ref={innerRef}
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, delay: Math.min(index * 0.05, 0.4), ease: 'easeOut' }}
      whileHover={{ y: -4 }}
      className="rounded-xl border bg-gradient-to-br from-card to-secondary/20 overflow-hidden"
      style={
        highlighted
          ? { borderColor: 'var(--primary)', boxShadow: '0 0 0 3px color-mix(in oklch, var(--primary) 18%, transparent)' }
          : { borderColor: 'var(--border)' }
      }
    >
      {/* Lesson — the hero */}
      <div className="relative pl-5 pr-5 py-4" style={{ borderLeft: `3px solid ${OK}` }}>
        <p className="text-xs uppercase tracking-widest mb-1.5" style={{ color: OK }}>
          Lesson learned
        </p>
        <p className="text-base font-semibold text-foreground leading-snug">
          {entry.lessons_learned || entry.summary}
        </p>
      </div>

      <div className="px-5 pb-4 space-y-3">
        {/* The incident that taught it */}
        <div>
          <p className="text-xs uppercase tracking-widest text-muted-foreground mb-1">From the incident</p>
          <p className="text-sm text-foreground/90 leading-relaxed">{entry.summary}</p>
          {entry.outcome ? (
            <p className="text-sm text-muted-foreground leading-relaxed mt-1">{entry.outcome}</p>
          ) : null}
        </div>

        {/* Outcome stats + provenance */}
        <div className="flex items-center justify-between gap-4 flex-wrap pt-1">
          <div className="flex items-center gap-2 flex-wrap">
            {entry.contributing_agents.map((a) => (
              <span key={a} className="px-1.5 py-0.5 rounded border border-border uppercase tracking-wider text-xs text-muted-foreground">
                {a}
              </span>
            ))}
          </div>
          <div className="flex items-center gap-6">
            {entry.revenue_saved > 0 ? (
              <Stat value={formatCurrency(entry.revenue_saved)} label="saved" accent={OK} />
            ) : null}
            {entry.prevented_churn ? <Stat value="Yes" label="churn prevented" accent={OK} /> : null}
            {entry.resolution_time_hours != null ? (
              <Stat value={`${entry.resolution_time_hours}h`} label="to resolve" />
            ) : null}
          </div>
        </div>
      </div>
    </motion.div>
  )
}
