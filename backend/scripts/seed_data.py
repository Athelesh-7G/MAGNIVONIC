# Seeds Vantage Retail Group cascade demo data
"""
Magnivonic demo data seeder.

Reads Aurora credentials from the MAGNIVONIC_AURORA_SECRET env var,
which contains the magnivonic/aurora secret value as a JSON string:
  {"host":..., "port":..., "dbname":..., "username":..., "password":...}

Idempotent: checks existence before every insert (SELECT COUNT pattern)
because several tables lack a unique constraint suitable for ON CONFLICT.

Usage:
  MAGNIVONIC_AURORA_SECRET='{"host":"...","port":"5432",...}' \\
    python3 backend/scripts/seed_data.py
"""

import json
import os
import sys
from datetime import date, timedelta

try:
    import psycopg2
except ImportError:
    print("ERROR: psycopg2 not installed. Run: pip3 install psycopg2-binary")
    sys.exit(1)


def _load_secret() -> dict:
    """Load the Aurora secret JSON from env, with a local .env fallback."""
    raw = os.environ.get("MAGNIVONIC_AURORA_SECRET")

    if not raw:
        # Fallback: try to read MAGNIVONIC_AURORA_SECRET from a local .env file
        env_path = os.path.join(os.path.dirname(__file__), "..", "..", ".env")
        if os.path.exists(env_path):
            with open(env_path) as f:
                for line in f:
                    line = line.strip()
                    if line.startswith("MAGNIVONIC_AURORA_SECRET="):
                        raw = line.split("=", 1)[1].strip().strip("'").strip('"')
                        break

    if not raw:
        print(
            "ERROR: MAGNIVONIC_AURORA_SECRET env var is not set.\n"
            "Set it to the magnivonic/aurora secret JSON, e.g.:\n"
            "  MAGNIVONIC_AURORA_SECRET='{\"host\":\"...\",\"port\":\"5432\","
            "\"dbname\":\"postgres\",\"username\":\"postgres\","
            "\"password\":\"...\"}' python3 backend/scripts/seed_data.py"
        )
        sys.exit(1)

    try:
        return json.loads(raw)
    except json.JSONDecodeError as e:
        print(f"ERROR: MAGNIVONIC_AURORA_SECRET is not valid JSON: {e}")
        sys.exit(1)


def _connect(secret: dict):
    return psycopg2.connect(
        host=secret["host"],
        port=int(secret["port"]),
        dbname=secret["dbname"],
        user=secret["username"],
        password=secret["password"],
        sslmode="require",
        connect_timeout=10,
    )


def seed(conn):
    cur = conn.cursor()
    today = date.today()

    # ---- Organization -------------------------------------------------
    print("Seeding organizations...")
    cur.execute(
        "SELECT id FROM organizations WHERE name = %s", ("TechVentures Inc",)
    )
    row = cur.fetchone()
    if row:
        org_id = row[0]
    else:
        cur.execute(
            """
            INSERT INTO organizations
                (name, industry, employee_count, annual_revenue)
            VALUES (%s, %s, %s, %s)
            RETURNING id
            """,
            ("TechVentures Inc", "SaaS Technology", 340, 12000000),
        )
        org_id = cur.fetchone()[0]

    # ---- Customers ----------------------------------------------------
    print("Seeding customers...")
    customers = [
        # (name, arr, renewal_offset_days, health, tier, stage)
        ("Vantage Retail Group", 500000, 28, 43, "enterprise", "at_risk"),
        ("TechFlow Solutions", 420000, 35, 51, "enterprise", "at_risk"),
        ("Meridian Corp", 490000, 42, 58, "growth", "at_risk"),
        # Healthy/expansion account — seeded so Opportunity is genuinely
        # classifiable from real agent-read data, not fabricated.
        ("Continental Logistics", 320000, 75, 88, "growth", "active"),
    ]
    customer_ids = {}
    for name, arr, offset, health, tier, stage in customers:
        cur.execute(
            "SELECT id FROM customers WHERE name = %s AND org_id = %s",
            (name, org_id),
        )
        row = cur.fetchone()
        if row:
            customer_ids[name] = row[0]
            continue
        cur.execute(
            """
            INSERT INTO customers
                (org_id, name, arr, renewal_date, health_score,
                 cs_tier, account_stage)
            VALUES (%s, %s, %s, %s, %s, %s, %s)
            RETURNING id
            """,
            (org_id, name, arr, today + timedelta(days=offset),
             health, tier, stage),
        )
        customer_ids[name] = cur.fetchone()[0]

    # ---- Pipeline deals (1 per customer) ------------------------------
    print("Seeding pipeline_deals...")
    deals = [
        ("Vantage Retail Group", "Vantage Enterprise Renewal Q3", "renewal", 500000, 0.35, 28),
        ("TechFlow Solutions", "TechFlow Platform Expansion", "renewal", 420000, 0.45, 35),
        ("Meridian Corp", "Meridian Growth Renewal", "renewal", 490000, 0.52, 42),
        # Near-certain expansion deal, not a renewal — the real upside signal.
        ("Continental Logistics", "Continental Platform Expansion", "expansion", 180000, 0.82, 30),
    ]
    for cname, deal_name, stage, value, prob, offset in deals:
        cid = customer_ids[cname]
        cur.execute(
            "SELECT 1 FROM pipeline_deals WHERE customer_id = %s", (cid,)
        )
        if cur.fetchone():
            continue
        cur.execute(
            """
            INSERT INTO pipeline_deals
                (customer_id, deal_name, deal_stage, deal_value,
                 close_probability, close_date)
            VALUES (%s, %s, %s, %s, %s, %s)
            """,
            (cid, deal_name, stage, value, prob,
             today + timedelta(days=offset)),
        )

    # ---- Support metrics (1 per customer) -----------------------------
    print("Seeding support_metrics...")
    metrics = [
        # (cname, tickets7d, prev7d, sentiment, adoption, last_active_offset, nps, escalations)
        ("Vantage Retail Group", 47, 11, -0.62, 34, 1, 18, 3),
        ("TechFlow Solutions", 21, 9, -0.31, 52, 2, 31, 1),
        ("Meridian Corp", 18, 10, -0.28, 61, 1, 35, 1),
        # Falling ticket volume, positive sentiment, high adoption — a thriving account.
        ("Continental Logistics", 6, 8, 0.55, 84, 1, 72, 0),
    ]
    for cname, t7, tprev, sentiment, adoption, last_off, nps, esc in metrics:
        cid = customer_ids[cname]
        cur.execute(
            "SELECT 1 FROM support_metrics WHERE customer_id = %s", (cid,)
        )
        if cur.fetchone():
            continue
        cur.execute(
            """
            INSERT INTO support_metrics
                (customer_id, ticket_count_7d, ticket_count_prev_7d,
                 avg_sentiment_score, feature_adoption_score,
                 last_active_date, nps_score, open_escalations)
            VALUES (%s, %s, %s, %s, %s, %s, %s, %s)
            """,
            (cid, t7, tprev, sentiment, adoption,
             today - timedelta(days=last_off), nps, esc),
        )

    # ---- Security events (1 per customer) -----------------------------
    print("Seeding security_events...")
    sec = [
        # (cname, api_calls, baseline, anomaly, outside_hours, export_mb, failed, ips)
        ("Vantage Retail Group", 847, 12, 0.94, True, 2847.3, 23, 7),
        ("TechFlow Solutions", 28, 19, 0.18, False, 142.1, 2, 1),
        ("Meridian Corp", 22, 17, 0.14, False, 98.4, 1, 0),
        ("Continental Logistics", 30, 28, 0.05, False, 45.0, 0, 0),
    ]
    for cname, api_calls, baseline, anomaly, outside, export_mb, failed, ips in sec:
        cid = customer_ids[cname]
        cur.execute(
            "SELECT 1 FROM security_events WHERE customer_id = %s", (cid,)
        )
        if cur.fetchone():
            continue
        cur.execute(
            """
            INSERT INTO security_events
                (customer_id, api_calls_per_hour, baseline_api_calls,
                 anomaly_score, access_outside_hours, data_export_volume_mb,
                 failed_auth_attempts, unusual_ip_count)
            VALUES (%s, %s, %s, %s, %s, %s, %s, %s)
            """,
            (cid, api_calls, baseline, anomaly, outside,
             export_mb, failed, ips),
        )

    # ---- Organizational memory — 5 historical risks -------------------
    print("Seeding organizational_memory...")
    cur.execute("SELECT COUNT(*) FROM organizational_memory")
    existing = cur.fetchone()[0]
    if existing < 5:
        embedding_str = "[" + ",".join(["0.0"] * 1024) + "]"
        memories = [
            (
                "TechFlow Solutions hit a wave of support tickets within hours of the v2.8 deployment — an authentication-timeout bug was silently logging enterprise users out mid-session. Health fell from 74 to 41 over 48 hours as the ticket queue tripled and sentiment turned sharply negative.",
                "Engineering rolled back v2.8 the same afternoon and the AE got an executive on the phone within two hours to own the disruption. With the regression reversed and a credit offered, health recovered to 68 within seven days and the renewal closed on schedule.",
                6, True, 420000, ["revenue", "operations", "customer"],
            ),
            (
                "Meridian Corp's production API key was exercised from 14 unrecognized IP addresses across three countries, exporting 3.4GB in a six-hour window — roughly twenty times the account's normal daily volume. The pattern matched a leaked-credential signature, not the customer's own integration.",
                "Security rotated the key proactively and walked Meridian's team through the access logs before they'd noticed anything themselves. Forensics confirmed no data left the platform; the account was retained and took up a quarterly security-audit offering.",
                2, True, 490000, ["security", "customer"],
            ),
            (
                "A slipped sprint on the new onboarding flow held up go-live for three enterprise accounts promised a 45-day implementation. The deadline was missed by 12 days, and one account had already scheduled an internal launch around the original date.",
                "A dedicated sprint and weekly executive check-ins recovered the work. Two of the three stayed and went live a fortnight late; the third — the one with the internal launch riding on the date — churned, a $180K ARR loss a tighter delivery commitment would have prevented.",
                288, False, 0, ["operations", "revenue", "customer"],
            ),
            (
                "Four accounts worth a combined $1.2M ARR entered their 60-day renewal windows in the same Q4 fortnight, every one carrying a health score below 55. On their own each looked manageable; together they were a concentrated revenue risk no single CSM was tracking.",
                "An executive success program put a dedicated CSM on each with a tailored save plan. All four renewed and two expanded, turning $1.2M of exposure into a net +$180K — spotting the cluster as one event, not four, was what made the difference.",
                720, True, 1200000, ["revenue", "customer", "operations"],
            ),
            (
                "A planned database migration overran into a four-hour outage on the enterprise tier, taking 12 customers offline during business hours and breaching the uptime SLA on every one of their contracts, triggering penalty clauses.",
                "SLA credits went out the same day and a public post-mortem followed, with the infrastructure hardened to make the failure mode impossible to repeat. Direct CEO outreach retained 11 of the 12; the one departure had already been evaluating alternatives.",
                4, False, 0, ["security", "operations", "customer"],
            ),
        ]
        for summary, outcome, hours, churn, saved, agents in memories:
            cur.execute(
                """
                INSERT INTO organizational_memory
                    (summary, outcome, resolution_time_hours,
                     prevented_churn, revenue_saved, contributing_agents,
                     embedding)
                VALUES (%s, %s, %s, %s, %s, %s, %s::vector)
                """,
                (summary, outcome, hours, churn, saved, agents, embedding_str),
            )

    # ---- Support tickets (real textual tickets, not just counts) ------
    cur.execute("""
        CREATE TABLE IF NOT EXISTS support_tickets (
            id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
            created_at  timestamptz NOT NULL DEFAULT now(),
            account     text NOT NULL,
            subject     text NOT NULL,
            body        text NOT NULL,
            sentiment   text
        )
    """)
    cur.execute("SELECT COUNT(*) FROM support_tickets")
    if cur.fetchone()[0] == 0:
        tickets = [
            ("Vantage Retail Group", "Q3 reconciliation export failing silently",
             "Reporting team can't export the Q3 reconciliation — the scheduled export job has failed silently three mornings running and we're now blocking month-end close. Second export issue in two weeks. Need this fixed today; our finance lead is escalating internally.",
             "negative"),
            ("Vantage Retail Group", "Admins logged out mid-session during peak hours",
             "Two of our admins were logged out mid-session again this afternoon and couldn't get back in for ~15 minutes, during our busiest window. Are you seeing auth issues on your side?",
             "negative"),
            ("TechFlow Solutions", "API for the new bulk-import?",
             "Loving the new bulk-import — we've moved our whole onboarding team onto it. Quick question: is there an API for it? We'd want to wire it into our internal tooling.",
             "positive"),
        ]
        cur.executemany(
            "INSERT INTO support_tickets (account, subject, body, sentiment) "
            "VALUES (%s, %s, %s, %s)", tickets)

    conn.commit()

    # ---- Final row counts ---------------------------------------------
    print("\nRow counts:")
    for table in [
        "organizations", "customers", "pipeline_deals", "support_metrics",
        "security_events", "agent_events", "coordinator_contexts", "risks",
        "recommendations", "organizational_memory",
    ]:
        cur.execute(f"SELECT COUNT(*) FROM {table}")
        print(f"  {table}: {cur.fetchone()[0]}")

    cur.close()


def main():
    secret = _load_secret()
    conn = None
    try:
        conn = _connect(secret)
        seed(conn)
        print("\n✓ Magnivonic demo data seeded successfully")
    except psycopg2.Error as e:
        if conn:
            conn.rollback()
        print(
            f"\nERROR ({type(e).__name__}): {e}\n"
            "Hint: check Aurora connectivity — verify the host/port are "
            "reachable, the security group allows your IP, and the credentials "
            "in MAGNIVONIC_AURORA_SECRET are correct."
        )
        sys.exit(1)
    finally:
        if conn:
            conn.close()


if __name__ == "__main__":
    main()
