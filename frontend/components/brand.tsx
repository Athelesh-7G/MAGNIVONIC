/**
 * Magnivonic brand marks.
 *
 * MagnivonicMark   — the icon-only monogram, hand-traced as a faithful vector
 *                    from the real logo (all straight edges). Uses currentColor,
 *                    so it themes automatically (collapsed sidebar, etc.).
 * MagnivonicLockup — the full mark + wordmark, from the real source images with
 *                    backgrounds removed: black version on light surfaces, white
 *                    version on dark (theme-swapped). Used in the main nav,
 *                    footer, login, and the platform topbar.
 */

// Vector traced from the real mark (viewBox 284×252). Five filled polygons; the
// negative space between them is the interlocking M/V the original logo uses.
const MARK_PATHS = [
  'M 6 22 L 56 22 L 79 40 L 132 84 L 108 104 L 7 22 Z',
  'M 227 22 L 277 22 L 141 133 L 141 170 L 114 148 L 114 112 L 227 23 Z',
  'M 0 31 L 104 115 L 104 140 L 51 97 L 52 251 L 1 251 L 0 32 Z',
  'M 282 31 L 282 251 L 231 251 L 232 97 L 226 100 L 151 162 L 151 138 L 155 134 L 282 32 Z',
  'M 74 129 L 140 183 L 147 180 L 209 129 L 209 171 L 143 225 L 140 225 L 74 171 L 74 130 Z',
]

/** Icon-only mark. `size` is the rendered height in px (width follows the ratio). */
export function MagnivonicMark({ size = 24, className }: { size?: number; className?: string }) {
  return (
    <svg
      width={Math.round(size * (284 / 252))}
      height={size}
      viewBox="0 0 284 252"
      fill="currentColor"
      aria-hidden="true"
      className={className}
    >
      {MARK_PATHS.map((d, i) => (
        <path key={i} d={d} />
      ))}
    </svg>
  )
}

/** Full lockup (mark + wordmark). `height` in px; theme-swapped black/white. */
export function MagnivonicLockup({ height = 30, className }: { height?: number; className?: string }) {
  // Source lockup PNGs are ~609×369 (transparent). width auto via aspect ratio.
  const common = 'w-auto select-none'
  const style = { height }
  return (
    <span className={`inline-flex items-center ${className ?? ''}`}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src="/logo-magnivonic-black.png"
        alt="Magnivonic"
        style={style}
        className={`${common} block dark:hidden`}
      />
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src="/logo-magnivonic-white.png"
        alt="Magnivonic"
        style={style}
        className={`${common} hidden dark:block`}
        aria-hidden="true"
      />
    </span>
  )
}
