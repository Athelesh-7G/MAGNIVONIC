'use client'

import { useEffect, useRef } from 'react'

/**
 * SignalFlow — the authentic hero animation.
 * Many faint signal streams flow inward from the edges and converge into a
 * single bright core, then a pulse radiates back out. This is the literal
 * Magnivonic metaphor: fragmented departmental signals → one understanding.
 * Rendered on a dark cinematic banner in electric Magnivonic blue.
 */
export function SignalFlow({ variant = 'dark' }: { variant?: 'dark' | 'light' }) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const rafRef = useRef<number>(0)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches

    // Colour palette per surface. On a light field we use a deeper, more
    // saturated blue so the converging streams stay clearly visible on white.
    const C = variant === 'light'
      ? {
          coreInner: (a: number) => `rgba(38,86,230,${a})`,
          coreMid: 'rgba(48,96,235,0.10)',
          coreDot: 'rgba(30,72,210,0.92)',
          ring: (a: number) => `rgba(48,96,235,${a})`,
          tail: (a: number) => `rgba(52,104,238,${a})`,
          head: (a: number) => `rgba(34,78,216,${a})`,
        }
      : {
          coreInner: (a: number) => `rgba(70,120,255,${a})`,
          coreMid: 'rgba(60,100,255,0.12)',
          coreDot: 'rgba(190,215,255,0.85)',
          ring: (a: number) => `rgba(80,130,255,${a})`,
          tail: (a: number) => `rgba(120,170,255,${a})`,
          head: (a: number) => `rgba(180,205,255,${a})`,
        }

    let width = 0
    let height = 0
    let cx = 0
    let cy = 0
    let dpr = Math.min(window.devicePixelRatio || 1, 2)

    function resize() {
      const rect = canvas.getBoundingClientRect()
      width = rect.width
      height = rect.height
      cx = width / 2
      cy = height / 2
      dpr = Math.min(window.devicePixelRatio || 1, 2)
      canvas.width = width * dpr
      canvas.height = height * dpr
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    }
    resize()
    window.addEventListener('resize', resize)

    // Signal particles travelling along curved paths toward the core
    type Particle = {
      angle: number      // entry angle around the core
      radius: number     // current distance from core
      maxRadius: number  // spawn distance
      speed: number
      curve: number      // lateral curve amount
      size: number
      alpha: number
    }

    const COUNT = reduce ? 0 : variant === 'light' ? 120 : 90
    const particles: Particle[] = []

    function spawn(): Particle {
      const maxRadius = Math.max(width, height) * (0.45 + Math.random() * 0.25)
      return {
        angle: Math.random() * Math.PI * 2,
        radius: maxRadius,
        maxRadius,
        speed: 0.6 + Math.random() * 1.4,
        curve: (Math.random() - 0.5) * 0.0016,
        size: 0.6 + Math.random() * 1.6,
        alpha: 0,
      }
    }
    for (let i = 0; i < COUNT; i++) {
      const p = spawn()
      p.radius = Math.random() * p.maxRadius
      particles.push(p)
    }

    let t = 0

    function draw() {
      t += 1
      ctx.clearRect(0, 0, width, height)

      // Core glow — breathing
      const pulse = 0.5 + 0.5 * Math.sin(t * 0.02)
      const coreR = 26 + pulse * 10
      const coreGrad = ctx.createRadialGradient(cx, cy, 0, cx, cy, coreR * 4)
      coreGrad.addColorStop(0, C.coreInner(0.55 + pulse * 0.25))
      coreGrad.addColorStop(0.4, C.coreMid)
      coreGrad.addColorStop(1, 'rgba(60,100,255,0)')
      ctx.fillStyle = coreGrad
      ctx.beginPath()
      ctx.arc(cx, cy, coreR * 4, 0, Math.PI * 2)
      ctx.fill()

      // Bright core dot
      ctx.fillStyle = C.coreDot
      ctx.beginPath()
      ctx.arc(cx, cy, 3 + pulse * 1.5, 0, Math.PI * 2)
      ctx.fill()

      // Expanding ring pulses radiating outward
      for (let k = 0; k < 3; k++) {
        const ringT = ((t * 0.6 + k * 90) % 270) / 270
        const ringR = ringT * Math.max(width, height) * 0.5
        ctx.strokeStyle = C.ring((1 - ringT) * (variant === 'light' ? 0.16 : 0.12))
        ctx.lineWidth = 1
        ctx.beginPath()
        ctx.arc(cx, cy, ringR, 0, Math.PI * 2)
        ctx.stroke()
      }

      for (const p of particles) {
        // Move inward
        p.radius -= p.speed
        p.angle += p.curve * p.radius

        // Fade in as it appears, fade out near the core
        const lifeIn = Math.min(1, (p.maxRadius - p.radius) / 60)
        const lifeOut = Math.min(1, p.radius / 80)
        p.alpha = lifeIn * lifeOut

        const x = cx + Math.cos(p.angle) * p.radius
        const y = cy + Math.sin(p.angle) * p.radius

        // Trailing tail toward the core
        const tailLen = 14 + p.speed * 8
        const tx = cx + Math.cos(p.angle) * (p.radius + tailLen)
        const ty = cy + Math.sin(p.angle) * (p.radius + tailLen)

        const grad = ctx.createLinearGradient(tx, ty, x, y)
        grad.addColorStop(0, 'rgba(80,130,255,0)')
        grad.addColorStop(1, C.tail(p.alpha * (variant === 'light' ? 0.95 : 0.9)))
        ctx.strokeStyle = grad
        ctx.lineWidth = p.size
        ctx.beginPath()
        ctx.moveTo(tx, ty)
        ctx.lineTo(x, y)
        ctx.stroke()

        // Head dot
        ctx.fillStyle = C.head(p.alpha)
        ctx.beginPath()
        ctx.arc(x, y, p.size * 0.8, 0, Math.PI * 2)
        ctx.fill()

        // Respawn when it reaches the core
        if (p.radius < 2) Object.assign(p, spawn())
      }

      rafRef.current = requestAnimationFrame(draw)
    }

    if (reduce) {
      // Static frame for reduced motion
      const grad = ctx.createRadialGradient(cx, cy, 0, cx, cy, 120)
      grad.addColorStop(0, 'rgba(70,120,255,0.5)')
      grad.addColorStop(1, 'rgba(60,100,255,0)')
      ctx.fillStyle = grad
      ctx.fillRect(0, 0, width, height)
    } else {
      draw()
    }

    return () => {
      cancelAnimationFrame(rafRef.current)
      window.removeEventListener('resize', resize)
    }
  }, [variant])

  return (
    <canvas
      ref={canvasRef}
      className="absolute inset-0 w-full h-full"
      aria-hidden="true"
    />
  )
}
