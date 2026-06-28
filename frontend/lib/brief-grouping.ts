import type { Risk, InsightType } from '@/lib/api'

export const UNATTRIBUTED = 'Unattributed'

export interface BriefGroup {
  key: string
  account: string
  insightType: InsightType
  runs: Risk[] // newest-first
}

/**
 * Group real /risks rows into events. KEY = account + severity + revenue_exposure
 * + insight_type. Repeated /analyze test runs of the same situation (same account,
 * same severity, same exposure, only cosmetically different wording) collapse into
 * one event whose latest run is the canonical brief — no DB rows are deleted, the
 * full run history is preserved on the card.
 *
 * insight_type is part of the key so Risk/Opportunity/CoordinationGap/Drift are
 * never merged even when they share an account, severity, and exposure.
 *
 * Shared by the Executive Briefs feed and the per-team pages so both group events
 * identically (a team page must not show the same event three times because it was
 * re-analyzed three times).
 */
export function groupBriefs(briefs: Risk[], accountNames: string[]): BriefGroup[] {
  const accountOf = (title: string) =>
    accountNames.find((n) => title.toLowerCase().includes(n.toLowerCase())) ?? UNATTRIBUTED

  const map = new Map<string, BriefGroup>()
  // briefs arrive newest-first from the backend; insertion order keeps that,
  // so runs[0] of each group is the latest run.
  for (const r of briefs) {
    const account = accountOf(r.title)
    const key = `${account}|${r.severity}|${r.revenue_exposure}|${r.insight_type}`
    const existing = map.get(key)
    if (existing) existing.runs.push(r)
    else map.set(key, { key, account, insightType: r.insight_type, runs: [r] })
  }
  return Array.from(map.values())
}

/** True if a group's canonical (latest) brief carries a directive for `department`
 *  — i.e. the engine actually directed this finding at that team. Used to filter
 *  the org-wide brief feed down to one team's relevant insights. */
export function isDirectedAt(group: BriefGroup, department: string): boolean {
  return (group.runs[0]?.recommendations ?? []).some((rec) => rec.department === department)
}
