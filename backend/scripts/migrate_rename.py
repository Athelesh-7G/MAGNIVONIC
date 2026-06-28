# One-off migration: rename two demo accounts in place across every table that
# carries their name as data or text — so current rows AND historical archive
# (risks, recommendations, slack_alerts) all stay coherent. Idempotent: re-running
# is a no-op once the old names are gone. Invoke directly, verify, then delete.
import json
import sys
from datetime import datetime, timezone

sys.path.insert(0, '/opt/python')
from db import get_conn, release_conn  # noqa: E402

A_OLD, A_NEW = 'Acme Corp', 'Vantage Retail Group'
N_OLD, N_NEW = 'Northwind Logistics', 'Cascade Freight Co.'

# (sql, label) — each replaces both old names with their new values.
STATEMENTS = [
    ("UPDATE customers SET name=%s WHERE name=%s", (A_NEW, A_OLD), 'customers:acme'),
    ("UPDATE customers SET name=%s WHERE name=%s", (N_NEW, N_OLD), 'customers:northwind'),
    ("UPDATE pipeline_deals SET deal_name=replace(deal_name,'Acme','Vantage') WHERE deal_name LIKE 'Acme%%'", None, 'deals:acme'),
    ("UPDATE pipeline_deals SET deal_name=replace(deal_name,'Northwind','Cascade') WHERE deal_name LIKE 'Northwind%%'", None, 'deals:northwind'),
    ("""UPDATE risks SET
          title=replace(replace(title,%s,%s),%s,%s),
          root_cause=replace(replace(root_cause,%s,%s),%s,%s)
        WHERE title LIKE '%%Acme%%' OR title LIKE '%%Northwind%%'
           OR root_cause LIKE '%%Acme%%' OR root_cause LIKE '%%Northwind%%'""",
     (A_OLD, A_NEW, N_OLD, N_NEW, A_OLD, A_NEW, N_OLD, N_NEW), 'risks'),
    ("""UPDATE recommendations SET
          action=replace(replace(action,%s,%s),%s,%s),
          rationale=replace(replace(coalesce(rationale,''),%s,%s),%s,%s)
        WHERE action LIKE '%%Acme%%' OR action LIKE '%%Northwind%%'
           OR rationale LIKE '%%Acme%%' OR rationale LIKE '%%Northwind%%'""",
     (A_OLD, A_NEW, N_OLD, N_NEW, A_OLD, A_NEW, N_OLD, N_NEW), 'recommendations'),
    ("""UPDATE slack_alerts SET
          risk_title=replace(replace(risk_title,%s,%s),%s,%s),
          account=replace(replace(coalesce(account,''),%s,%s),%s,%s),
          summary=replace(replace(coalesce(summary,''),%s,%s),%s,%s)
        WHERE risk_title LIKE '%%Acme%%' OR risk_title LIKE '%%Northwind%%'
           OR account LIKE '%%Acme%%' OR account LIKE '%%Northwind%%'
           OR summary LIKE '%%Acme%%' OR summary LIKE '%%Northwind%%'""",
     (A_OLD, A_NEW, N_OLD, N_NEW, A_OLD, A_NEW, N_OLD, N_NEW, A_OLD, A_NEW, N_OLD, N_NEW), 'slack_alerts'),
]


def handler(event, context):
    conn = get_conn()
    results = {}
    try:
        cur = conn.cursor()
        for sql, params, label in STATEMENTS:
            try:
                cur.execute(sql, params) if params else cur.execute(sql)
                results[label] = cur.rowcount
            except Exception as e:
                results[label] = f'ERROR: {e}'
        conn.commit()
    finally:
        release_conn(conn)
    print(json.dumps({'service': 'magnivonic', 'migration': 'rename_accounts',
                      'results': results,
                      'timestamp': datetime.now(timezone.utc).isoformat()}))
    return {'ok': True, 'rows': results}
