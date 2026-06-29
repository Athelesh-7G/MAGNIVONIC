'use client'

import { SWRConfig } from 'swr'
import { createContext, useContext, useEffect, useState } from 'react'

type Theme = 'light' | 'dark'

interface ThemeCtxType {
  theme: Theme
  toggle: () => void
}

const ThemeCtx = createContext<ThemeCtxType>({ theme: 'light', toggle: () => {} })

export function useTheme() {
  return useContext(ThemeCtx)
}

function ThemeProvider({ children }: { children: React.ReactNode }) {
  // Read the class the blocking layout script already set (dark by default), so
  // the toggle icon is correct on first paint with no flash. SSR → 'dark'.
  const [theme, setTheme] = useState<Theme>(() =>
    typeof document !== 'undefined' && !document.documentElement.classList.contains('dark')
      ? 'light'
      : 'dark',
  )

  useEffect(() => {
    // Dark is the default — light only if explicitly stored.
    const stored = localStorage.getItem('magnivonic-theme') as Theme | null
    const initial: Theme = stored === 'light' ? 'light' : 'dark'
    setTheme(initial)
    document.documentElement.classList.toggle('dark', initial === 'dark')
  }, [])

  const toggle = () => {
    setTheme(prev => {
      const next = prev === 'light' ? 'dark' : 'light'
      document.documentElement.classList.toggle('dark', next === 'dark')
      localStorage.setItem('magnivonic-theme', next)
      return next
    })
  }

  return <ThemeCtx.Provider value={{ theme, toggle }}>{children}</ThemeCtx.Provider>
}

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <ThemeProvider>
      <SWRConfig value={{ revalidateOnFocus: false, shouldRetryOnError: false }}>
        {children}
      </SWRConfig>
    </ThemeProvider>
  )
}
