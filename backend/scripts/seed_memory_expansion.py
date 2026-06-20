"""Expand organizational_memory from 5 to 15 historical incidents.

Standalone script — run locally, same connection pattern as
embed_memory.py. Inserts 10 new rows with embedding left NULL;
embed_memory.py (or its NULL-embedding pass) fills those in after.
Idempotent: skips insertion entirely if the table already has
15+ rows.
"""
import psycopg2

conn = psycopg2.connect(
    host='magnivonic-dev.cluster-ckh6ce2aesni.us-east-1.rds.amazonaws.com',
    port=5432, dbname='postgres', user='postgres',
    password='MagniVonic2026Test', sslmode='require'
)

NEW_INCIDENTS = [
    # SECURITY (4)
    {
        "summary": "Enterprise customer reported anomalous API key usage originating from an unrecognized geographic region, with call volume 40x above the account's normal baseline over a 3-hour window.",
        "outcome": "Key rotated within 20 minutes of detection. Forensic review confirmed no data exfiltration occurred. Customer security team was looped in proactively before they noticed anything themselves.",
        "lessons_learned": "Geographic anomaly detection should trigger automatic key rotation, not just an alert — minutes matter more than approval workflows in active compromise scenarios.",
        "prevented_churn": True, "revenue_saved": 310000,
        "contributing_agents": ["security"],
    },
    {
        "summary": "A mid-market account's data export volume spiked to 8GB in a single session, far exceeding their typical monthly total of 200MB, shortly after an employee's offboarding date had passed without access revocation.",
        "outcome": "Access was revoked immediately upon discovery. Export was traced to a departed employee's still-active session token. No external sharing was confirmed.",
        "lessons_learned": "Offboarding workflows must revoke API access automatically and immediately — manual revocation processes leave a dangerous window open.",
        "prevented_churn": True, "revenue_saved": 145000,
        "contributing_agents": ["security", "operations"],
    },
    {
        "summary": "Automated credential stuffing attack detected against the authentication endpoint, generating over 2,000 failed login attempts across 40 distinct IP addresses within 90 minutes, targeting three enterprise accounts specifically.",
        "outcome": "Rate limiting and IP-based blocking deployed within 30 minutes. No accounts were compromised. Affected customers were notified with a transparency report the same day.",
        "lessons_learned": "Targeted credential stuffing against named enterprise accounts (rather than random accounts) signals reconnaissance — this should escalate severity faster than generic attack patterns.",
        "prevented_churn": True, "revenue_saved": 0,
        "contributing_agents": ["security"],
    },
    {
        "summary": "A third-party integration vendor used by 6 of our enterprise customers disclosed a breach affecting their own systems, raising the possibility that customer data shared through that integration could be exposed.",
        "outcome": "All affected customers were contacted within 4 hours with a clear assessment of exposure. The integration was temporarily disabled pending the vendor's own remediation. Two customers paused the integration permanently; all six retained their core subscription.",
        "lessons_learned": "Third-party vendor risk needs the same incident response speed as a direct breach — customers do not distinguish between 'our fault' and 'our vendor's fault' when evaluating whether to trust us.",
        "prevented_churn": True, "revenue_saved": 580000,
        "contributing_agents": ["security", "customer"],
    },
    # CUSTOMER SUCCESS (3)
    {
        "summary": "The primary champion and economic buyer at a $380K ARR account left the company with no internal successor identified, and no replacement contact had engaged with the platform in the 30 days since their departure.",
        "outcome": "Customer Success proactively mapped the org chart and identified a new internal champion within two weeks, running a structured re-onboarding before the renewal conversation began.",
        "lessons_learned": "Champion departure should trigger an immediate re-engagement playbook, not wait for the renewal cycle to surface the risk naturally.",
        "prevented_churn": True, "revenue_saved": 380000,
        "contributing_agents": ["customer", "revenue"],
    },
    {
        "summary": "Support ticket backlog grew from a normal 15 open tickets to 95 open tickets over three weeks following a support team staffing shortage, with average response time increasing from 4 hours to 36 hours.",
        "outcome": "Temporary support reinforcement was brought in from an adjacent team. Backlog was cleared within 10 days. A proactive apology and service credit was offered to the most affected accounts.",
        "lessons_learned": "Support staffing risk should be monitored as an organizational health signal, not discovered only after ticket backlog has already damaged customer trust.",
        "prevented_churn": False, "revenue_saved": 0,
        "contributing_agents": ["customer", "operations"],
    },
    {
        "summary": "A new enterprise customer's onboarding stalled at the data-migration step for 6 weeks due to unclear technical requirements, with the customer's internal stakeholders growing visibly frustrated in weekly check-in calls.",
        "outcome": "A dedicated onboarding engineer was assigned and the migration was completed in an intensive two-week sprint. The account went live successfully, though the delayed time-to-value nearly triggered an early cancellation clause.",
        "lessons_learned": "Onboarding stalls beyond 3 weeks should automatically escalate to a dedicated technical resource rather than continuing through standard support channels.",
        "prevented_churn": True, "revenue_saved": 295000,
        "contributing_agents": ["customer", "operations"],
    },
    # REVENUE (3)
    {
        "summary": "A renewal in final negotiation stalled when the customer's procurement department introduced a new vendor approval process two weeks before the contract end date, creating risk of an operational gap if the process ran past the renewal deadline.",
        "outcome": "Account team negotiated a short-term extension to bridge the procurement gap, avoiding any service interruption. The renewal closed three weeks later at the original terms.",
        "lessons_learned": "Build bridge-extension clauses into contracts proactively for accounts with known complex procurement processes, rather than negotiating one reactively under time pressure.",
        "prevented_churn": True, "revenue_saved": 450000,
        "contributing_agents": ["revenue"],
    },
    {
        "summary": "A customer's annual budget freeze was announced company-wide due to their own financial quarter underperforming, placing a $290K renewal at risk of indefinite delay regardless of product satisfaction.",
        "outcome": "Renewal was restructured into a smaller initial commitment with an expansion option once the customer's budget freeze lifted, preserving the relationship through a difficult quarter for them.",
        "lessons_learned": "Budget-driven risk is not a product problem — offering flexible commercial structure preserves the relationship better than holding firm on original contract terms.",
        "prevented_churn": True, "revenue_saved": 290000,
        "contributing_agents": ["revenue", "customer"],
    },
    {
        "summary": "An enterprise account requested a downgrade from a 3-year contract to an annual term during renewal negotiations, citing internal uncertainty about long-term platform commitment despite continued day-to-day usage remaining stable.",
        "outcome": "Account executive proposed an annual term with built-in expansion incentives instead of resisting the downgrade outright, preserving the relationship at a lower initial value with a clear path back to multi-year commitment.",
        "lessons_learned": "Resisting a downgrade request outright often forces a full churn decision — accommodating it with a path back to expansion preserves more long-term revenue than holding firm.",
        "prevented_churn": True, "revenue_saved": 210000,
        "contributing_agents": ["revenue", "customer"],
    },
    # OPERATIONS (2)
    {
        "summary": "A feature deployment introduced a regression that silently corrupted exported report formatting for all customers using the CSV export feature, undetected by automated tests for 9 days.",
        "outcome": "Issue was identified through a customer support ticket rather than internal monitoring. Hotfix was deployed within 6 hours of identification. Affected customers were notified with an explanation and an apology.",
        "lessons_learned": "Export and reporting features need dedicated automated regression tests — they are easy to deprioritize in test coverage but highly visible to customers when broken.",
        "prevented_churn": False, "revenue_saved": 0,
        "contributing_agents": ["operations"],
    },
    {
        "summary": "A planned database migration intended to take 2 hours of maintenance window instead caused an 11-hour partial outage affecting write operations for the enterprise tier, due to an unanticipated index rebuild on a larger-than-expected table.",
        "outcome": "Migration was rolled back after hour 4 once the scale of the problem was clear. A revised migration plan with proper staging-environment data-volume testing was executed successfully two weeks later.",
        "lessons_learned": "Migration testing must use production-scale data volumes in staging — issues that only appear at scale will not surface in smaller test environments.",
        "prevented_churn": False, "revenue_saved": 0,
        "contributing_agents": ["operations", "security"],
    },
    # CROSS-DOMAIN (3) — highest-value memories
    {
        "summary": "A security vulnerability in the authentication layer delayed a planned feature rollout by three weeks while the engineering team prioritized the security patch, which in turn caused a support ticket surge from customers waiting on the delayed feature and ultimately put a $340K renewal at risk due to perceived lack of delivery commitment.",
        "outcome": "Security patch shipped first, as required. The delayed feature was fast-tracked immediately afterward with a dedicated sprint. Account team proactively explained the security-first prioritization to the at-risk renewal account, which renewed at full value once the feature shipped.",
        "lessons_learned": "When security work delays a customer-facing commitment, proactive transparent communication about *why* prevents the delay from being perceived as a reliability problem rather than a responsible engineering decision.",
        "prevented_churn": True, "revenue_saved": 340000,
        "contributing_agents": ["security", "operations", "customer", "revenue"],
    },
    {
        "summary": "An unplanned production outage caused by a failed feature rollout led to a spike in support tickets and a sharp customer health score decline for three enterprise accounts, two of which had renewals within 45 days, creating combined revenue exposure significantly larger than the direct cost of the outage itself.",
        "outcome": "Engineering completed the rollback within 3 hours. Customer Success ran proactive outreach to all three affected accounts within the same day, framing the incident transparently alongside the remediation timeline. Both renewals closed on schedule with no commercial concessions required.",
        "lessons_learned": "The combined revenue exposure of a technical incident should be calculated immediately based on which accounts are near renewal — this determines response urgency far more than the technical severity of the bug alone.",
        "prevented_churn": True, "revenue_saved": 875000,
        "contributing_agents": ["operations", "customer", "revenue"],
    },
    {
        "summary": "An engineering delivery delay on a contractually committed integration feature pushed a major enterprise expansion deal past its target close date, while simultaneously the same account's support ticket volume increased due to workarounds they implemented in the feature's absence.",
        "outcome": "Engineering provided a firm, credible revised delivery date backed by a working prototype demo. The expansion deal closed at a slightly reduced initial scope with the missing feature contractually guaranteed for the following quarter, preserving the relationship and the bulk of the deal value.",
        "lessons_learned": "A credible revised timeline backed by visible progress preserves an expansion deal far better than an optimistic timeline that risks being missed a second time.",
        "prevented_churn": True, "revenue_saved": 510000,
        "contributing_agents": ["operations", "revenue", "customer"],
    },
]


def main():
    cur = conn.cursor()
    cur.execute("SELECT COUNT(*) FROM organizational_memory")
    count = cur.fetchone()[0]
    print(f"Current row count: {count}")

    if count >= 15:
        print("✓ Already at 15+ rows — skipping insertion (idempotent).")
        conn.close()
        return

    for i, incident in enumerate(NEW_INCIDENTS):
        cur.execute("""
            INSERT INTO organizational_memory
              (summary, outcome, lessons_learned, prevented_churn,
               revenue_saved, contributing_agents, embedding)
            VALUES (%s, %s, %s, %s, %s, %s, NULL)
        """, (
            incident["summary"],
            incident["outcome"],
            incident["lessons_learned"],
            incident["prevented_churn"],
            incident["revenue_saved"],
            incident["contributing_agents"],
        ))
        conn.commit()
        print(f"✓ Inserted incident {i + 1}/10: {incident['summary'][:60]}...")

    cur.execute("SELECT COUNT(*) FROM organizational_memory")
    final_count = cur.fetchone()[0]
    print()
    print(f"✓ Final row count: {final_count}")

    conn.close()


if __name__ == '__main__':
    main()
