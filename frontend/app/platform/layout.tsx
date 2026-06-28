import { PlatformSidebar } from '@/components/platform/platform-sidebar'
import { PlatformTopbar } from '@/components/platform/platform-topbar'

export const metadata = {
  title: 'Platform — Magnivonic',
  description:
    'The live organizational intelligence desk — synthesized cross-domain executive briefs, running on AWS against real data.',
}

export default function PlatformLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="platform-scope min-h-screen flex flex-col bg-background text-foreground">
      <PlatformTopbar />
      <div className="flex flex-1 min-h-0">
        <PlatformSidebar />
        <main className="flex-1 min-w-0 overflow-y-auto">{children}</main>
      </div>
    </div>
  )
}
