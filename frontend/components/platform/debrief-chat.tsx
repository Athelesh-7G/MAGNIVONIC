'use client'

import { useEffect, useRef, useState } from 'react'
import { motion } from 'framer-motion'
import { Volume2, Square } from 'lucide-react'
import {
  debrief,
  speakAnswer,
  formatCurrency,
  ApiError,
  type DebriefResponse,
  type TeamDepartment,
} from '@/lib/api'
import { SeverityBadge, formatTimestamp, OK, CRIT, WARN, Stat } from '@/components/platform/signal-ui'
import { ScoreProvenance } from '@/components/platform/score-provenance'

type Status = 'idle' | 'loading' | 'done' | 'error'

const DEFAULT_EXAMPLES = [
  'Vantage Retail Group has an API anomaly and a renewal in three weeks — what has worked before and what should we do?',
  'What lessons apply when a security issue threatens an imminent renewal?',
  'How have we handled support-ticket spikes that put revenue at risk?',
]

/**
 * The Debrief chat — shared by the standalone Debrief page (org-wide) and the
 * four team pages (scoped). When `department` is set, the query is constrained
 * to that team's corpus server-side (WHERE before LIMIT, not a cosmetic filter)
 * and the empty states say so plainly rather than implying a broader search ran.
 */
export function DebriefChat({
  department,
  examples = DEFAULT_EXAMPLES,
  placeholder = 'Ask about an account, a risk, or what the organization has learned before…',
  boxed = false,
  accent,
}: {
  department?: TeamDepartment
  examples?: string[]
  placeholder?: string
  /** Contain the input in a bordered card (team pages) to match their other
   *  boxed sections. The dedicated Debrief page leaves it open. */
  boxed?: boolean
  /** Team accent colour — tints the boxed input's border + subtle background so
   *  the chat reads as part of that team's surface. */
  accent?: string
}) {
  const [question, setQuestion] = useState('')
  const [status, setStatus] = useState<Status>('idle')
  const [result, setResult] = useState<DebriefResponse | null>(null)
  const [elapsed, setElapsed] = useState(0)
  const [errInfo, setErrInfo] = useState<{ timeout: boolean; message: string } | null>(null)
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const run = async (q: string) => {
    const query = q.trim()
    if (!query || status === 'loading') return
    setStatus('loading')
    setResult(null)
    setErrInfo(null)
    setElapsed(0)
    const start = Date.now()
    intervalRef.current = setInterval(() => setElapsed((Date.now() - start) / 1000), 100)
    try {
      const data = await debrief(query, department)
      setResult(data)
      setStatus('done')
    } catch (e) {
      const timeout = e instanceof ApiError && e.isTimeout
      setErrInfo({ timeout, message: e instanceof Error ? e.message : 'Unknown error' })
      setStatus('error')
    } finally {
      if (intervalRef.current) clearInterval(intervalRef.current)
    }
  }

  return (
    <div>
      <form
        onSubmit={(e) => {
          e.preventDefault()
          run(question)
        }}
        className={boxed ? 'rounded-xl border p-4' : undefined}
        style={
          boxed
            ? accent
              ? {
                  borderColor: `color-mix(in oklch, ${accent} 40%, var(--border))`,
                  background: `color-mix(in oklch, ${accent} 5%, var(--card))`,
                }
              : { borderColor: 'var(--border)', background: 'color-mix(in oklch, var(--card) 60%, transparent)' }
            : undefined
        }
      >
        <div className="flex items-start gap-3">
          <textarea
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
            placeholder={placeholder}
            rows={2}
            className="flex-1 px-3.5 py-2.5 rounded-lg border border-border bg-card text-sm text-foreground placeholder:text-muted-foreground/60 focus:outline-none focus:ring-1 focus:ring-primary resize-none"
          />
          <button
            type="submit"
            disabled={status === 'loading' || !question.trim()}
            className={
              'h-[46px] px-5 inline-flex items-center gap-2 rounded-lg text-sm font-semibold transition-colors shrink-0 ' +
              (status === 'loading' || !question.trim()
                ? 'bg-muted text-muted-foreground cursor-not-allowed'
                : 'bg-primary text-primary-foreground hover:bg-primary/90')
            }
          >
            {status === 'loading' ? (
              <>
                <span className="w-1.5 h-1.5 rounded-full bg-current animate-pulse-dot" />
                {elapsed.toFixed(1)}s
              </>
            ) : (
              'Ask'
            )}
          </button>
        </div>
        {status === 'idle' ? (
          <div className="mt-3 flex flex-wrap gap-2">
            {examples.map((ex) => (
              <button
                key={ex}
                type="button"
                onClick={() => {
                  setQuestion(ex)
                  run(ex)
                }}
                className="text-left text-xs text-muted-foreground hover:text-foreground border border-border rounded-full px-3 py-1 transition-colors"
              >
                {ex.length > 60 ? ex.slice(0, 60) + '…' : ex}
              </button>
            ))}
          </div>
        ) : null}
      </form>

      <div className="mt-6">
        {status === 'loading' ? (
          <LoadingPanel elapsed={elapsed} department={department} />
        ) : status === 'error' && errInfo ? (
          <DebriefError info={errInfo} elapsed={elapsed} onRetry={() => run(question)} />
        ) : status === 'done' && result ? (
          <DebriefResult result={result} department={department} />
        ) : null}
      </div>
    </div>
  )
}

function LoadingPanel({ elapsed, department }: { elapsed: number; department?: TeamDepartment }) {
  return (
    <div className="rounded-2xl border border-primary/30 bg-card p-6">
      <div className="flex items-center justify-between mb-3">
        <span className="flex items-center gap-2 text-xs tracking-[0.22em] uppercase text-primary">
          <span className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse-dot" />
          Working
        </span>
        <span className="text-xs tabular-nums text-foreground">{elapsed.toFixed(1)}s</span>
      </div>
      <p className="text-sm text-muted-foreground">
        Consulting {department ? `the ${department} team's` : 'organizational'} memory · weighing past incidents and
        active risk · composing the answer…
      </p>
    </div>
  )
}

function DebriefResult({ result, department }: { result: DebriefResponse; department?: TeamDepartment }) {
  const precedentCount = result.precedents.length
  const evidenceCount = result.evidence_used.length
  return (
    // Single vertical stack: question (above) → answer → evidence rail, top to
    // bottom. The evidence is always visible immediately below the answer — no
    // expand/collapse, no side column (which mismatched heights).
    <div className="space-y-4">
      {/* Answer */}
      <section
        className="rounded-2xl border bg-gradient-to-br from-card to-secondary/20 p-5"
        style={{ borderColor: 'color-mix(in oklch, var(--primary) 35%, var(--border))' }}
      >
        <div className="flex items-center justify-between gap-3 mb-2">
          <p className="text-xs uppercase tracking-widest text-primary">
            Answer{department ? ` · ${department} team` : ''}
          </p>
          <PlayAnswerButton text={result.answer} />
        </div>
        <p className="text-base text-foreground leading-relaxed whitespace-pre-line">{result.answer}</p>
        <p className="mt-3 text-xs text-muted-foreground/60">
          Grounded only in the cited evidence shown below{department ? ` · scoped to ${department}` : ''} · retrieved by pgvector similarity over Aurora organizational memory
        </p>
      </section>

      {/* Evidence & reasoning trail — always visible, directly below the answer */}
      <motion.aside
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.25 }}
        className="space-y-4 rounded-2xl border border-border bg-card/40 p-4"
      >
        <p className="text-xs uppercase tracking-widest text-foreground flex items-center gap-1.5">
          Evidence &amp; reasoning trail
          <span className="text-muted-foreground/60 normal-case tracking-normal">
            · {precedentCount} past · {evidenceCount} active
          </span>
        </p>

        {/* Consulted */}
        <section>
          <p className="text-[11px] uppercase tracking-widest text-muted-foreground mb-2">
            Consulted · domains in the evidence
          </p>
          {result.agents_consulted.length > 0 ? (
            <div className="flex flex-wrap gap-2">
              {result.agents_consulted.map((a) => (
                <span
                  key={a}
                  className="text-xs uppercase tracking-wider px-2 py-1 rounded border border-primary/40 bg-primary/5 text-foreground"
                >
                  {a}
                </span>
              ))}
            </div>
          ) : (
            <p className="text-xs text-muted-foreground italic">No domains represented in the evidence.</p>
          )}
        </section>

        {/* Precedents */}
        <section>
          <p className="text-[11px] uppercase tracking-widest text-muted-foreground mb-2 flex items-center gap-1.5">
            Past incidents · by relevance{department ? ` · ${department}` : ''}
            <ScoreProvenance kind="similarity" label="how" />
          </p>
          {result.precedents.length > 0 ? (
            <div className="space-y-2">
              {result.precedents.map((p, i) => (
                <div key={i} className="rounded-xl border border-border bg-card/60 p-3.5">
                  <div className="flex items-start gap-3">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-foreground/90 leading-snug">{p.summary}</p>
                      {p.lessons_learned ? (
                        <p className="text-xs text-muted-foreground mt-1 leading-relaxed">Lesson: {p.lessons_learned}</p>
                      ) : null}
                    </div>
                    <Stat
                      value={p.similarity.toFixed(2)}
                      label="relevance"
                      accent={p.similarity >= 0.35 ? OK : 'var(--muted-foreground)'}
                    />
                  </div>
                  <div className="mt-2 h-1 rounded-full bg-muted overflow-hidden">
                    <div
                      className="h-full rounded-full"
                      style={{
                        width: `${Math.max(0, Math.min(1, p.similarity)) * 100}%`,
                        background: p.similarity >= 0.35 ? OK : 'var(--muted-foreground)',
                      }}
                    />
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="rounded-xl border border-dashed border-border bg-card/40 px-4 py-5">
              <p className="text-sm text-muted-foreground">
                {department
                  ? `No ${department} past incident found for this question. Nothing outside the ${department} team's scope was searched.`
                  : 'No past incident matched this question.'}
              </p>
            </div>
          )}
        </section>

        {/* Active risks. On a team page these are already the "Insights directed
            at {team}" cards below — so we don't re-render them here (it read as
            duplication); a small pointer links down to them instead. The
            standalone Debrief page has no such section, so it shows them fully. */}
        {department ? (
          result.evidence_used.length > 0 ? (
            <section>
              <p className="text-[11px] uppercase tracking-widest text-muted-foreground mb-2">
                Active risk · {department}-directed
              </p>
              <a href="#team-insights" className="text-xs font-medium text-primary hover:underline">
                {result.evidence_used.length} {department}-directed insight
                {result.evidence_used.length === 1 ? '' : 's'} considered — see them in full below ↓
              </a>
            </section>
          ) : null
        ) : (
          <section>
            <p className="text-[11px] uppercase tracking-widest text-muted-foreground mb-2">
              Active risk considered
            </p>
            {result.evidence_used.length > 0 ? (
              <div className="space-y-2">
                {result.evidence_used.map((e) => (
                  <div key={e.id} className="rounded-lg border border-border bg-muted/30 p-3">
                    <div className="flex items-center gap-2 mb-1 flex-wrap">
                      <SeverityBadge severity={e.severity} />
                      <span className="text-xs font-semibold text-foreground">{e.title}</span>
                      <span className="text-xs text-muted-foreground ml-auto">
                        {formatCurrency(e.revenue_exposure)} · {formatTimestamp(e.created_at)}
                      </span>
                    </div>
                    <p className="text-xs text-muted-foreground leading-relaxed">{e.root_cause}</p>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-xs text-muted-foreground">
                No active risk matched — answered from past incidents only.
              </p>
            )}
          </section>
        )}
      </motion.aside>
    </div>
  )
}

/** Plays the final ANSWER text as speech via Amazon Polly (POST /speak). Only
 *  the answer is spoken — never the evidence trail. Simple idle/loading/playing
 *  states, no picker or waveform. */
function PlayAnswerButton({ text }: { text: string }) {
  const [status, setStatus] = useState<'idle' | 'loading' | 'playing' | 'error'>('idle')
  const audioRef = useRef<HTMLAudioElement | null>(null)

  // Clean up audio on unmount.
  useEffect(() => () => { audioRef.current?.pause(); audioRef.current = null }, [])

  async function play() {
    if (status === 'playing') {
      audioRef.current?.pause()
      audioRef.current = null
      setStatus('idle')
      return
    }
    setStatus('loading')
    try {
      const res = await speakAnswer(text)
      const audio = new Audio(`data:audio/mp3;base64,${res.audio}`)
      audioRef.current = audio
      audio.onended = () => setStatus('idle')
      audio.onerror = () => setStatus('error')
      await audio.play()
      setStatus('playing')
    } catch {
      setStatus('error')
    }
  }

  const label =
    status === 'loading' ? 'Synthesizing…' : status === 'playing' ? 'Stop' : status === 'error' ? 'Audio failed' : 'Play answer'

  return (
    // Distinct ORANGE, boxed control — reads as its own feature, clearly apart
    // from the violet "How this was scored" provenance link.
    <button
      type="button"
      onClick={play}
      disabled={status === 'loading'}
      className="inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-xs font-semibold transition-colors hover:opacity-80 disabled:opacity-60 shrink-0"
      style={{
        color: WARN,
        borderColor: `color-mix(in oklch, ${WARN} 45%, transparent)`,
        background: `color-mix(in oklch, ${WARN} 12%, transparent)`,
      }}
      aria-label="Play the answer as speech"
    >
      {status === 'loading' ? (
        <span
          className="w-3 h-3 rounded-full border-[1.5px] border-t-transparent animate-spin"
          style={{ borderColor: WARN, borderTopColor: 'transparent' }}
        />
      ) : status === 'playing' ? (
        <Square size={12} strokeWidth={2.5} className="fill-current" />
      ) : (
        <Volume2 size={14} strokeWidth={2.2} />
      )}
      {label}
    </button>
  )
}

function DebriefError({
  info,
  elapsed,
  onRetry,
}: {
  info: { timeout: boolean; message: string }
  elapsed: number
  onRetry: () => void
}) {
  return (
    <div
      className="rounded-2xl border bg-card overflow-hidden"
      style={{ borderColor: `color-mix(in oklch, ${CRIT} 30%, var(--border))` }}
    >
      <div className="relative">
        <div className="absolute left-0 top-0 bottom-0 w-1" style={{ background: CRIT }} />
        <div className="pl-5 pr-5 py-5">
          <p className="text-xs uppercase tracking-widest mb-2" style={{ color: CRIT }}>
            {info.timeout ? 'Debrief timed out' : 'Debrief failed'}
          </p>
          <h3 className="text-base font-bold text-foreground leading-snug">
            {info.timeout ? 'The query didn’t return within the window.' : 'The query could not complete.'}
          </h3>
          <p className="text-sm text-muted-foreground leading-relaxed mt-2 max-w-[640px]">
            {info.timeout ? (
              <>
                Debrief runs a live analysis on AWS. The first request after idle can take a few seconds to
                warm up and approach the response window; subsequent requests are warm and return quickly.
                Try again.
              </>
            ) : (
              <>The request did not complete. The service may be warming up — try again in a moment.</>
            )}
          </p>
          <p className="text-xs text-muted-foreground/60 mt-2">
            elapsed {elapsed.toFixed(1)}s · {info.message}
          </p>
          <button
            type="button"
            onClick={onRetry}
            className="mt-4 h-9 px-4 inline-flex items-center rounded-lg text-sm font-semibold bg-primary text-primary-foreground hover:bg-primary/90 transition-colors"
          >
            Try again
          </button>
        </div>
      </div>
    </div>
  )
}
