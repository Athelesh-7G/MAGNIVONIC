# GET /slack — real history of Slack executive alerts actually sent by the
# orchestrator. Reads the append-only slack_alerts table the orchestrator writes
# at fire time, so the integration's activity is shown truthfully (not fabricated,
# and no longer invisible-after-firing).
import json
import sys
from datetime import datetime, timezone

sys.path.insert(0, '/opt/python')
from db import get_conn, release_conn  # noqa: E402

CORS_HEADERS = {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET,POST,OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type'
}

CHANNEL = '#executive-alerts'


def log(event_name: str, **kwargs):
    print(json.dumps({
        'service': 'magnivonic', 'api': 'slack', 'event': event_name,
        'timestamp': datetime.now(timezone.utc).isoformat(), **kwargs
    }))


def handler(event: dict, context) -> dict:
    if event.get('httpMethod') == 'OPTIONS':
        return {'statusCode': 200, 'headers': CORS_HEADERS, 'body': ''}

    conn = get_conn()
    try:
        cur = conn.cursor()
        # The table is created lazily by the orchestrator the first time an alert
        # fires; tolerate its absence so a fresh environment reads as "connected,
        # no alerts yet" rather than erroring.
        cur.execute("SELECT to_regclass('public.slack_alerts')")
        if cur.fetchone()[0] is None:
            return _respond(alerts=[], total=0)

        cur.execute("""
            SELECT id, created_at, severity, risk_title, account,
                   score, confidence, status_code, summary
            FROM slack_alerts
            ORDER BY created_at DESC
            LIMIT 20
        """)
        cols = [d[0] for d in cur.description]
        rows = [dict(zip(cols, r)) for r in cur.fetchall()]

        cur.execute("SELECT count(*) FROM slack_alerts")
        total = cur.fetchone()[0]
    finally:
        release_conn(conn)

    alerts = [{
        'id': str(r['id']),
        'created_at': r['created_at'].isoformat() if r['created_at'] else None,
        'severity': r['severity'],
        'risk_title': r['risk_title'],
        'account': r['account'],
        'score': r['score'],
        'confidence': float(r['confidence']) if r['confidence'] is not None else None,
        'delivered': r['status_code'] is not None and 200 <= r['status_code'] < 300,
        'status_code': r['status_code'],
        'summary': r['summary'],
    } for r in rows]
    log('slack_alerts_read', count=len(alerts), total=total)
    return _respond(alerts=alerts, total=total)


def _respond(alerts, total):
    return {
        'statusCode': 200, 'headers': CORS_HEADERS,
        'body': json.dumps({
            'connected': True,
            'channel': CHANNEL,
            'alerts': alerts,
            'total': total,
        }, default=str)
    }
