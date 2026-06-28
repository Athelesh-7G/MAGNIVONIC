'use client'

import { PageHeader } from '@/components/platform/page-header'
import { DebriefChat } from '@/components/platform/debrief-chat'
import { AtRest } from '@/components/platform/at-rest'
import { useActivation } from '@/lib/activation'

export default function DebriefPage() {
  const { activated } = useActivation()

  if (!activated) {
    return <AtRest eyebrow="Executive Intelligence" title="Debrief" surface="The debrief desk" />
  }

  return (
    <div className="max-w-[1100px] mx-auto px-8 py-8">
      <PageHeader
        eyebrow="Executive Intelligence"
        title="Debrief"
        subtitle="Ask in plain language. The engine searches the organization's real history, answers from what it finds, and shows you the evidence behind every claim — never a conclusion without its citations."
      />

      <div className="mt-6">
        <DebriefChat />
      </div>
    </div>
  )
}
