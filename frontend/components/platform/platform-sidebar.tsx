'use client'

import { useEffect, useState, type ElementType } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { motion } from 'framer-motion'
import {
  LayoutDashboard,
  ScrollText,
  MessageSquareText,
  Cpu,
  Brain,
  FolderOpen,
  Radio,
  DollarSign,
  ShieldCheck,
  GitBranch,
  Users,
  Cable,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react'
import { cn } from '@/lib/utils'

type NavItem = { label: string; href: string; icon: ElementType }
type NavSection = { title: string; items: NavItem[] }

// The nav groups ARE the narrative spine, top-down: Executive Intelligence →
// Department Intelligence → Specialized Agents → Signals. The pipeline is felt
// structurally (the way Veloquity's rail reads Data Ingestion → Evidence →
// Decision → Intelligence Engine), not just stated once.
const NAV_SECTIONS: NavSection[] = [
  {
    title: 'Executive Intelligence',
    items: [
      { label: 'Intervention Canvas', href: '/platform', icon: LayoutDashboard },
      { label: 'Debrief', href: '/platform/debrief', icon: MessageSquareText },
    ],
  },
  {
    title: 'Department Intelligence',
    items: [
      { label: 'Revenue', href: '/platform/teams/revenue', icon: DollarSign },
      { label: 'Security', href: '/platform/teams/security', icon: ShieldCheck },
      { label: 'Operations', href: '/platform/teams/operations', icon: GitBranch },
      { label: 'Customer', href: '/platform/teams/customer', icon: Users },
    ],
  },
  {
    title: 'Specialized Agents',
    items: [
      { label: 'Engine Room', href: '/platform/engine', icon: Cpu },
      { label: 'Organizational Memory', href: '/platform/memory', icon: Brain },
      { label: 'Connections', href: '/platform/connections', icon: Cable },
    ],
  },
  {
    title: 'The Record',
    items: [
      { label: 'Executive Briefs', href: '/platform/briefs', icon: ScrollText },
      { label: 'Dossiers', href: '/platform/dossiers', icon: FolderOpen },
      { label: 'The Wire', href: '/platform/wire', icon: Radio },
    ],
  },
]

const COLLAPSE_KEY = 'magnivonic_sidebar_collapsed'

export function PlatformSidebar() {
  const pathname = usePathname()
  const [collapsed, setCollapsed] = useState(false)

  // SSR-safe: read persisted state on mount (first paint stays expanded).
  useEffect(() => {
    try {
      setCollapsed(localStorage.getItem(COLLAPSE_KEY) === 'true')
    } catch {
      /* no-op */
    }
  }, [])

  const toggle = () => {
    setCollapsed((c) => {
      const next = !c
      try {
        localStorage.setItem(COLLAPSE_KEY, next ? 'true' : 'false')
      } catch {
        /* no-op */
      }
      return next
    })
  }

  return (
    <motion.aside
      initial={false}
      animate={{ width: collapsed ? 64 : 240 }}
      transition={{ duration: 0.2 }}
      className="shrink-0 border-r border-border bg-card flex flex-col h-[calc(100vh-64px)] sticky top-16 overflow-hidden"
    >
      <nav className="flex-1 overflow-y-auto overflow-x-hidden py-4 px-2">
        {NAV_SECTIONS.map((section) => (
          <div key={section.title} className="mb-5">
            {!collapsed ? (
              <p className="px-3 py-1.5 text-xs font-medium text-muted-foreground truncate">{section.title}</p>
            ) : (
              <div className="mx-3 my-1.5 h-px bg-border/60" aria-hidden />
            )}
            <div className="space-y-0.5">
              {section.items.map((item) => {
                const active = pathname === item.href
                const Icon = item.icon
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    title={collapsed ? item.label : undefined}
                    className={cn(
                      'group relative flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors',
                      collapsed && 'justify-center',
                      active
                        ? 'bg-primary/10 text-foreground'
                        : 'text-muted-foreground hover:text-foreground hover:bg-accent',
                    )}
                  >
                    {active && (
                      <motion.div
                        layoutId="activeIndicator"
                        className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-6 bg-primary rounded-full"
                        transition={{ type: 'spring', stiffness: 380, damping: 32 }}
                      />
                    )}
                    <Icon className={cn('w-4 h-4 shrink-0', active && 'text-primary')} strokeWidth={2} />
                    {!collapsed && <span className="flex-1 truncate">{item.label}</span>}

                    {/* Hover tooltip when collapsed — Veloquity's collapsed-rail pattern */}
                    {collapsed && (
                      <span className="absolute left-full ml-2 px-2 py-1 rounded-md bg-popover text-popover-foreground text-sm shadow-lg whitespace-nowrap opacity-0 pointer-events-none group-hover:opacity-100 transition-opacity z-50">
                        {item.label}
                      </span>
                    )}
                  </Link>
                )
              })}
            </div>
          </div>
        ))}
      </nav>

      {/* Footer: live status */}
      <div className={cn('border-t border-border py-3', collapsed ? 'px-0 flex justify-center' : 'px-4')}>
        <span className="flex items-center gap-1.5 text-xs uppercase tracking-wider text-muted-foreground">
          <span
            className="w-1.5 h-1.5 rounded-full animate-pulse-dot shrink-0"
            style={{ background: 'oklch(0.723 0.192 149.6)' }}
          />
          {!collapsed && <span>Live · AWS</span>}
        </span>
      </div>

      {/* Collapse toggle */}
      <div className="border-t border-border p-2">
        <button
          type="button"
          onClick={toggle}
          aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          className="w-full flex items-center justify-center gap-2 px-3 py-2 rounded-lg text-sm text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
        >
          {collapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
          {!collapsed && <span>Collapse</span>}
        </button>
      </div>
    </motion.aside>
  )
}
