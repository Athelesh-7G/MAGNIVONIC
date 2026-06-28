'use client'

import { useState } from 'react'
import useSWR, { useSWRConfig } from 'swr'
import { motion } from 'framer-motion'
import { GitPullRequest, CircleAlert, GitCommitHorizontal, Bell, ArrowUpRight } from 'lucide-react'
import { fetchGithub, fetchSlack, sendSlackTemplate, type GithubResponse, type SlackResponse, type SlackTemplate } from '@/lib/api'
import { PageHeader } from '@/components/platform/page-header'
import { SeverityBadge, formatTimestamp, OK, WARN, CRIT, Stat } from '@/components/platform/signal-ui'
import { AtRest } from '@/components/platform/at-rest'
import { useActivation } from '@/lib/activation'

const SLACK_CHANNEL_URL = 'https://magnivonic-alerts.slack.com/archives/C0BBQESJFLJ'

export default function ConnectionsPage() {
  const { activated } = useActivation()

  if (!activated) {
    return <AtRest eyebrow="Specialized Agents" title="Connections" surface="The integrations layer" />
  }

  return (
    <div className="max-w-[1100px] mx-auto px-8 py-8">
      <PageHeader
        eyebrow="Specialized Agents"
        title="Connections"
        subtitle="The real tools the agents reach into — live delivery signals pulled in from GitHub, executive alerts pushed out to Slack. Connection status and recent activity, straight from the source."
      />

      <div className="mt-6 space-y-4">
        <GithubCard />
        <SlackCard />
        <PlannedIntegrations />
      </div>
    </div>
  )
}

function ConnectionShell({
  title,
  subtitle,
  connected,
  right,
  children,
}: {
  title: string
  subtitle: string
  connected: boolean | undefined
  right?: React.ReactNode
  children: React.ReactNode
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, ease: 'easeOut' }}
      className="rounded-2xl border border-border bg-gradient-to-br from-card to-secondary/20 overflow-hidden"
    >
      <div className="flex items-start justify-between gap-4 px-5 py-4 border-b border-border/60">
        <div>
          <div className="flex items-center gap-2.5">
            <h2 className="text-base font-bold text-foreground">{title}</h2>
            <ConnectedPill connected={connected} />
          </div>
          <p className="text-sm text-muted-foreground mt-0.5">{subtitle}</p>
        </div>
        {right}
      </div>
      <div className="px-5 py-4">{children}</div>
    </motion.div>
  )
}

function ConnectedPill({ connected }: { connected: boolean | undefined }) {
  if (connected === undefined) {
    return <span className="text-xs uppercase tracking-widest text-muted-foreground animate-pulse">checking…</span>
  }
  const c = connected ? OK : 'var(--muted-foreground)'
  return (
    <span
      className="inline-flex items-center gap-1.5 text-xs uppercase tracking-widest px-1.5 py-0.5 rounded border font-semibold"
      style={{ color: c, borderColor: `color-mix(in oklch, ${c} 35%, transparent)`, background: `color-mix(in oklch, ${c} 8%, transparent)` }}
    >
      <span className="w-1.5 h-1.5 rounded-full" style={{ background: c }} />
      {connected ? 'Connected' : 'Disconnected'}
    </span>
  )
}

function RepoLink({ href, label }: { href: string; label: string }) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="inline-flex items-center gap-1 text-sm font-medium text-primary hover:underline shrink-0"
    >
      {label}
      <ArrowUpRight className="w-3.5 h-3.5" />
    </a>
  )
}

function GithubCard() {
  const { data } = useSWR<GithubResponse>('github', fetchGithub)
  const s = data?.signals
  const trend = s?.commit_velocity.trend ?? '—'

  return (
    <ConnectionShell
      title="GitHub"
      subtitle={data ? data.repo : 'Delivery signals — open PRs, blockers, CI, commit velocity'}
      connected={data?.connected}
      right={data ? <RepoLink href={data.repo_url} label="Open repo" /> : undefined}
    >
      {!data ? (
        <p className="text-sm text-muted-foreground animate-pulse">Loading live GitHub signals…</p>
      ) : !s ? (
        <p className="text-sm text-muted-foreground">No signals available right now.</p>
      ) : (
        <div className="space-y-4">
          <div className="flex items-start gap-8 flex-wrap">
            <Stat value={`${s.open_prs.count}`} label="Open PRs" align="left" accent={s.open_prs.count > 0 ? WARN : undefined} />
            <Stat value={`${s.blocker_issues.count}`} label="Blocker issues" align="left" accent={s.blocker_issues.count > 0 ? CRIT : undefined} />
            <Stat value={`${s.recent_failures.count}`} label="Recent CI failures" align="left" accent={s.recent_failures.count > 0 ? CRIT : undefined} />
            <Stat value={`${s.commit_velocity.commits_7d}`} label={`Commits (7d) · ${trend}`} align="left" />
          </div>

          {s.blocker_issues.issues.length > 0 ? (
            <ActivityList
              icon={<CircleAlert className="w-4 h-4" style={{ color: CRIT }} />}
              label="Blocker issues"
              items={s.blocker_issues.issues}
            />
          ) : null}
          {s.open_prs.titles.length > 0 ? (
            <ActivityList
              icon={<GitPullRequest className="w-4 h-4" style={{ color: WARN }} />}
              label="Open pull requests"
              items={s.open_prs.titles}
            />
          ) : null}
          {s.recent_failures.runs.length > 0 ? (
            <ActivityList
              icon={<GitCommitHorizontal className="w-4 h-4 text-muted-foreground" />}
              label="Recent failed runs"
              items={s.recent_failures.runs}
            />
          ) : null}
          <p className="text-xs text-muted-foreground/60">
            Live from GET /github · the same delivery feed the Operations agent reads · checked{' '}
            {formatTimestamp(data.checked_at)}
          </p>
        </div>
      )}
    </ConnectionShell>
  )
}

function ActivityList({ icon, label, items }: { icon: React.ReactNode; label: string; items: string[] }) {
  return (
    <div>
      <p className="text-xs uppercase tracking-widest text-muted-foreground mb-2">{label}</p>
      <ul className="space-y-1.5">
        {items.map((t, i) => (
          <li key={i} className="flex items-start gap-2">
            <span className="mt-0.5 shrink-0">{icon}</span>
            <span className="text-sm text-foreground/85 leading-snug">{t}</span>
          </li>
        ))}
      </ul>
    </div>
  )
}

const SLACK_TEMPLATES: { id: SlackTemplate; label: string; accent: string }[] = [
  { id: 'risk', label: 'Risk alert', accent: CRIT },
  { id: 'opportunity', label: 'Opportunity', accent: OK },
  { id: 'coordination', label: 'Coordination gap', accent: WARN },
  { id: 'sync', label: 'Schedule sync', accent: 'var(--primary)' },
]

function SlackSendRow() {
  const { mutate } = useSWRConfig()
  const [sending, setSending] = useState<SlackTemplate | null>(null)
  const [note, setNote] = useState<string | null>(null)

  async function send(t: SlackTemplate, label: string) {
    setSending(t)
    setNote(null)
    try {
      const res = await sendSlackTemplate(t)
      setNote(res.delivered ? `Sent “${label}” → channel` : `Send failed (status ${res.status_code ?? '—'})`)
      mutate('slack') // refresh the history below so the new alert appears
    } catch {
      setNote('Send failed — network or webhook error')
    } finally {
      setSending(null)
    }
  }

  return (
    <div className="rounded-xl border border-border bg-card/40 p-3.5 mb-3">
      <p className="text-xs uppercase tracking-widest text-muted-foreground mb-2.5">
        Send a real message · posts to the live webhook &amp; logs below
      </p>
      <div className="flex flex-wrap gap-2">
        {SLACK_TEMPLATES.map((t) => (
          <button
            key={t.id}
            type="button"
            disabled={sending !== null}
            onClick={() => send(t.id, t.label)}
            className="inline-flex items-center gap-1.5 text-xs font-medium rounded-lg border px-3 py-1.5 transition-colors hover:bg-muted disabled:opacity-50"
            style={{ borderColor: `color-mix(in oklch, ${t.accent} 35%, var(--border))` }}
          >
            <span className="w-1.5 h-1.5 rounded-full" style={{ background: t.accent }} />
            {sending === t.id ? 'Sending…' : t.label}
          </button>
        ))}
      </div>
      {note ? <p className="text-xs text-muted-foreground mt-2">{note}</p> : null}
    </div>
  )
}

function SlackCard() {
  const { data } = useSWR<SlackResponse>('slack', fetchSlack)

  return (
    <ConnectionShell
      title="Slack"
      subtitle={data ? `Executive alerts → ${data.channel}` : 'Executive alerts pushed when a critical risk is synthesized'}
      connected={data?.connected}
      right={<RepoLink href={SLACK_CHANNEL_URL} label="Open channel" />}
    >
      <SlackSendRow />
      {!data ? (
        <p className="text-sm text-muted-foreground animate-pulse">Loading alert history…</p>
      ) : data.alerts.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border bg-card/40 px-4 py-6">
          <p className="text-sm text-muted-foreground">
            No alerts sent yet. When the engine synthesizes a critical risk, an executive alert fires to{' '}
            {data.channel} and lands here.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          <div className="flex items-center gap-8">
            <Stat value={`${data.total}`} label="Alerts sent" align="left" />
            <Stat
              value={`${data.alerts.filter((a) => a.delivered).length}`}
              label="Delivered"
              align="left"
              accent={OK}
            />
          </div>
          <div className="space-y-2">
            {data.alerts.map((a) => (
              <div key={a.id} className="rounded-xl border border-border bg-card/60 p-3.5">
                <div className="flex items-center gap-2 flex-wrap mb-1">
                  <Bell className="w-3.5 h-3.5" style={{ color: a.delivered ? OK : 'var(--muted-foreground)' }} />
                  <SeverityBadge severity={a.severity} />
                  <span className="text-sm font-semibold text-foreground">{a.risk_title}</span>
                  <span className="text-xs text-muted-foreground ml-auto">
                    {a.account ? `${a.account} · ` : ''}
                    {formatTimestamp(a.created_at)}
                  </span>
                </div>
                {a.summary ? (
                  <p className="text-xs text-muted-foreground leading-relaxed">{a.summary}</p>
                ) : null}
                <p className="text-xs mt-1.5" style={{ color: a.delivered ? OK : CRIT }}>
                  {a.delivered ? `delivered · ${data.channel}` : `not delivered (status ${a.status_code ?? '—'})`}
                  {a.score != null ? ` · score ${a.score}/100` : ''}
                </p>
              </div>
            ))}
          </div>
          <p className="text-xs text-muted-foreground/60">Live from GET /slack · real alerts the orchestrator actually sent.</p>
        </div>
      )}
    </ConnectionShell>
  )
}

const PLANNED = [
  { name: 'Jira', what: 'Pull delivery epics & sprint risk' },
  { name: 'Salesforce', what: 'Real pipeline & renewal data' },
  { name: 'PagerDuty', what: 'Incident signal into the Security agent' },
  { name: 'Linear', what: 'Engineering throughput signal' },
  { name: 'Datadog', what: 'Production health into Operations' },
]

function PlannedIntegrations() {
  return (
    <div className="rounded-2xl border border-dashed border-border bg-card/40 px-5 py-4">
      <p className="text-xs uppercase tracking-widest text-muted-foreground mb-1">More integrations</p>
      <p className="text-sm text-muted-foreground mb-4">
        Planned tool connections — not yet built. Each becomes another real signal source feeding the agents.
      </p>
      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {PLANNED.map((p) => (
          <div key={p.name} className="rounded-xl border border-border bg-card/40 px-4 py-3 opacity-70">
            <div className="flex items-center justify-between">
              <span className="text-sm font-semibold text-foreground">{p.name}</span>
              <span className="text-xs uppercase tracking-widest text-muted-foreground">Planned</span>
            </div>
            <p className="text-xs text-muted-foreground mt-1">{p.what}</p>
          </div>
        ))}
      </div>
    </div>
  )
}
