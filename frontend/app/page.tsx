import { Nav }         from '@/components/nav'
import { Hero }        from '@/components/home/hero'
import { Mechanism }   from '@/components/home/mechanism'
import { HowItWorks }  from '@/components/home/how-it-works'
import { Proof }       from '@/components/home/proof'
import { Comparison }  from '@/components/home/comparison'
import { InfraStrip }  from '@/components/home/infra-strip'
import { OrgMemory }   from '@/components/home/org-memory'
import { SiteFooter }  from '@/components/home/site-footer'

export default function HomePage() {
  return (
    <>
      <Nav />
      <main>
        <Hero />
        <Mechanism />
        <HowItWorks />
        <Proof />
        <Comparison />
        <InfraStrip />
        <OrgMemory />
      </main>
      <SiteFooter />
    </>
  )
}
