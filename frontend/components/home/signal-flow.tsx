'use client'

import { useEffect, useRef } from 'react'

/**
 * SignalFlow — the hero animation: "Noise → Clarity".
 *
 * A dense field of chaotic, scattered signal marks (the raw, fragmented
 * organization — thousands of signals no one can read) eases into a calm,
 * ordered lattice of aligned ticks (one clear, legible picture). Rendered in
 * three parallax depth layers that respond to the mouse, so the field reads as
 * something you look *into*. At peak resolve a single crisp line forms across
 * the centre — many signals becoming one understanding — then relaxes into a
 * gently breathing, occasionally pulse-swept calm.
 *
 * Deliberately NOT the in-product node-cascade: this is about resolution and
 * depth (a promise), not connection (which the live platform fulfils).
 */
export function SignalFlow({ variant = 'dark' }: { variant?: 'dark' | 'light' }) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const rafRef = useRef<number>(0)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const context = canvas.getContext('2d')
    if (!context) return
    // Local non-null bindings so the nested closures are type-safe (fixes the
    // prior "possibly null" errors) and slightly faster.
    const cv = canvas
    const c = context

    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches

    // Violet palette per surface (deeper on white, lighter on dark).
    const P =
      variant === 'light'
        ? {
            mark: (a: number) => `rgba(124,58,237,${a})`,
            markBright: (a: number) => `rgba(109,40,217,${a})`,
            glow: (a: number) => `rgba(139,92,246,${a})`,
            line: (a: number) => `rgba(124,58,237,${a})`,
          }
        : {
            mark: (a: number) => `rgba(167,139,250,${a})`,
            markBright: (a: number) => `rgba(221,214,254,${a})`,
            glow: (a: number) => `rgba(139,92,246,${a})`,
            line: (a: number) => `rgba(196,181,253,${a})`,
          }

    let width = 0
    let height = 0
    let cx = 0
    let cy = 0
    let dpr = Math.min(window.devicePixelRatio || 1, 2)

    // ── Marks ────────────────────────────────────────────────────────────────
    type Mark = {
      x0: number // chaotic start
      y0: number
      a0: number // chaotic angle
      tx: number // ordered target (lattice)
      ty: number
      len: number
      lw: number
      baseAlpha: number
      px: number // parallax factor (depth)
      delay: number // 0..STAGGER — left→right cascade
      phase: number // breathing phase
    }

    // Three depth layers: far (dense, tiny, faint, low parallax) → near (sparse,
    // large, bright, high parallax).
    const LAYERS = [
      { sx: 34, sy: 30, len: 5, lw: 0.9, alpha: 0.22, px: 3 },
      { sx: 52, sy: 44, len: 9, lw: 1.2, alpha: 0.5, px: 9 },
      { sx: 86, sy: 70, len: 15, lw: 1.7, alpha: 0.85, px: 19 },
    ]

    const STAGGER = 0.35
    const RESOLVE_FRAMES = 150 // ~2.5s @ 60fps
    let marks: Mark[] = []

    function buildMarks() {
      marks = []
      const marginX = width * 0.06
      const usableW = width - marginX * 2
      const top = height * 0.16
      const usableH = height * 0.68
      for (const L of LAYERS) {
        const cols = Math.max(3, Math.floor(usableW / L.sx))
        const rows = Math.max(2, Math.floor(usableH / L.sy))
        const gapX = usableW / (cols - 1 || 1)
        const gapY = usableH / (rows - 1 || 1)
        for (let r = 0; r < rows; r++) {
          for (let col = 0; col < cols; col++) {
            const tx = marginX + col * gapX + (Math.random() - 0.5) * 4
            const ty = top + r * gapY + (Math.random() - 0.5) * 4
            marks.push({
              x0: -width * 0.1 + Math.random() * width * 1.2,
              y0: -height * 0.1 + Math.random() * height * 1.2,
              a0: Math.random() * Math.PI * 2,
              tx,
              ty,
              len: L.len * (0.8 + Math.random() * 0.5),
              lw: L.lw,
              baseAlpha: L.alpha * (0.7 + Math.random() * 0.5),
              px: L.px,
              delay: (tx - marginX) / (usableW || 1) * STAGGER, // cascade L→R
              phase: Math.random() * Math.PI * 2,
            })
          }
        }
      }
    }

    function resize() {
      const rect = cv.getBoundingClientRect()
      width = rect.width
      height = rect.height
      cx = width / 2
      cy = height / 2
      dpr = Math.min(window.devicePixelRatio || 1, 2)
      cv.width = width * dpr
      cv.height = height * dpr
      c.setTransform(dpr, 0, 0, dpr, 0, 0)
      buildMarks()
    }
    resize()
    window.addEventListener('resize', resize)

    // ── Mouse parallax (look *into* the field) ───────────────────────────────
    let targetMX = 0
    let targetMY = 0
    let mx = 0
    let my = 0
    function onMove(e: MouseEvent) {
      const rect = cv.getBoundingClientRect()
      targetMX = (e.clientX - rect.left - cx) / cx // -1..1
      targetMY = (e.clientY - rect.top - cy) / cy
    }
    window.addEventListener('mousemove', onMove)

    // Spring-ish easing with a touch of overshoot (the "settle").
    const easeOutBack = (x: number) => {
      const c1 = 1.70158
      const c3 = c1 + 1
      return 1 + c3 * Math.pow(x - 1, 3) + c1 * Math.pow(x - 1, 2)
    }
    const easeOutCubic = (x: number) => 1 - Math.pow(1 - x, 3)
    const lerp = (a: number, b: number, t: number) => a + (b - a) * t

    let frame = 0

    function renderMarks(settleAmt: number) {
      // settleAmt: 0 = chaos, 1 = fully ordered. Per-mark staggered.
      const rawT = frame / RESOLVE_FRAMES
      // Smooth the mouse toward target — responsive enough that the "glance"
      // tracking reads as live, still eased (not jumpy).
      mx += (targetMX - mx) * 0.12
      my += (targetMY - my) * 0.12

      // Pulse sweep (after settle): a soft band travelling across the lattice.
      const sweepX = settleAmt >= 1 ? ((frame * 2.2) % (width + 240)) - 120 : -9999

      // Uniform breathing: the WHOLE settled lattice rises and falls together as
      // one cohesive body — clearly perceptible at a glance (~3.5s period), calm.
      const breathY = settleAmt >= 1 ? Math.sin(frame * 0.03) * 5 : 0

      for (const m of marks) {
        const local = settleAmt >= 1 ? 1 : Math.max(0, Math.min(1, rawT - m.delay))
        const e = local <= 0 ? 0 : local >= 1 ? 1 : easeOutBack(local)

        let x = lerp(m.x0, m.tx, e)
        let y = lerp(m.y0, m.ty, e)
        const angle = lerp(m.a0, 0, Math.min(1, e)) // chaotic → horizontal

        // Depth parallax + gentle breathing once settled.
        x += mx * m.px
        y += my * m.px
        y += breathY // whole field moves as one

        // Alpha: faint while scattered, full once ordered.
        let alpha = m.baseAlpha * (0.35 + 0.65 * Math.min(1, e))

        // Pulse-sweep brightening.
        let bright = false
        if (sweepX > -1000) {
          const d = Math.abs(x - sweepX)
          if (d < 90) {
            alpha = Math.min(1, alpha + (1 - d / 90) * 0.5)
            bright = d < 36
          }
        }

        c.save()
        c.translate(x, y)
        c.rotate(angle)
        c.strokeStyle = bright ? P.markBright(alpha) : P.mark(alpha)
        c.lineWidth = m.lw
        c.lineCap = 'round'
        c.beginPath()
        c.moveTo(-m.len / 2, 0)
        c.lineTo(m.len / 2, 0)
        c.stroke()
        c.restore()
      }
    }

    function draw() {
      frame += 1
      c.clearRect(0, 0, width, height)

      const rawT = frame / RESOLVE_FRAMES
      const settleAmt = rawT >= 1 + STAGGER ? 1 : 0

      // Soft violet glow behind, brightening as order forms.
      const order = Math.min(1, rawT / (1 + STAGGER))
      const g = c.createRadialGradient(cx, cy, 0, cx, cy, Math.max(width, height) * 0.55)
      g.addColorStop(0, P.glow((variant === 'light' ? 0.05 : 0.08) * (0.4 + 0.6 * order)))
      g.addColorStop(1, 'rgba(139,92,246,0)')
      c.fillStyle = g
      c.fillRect(0, 0, width, height)

      renderMarks(settleAmt)

      // ── Flourish: a crisp line forms across the centre at peak resolve, then
      //    relaxes as the lattice begins to breathe. (many signals → one.)
      const lineStart = 1.0
      const lineDur = 0.95 // in rawT units
      if (rawT >= lineStart) {
        const lt = Math.min(1, (rawT - lineStart) / lineDur)
        const grow = easeOutCubic(Math.min(1, lt / 0.4)) // expand outward first
        const opacity = Math.sin(Math.PI * lt) // fade in then out
        const half = grow * width * 0.34
        if (opacity > 0.001) {
          const lg = c.createLinearGradient(cx - half, cy, cx + half, cy)
          lg.addColorStop(0, P.line(0))
          lg.addColorStop(0.5, P.line(opacity * (variant === 'light' ? 0.85 : 0.95)))
          lg.addColorStop(1, P.line(0))
          c.strokeStyle = lg
          c.lineWidth = 1.4
          c.beginPath()
          c.moveTo(cx - half, cy)
          c.lineTo(cx + half, cy)
          c.stroke()
          // bright centre node on the line
          c.fillStyle = P.markBright(opacity * 0.9)
          c.beginPath()
          c.arc(cx, cy, 2.4, 0, Math.PI * 2)
          c.fill()
        }
      }

      rafRef.current = requestAnimationFrame(draw)
    }

    if (reduce) {
      // Static settled lattice (no chaos animation).
      frame = (1 + STAGGER) * RESOLVE_FRAMES
      c.clearRect(0, 0, width, height)
      renderMarks(1)
    } else {
      draw()
    }

    return () => {
      cancelAnimationFrame(rafRef.current)
      window.removeEventListener('resize', resize)
      window.removeEventListener('mousemove', onMove)
    }
  }, [variant])

  return <canvas ref={canvasRef} className="absolute inset-0 w-full h-full" aria-hidden="true" />
}
