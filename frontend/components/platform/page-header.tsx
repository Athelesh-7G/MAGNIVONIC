import type { ReactNode } from 'react'

interface PageHeaderProps {
  eyebrow: string
  title: string
  subtitle?: string
  action?: ReactNode
}

export function PageHeader({ eyebrow, title, subtitle, action }: PageHeaderProps) {
  return (
    <div className="flex items-start justify-between gap-6 border-b border-border pb-6">
      <div>
        {/* Eyebrow = the page's position on the narrative spine (Signals →
            Specialized Agents → Department Intelligence → Executive
            Intelligence → Organizational Decision Layer). Calm sans label,
            not a mono marketing flourish. */}
        <p className="text-xs uppercase tracking-widest font-medium text-primary/80 mb-2">{eyebrow}</p>
        <h1 className="text-2xl font-bold tracking-tight text-foreground">{title}</h1>
        {subtitle ? (
          <p className="mt-1 text-sm text-muted-foreground leading-relaxed max-w-[640px]">{subtitle}</p>
        ) : null}
      </div>
      {action ? <div className="shrink-0 pt-1">{action}</div> : null}
    </div>
  )
}
