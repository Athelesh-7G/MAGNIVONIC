import type { Metadata, Viewport } from 'next'
import { Hanken_Grotesk, JetBrains_Mono } from 'next/font/google'
import { Providers } from '@/components/providers'
import './globals.css'

const hanken = Hanken_Grotesk({
  variable: '--font-sans',
  subsets: ['latin'],
  display: 'swap',
  weight: ['400', '500', '600', '700', '800', '900'],
})

const jetbrainsMono = JetBrains_Mono({
  variable: '--font-mono',
  subsets: ['latin'],
  display: 'swap',
  weight: ['400', '500'],
})

export const metadata: Metadata = {
  title: 'Magnivonic — The Multi-Agent Operating System for the Enterprise',
  description:
    'Six specialized AI agents working as one system. Revenue, Security, Customer Success, and Operations — continuously reading, coordinating, and acting as a single organizational intelligence.',
  generator: 'v0.dev',
  openGraph: {
    title: 'Magnivonic — Multi-Agent Operating System',
    description:
      'Six specialized AI agents working as one system inside your organization.',
    type: 'website',
  },
}

export const viewport: Viewport = {
  colorScheme: 'light dark',
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#fcfcfd' },
    { media: '(prefers-color-scheme: dark)',  color: '#060912' },
  ],
}

// Light is always the default. Dark only if the user has explicitly toggled it.
const themeScript = `
(function(){
  try {
    var stored = localStorage.getItem('magnivonic-theme');
    if (stored === 'dark') document.documentElement.classList.add('dark');
  } catch(e) {}
})();
`

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${hanken.variable} ${jetbrainsMono.variable}`} suppressHydrationWarning>
      <head>
        {/* Blocking theme script — runs before first paint, eliminates flash */}
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body className="font-sans antialiased bg-background text-foreground">
        <Providers>{children}</Providers>
      </body>
    </html>
  )
}
