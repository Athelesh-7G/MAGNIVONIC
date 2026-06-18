# Seeds Acme Corp cascade demo data
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
        ("Acme Corp", 500000, 28, 43, "enterprise", "at_risk"),
        ("TechFlow Solutions", 420000, 35, 51, "enterprise", "at_risk"),
        ("Meridian Corp", 490000, 42, 58, "growth", "at_risk"),
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
        ("Acme Corp", "Acme Enterprise Renewal Q3", "renewal", 500000, 0.35, 28),
        ("TechFlow Solutions", "TechFlow Platform Expansion", "renewal", 420000, 0.45, 35),
        ("Meridian Corp", "Meridian Growth Renewal", "renewal", 490000, 0.52, 42),
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
        ("Acme Corp", 47, 11, -0.62, 34, 1, 18, 3),
        ("TechFlow Solutions", 21, 9, -0.31, 52, 2, 31, 1),
        ("Meridian Corp", 18, 10, -0.28, 61, 1, 35, 1),
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
        ("Acme Corp", 847, 12, 0.94, True, 2847.3, 23, 7),
        ("TechFlow Solutions", 28, 19, 0.18, False, 142.1, 2, 1),
        ("Meridian Corp", 22, 17, 0.14, False, 98.4, 1, 0),
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
        embedding_str = "[" + ",".join(["0.0"] * 1536) + "]"
        memories = [
            (
                "TechFlow API regression caused support spike. Deployment "
                "v2.8 introduced auth timeout bug. CS health dropped from 74 "
                "to 41 in 48hrs.",
                "Rolled back v2.8. Executive call within 2 hours prevented "
                "churn. Health recovered to 68 within 7 days.",
                6, True, 420000, ["revenue", "operations", "customer"],
            ),
            (
                "Meridian API key compromise. Unusual export volume 3400MB in "
                "6 hours. Access from 14 unrecognized IPs across 3 countries.",
                "Key rotated proactively. No data breach confirmed. Customer "
                "notified within 1 hour. Retained with security audit offering.",
                2, True, 490000, ["security", "customer"],
            ),
            (
                "Sprint delay on critical onboarding feature blocked 3 "
                "enterprise accounts from going live. 45-day commitment missed "
                "by 12 days.",
                "Dedicated sprint assigned. Weekly exec reviews. 2 of 3 "
                "accounts retained, 1 churned ($180K ARR loss).",
                288, False, 0, ["operations", "revenue", "customer"],
            ),
            (
                "Q4 renewal cluster: 4 accounts totaling $1.2M ARR with health "
                "scores below 55 entering 60-day renewal window "
                "simultaneously.",
                "Executive success program launched. Dedicated CSM assigned to "
                "each. All 4 renewed, 2 expanded. Net revenue impact +$180K.",
                720, True, 1200000, ["revenue", "customer", "operations"],
            ),
            (
                "Database migration caused 4-hour downtime for enterprise tier. "
                "12 customers affected. SLA breach triggered penalty clauses.",
                "SLA credits issued. Post-mortem published. Infrastructure "
                "hardened. 11 of 12 customers retained after direct CEO "
                "outreach.",
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
