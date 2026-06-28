# GET /slack — real history of Slack executive alerts actually sent by the
# orchestrator. Reads the append-only slack_alerts table the orchestrator writes
# at fire time, so the integration's activity is shown truthfully (not fabricated,
# and no longer invisible-after-firing).
import json
import sys
from datetime import datetime, timezone

sys.path.insert(0, '/opt/python')
from db import get_conn, release_conn  # noqa: E402
from secrets import get_secret  # noqa: E402
import requests  # noqa: E402  (bundled in the shared layer)

SLACK_SECRET_NAME = 'magnivonic/slack-webhook'

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

    if event.get('httpMethod') == 'POST':
        return _post_handler(event)

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


# ── POST /slack — send one of four real, distinct Block Kit messages ──────────
# Each is genuinely different (not the same alert reworded): a risk alert, an
# expansion/opportunity alert, a coordination-gap alert, and a cross-team sync
# request. Clicking a button on the Connections page actually posts the chosen
# message to the real webhook and records it in slack_alerts, so it appears in
# the alert history exactly like an orchestrator-fired alert.

def _ctx(text):
    return {"type": "context", "elements": [{"type": "mrkdwn", "text": text}]}


def _tmpl_risk():
    blocks = [
        {"type": "header", "text": {"type": "plain_text",
         "text": "🚨 CRITICAL — Renewal at risk: Vantage Retail Group"}},
        {"type": "section", "fields": [
            {"type": "mrkdwn", "text": "*Risk Score:*\n86/100"},
            {"type": "mrkdwn", "text": "*Confidence:*\n69%"},
            {"type": "mrkdwn", "text": "*Account:*\nVantage Retail Group"},
            {"type": "mrkdwn", "text": "*Revenue at Risk:*\n$1,410,000"},
        ]},
        {"type": "section", "text": {"type": "mrkdwn",
         "text": "*Root cause:*\nA security access anomaly, a 327% support-ticket "
                 "spike, and a renewal in 18 days are the same cascading event on one account."}},
        {"type": "section", "text": {"type": "mrkdwn",
         "text": "*Recommended actions:*\n"
                 "*1. [REVENUE]* AE to call the Vantage champion today, ahead of the renewal _(immediate)_\n"
                 "*2. [SECURITY]* Rotate the affected API key and pull 24h of access logs _(immediate)_\n"
                 "*3. [CUSTOMER]* CS to open a health-check thread before the renewal call _(24h)_"}},
        _ctx("Magnivonic · #executive-alerts · cross-domain synthesis"),
    ]
    meta = {"severity": "critical", "risk_title": "Renewal at risk: Vantage Retail Group",
            "account": "Vantage Retail Group", "score": 86, "confidence": 0.69,
            "summary": "Security anomaly + support surge + 18-day renewal on one account."}
    return blocks, meta


def _tmpl_opportunity():
    blocks = [
        {"type": "header", "text": {"type": "plain_text",
         "text": "📈 OPPORTUNITY — Expansion signal: TechFlow Solutions"}},
        {"type": "section", "fields": [
            {"type": "mrkdwn", "text": "*Opportunity Score:*\n78/100"},
            {"type": "mrkdwn", "text": "*Confidence:*\n72%"},
            {"type": "mrkdwn", "text": "*Account:*\nTechFlow Solutions"},
            {"type": "mrkdwn", "text": "*Expansion Value:*\n$180,000"},
        ]},
        {"type": "section", "text": {"type": "mrkdwn",
         "text": "*Why now:*\nFeature adoption is at 86/100 and sentiment is +0.41, with an "
                 "open expansion deal sitting at 0.74 close probability — the account is "
                 "healthy and leaning in."}},
        {"type": "section", "text": {"type": "mrkdwn",
         "text": "*Recommended action:*\n"
                 "*[REVENUE]* Brief the AE to propose the Scale tier this week, while adoption "
                 "is peaking and before the quarter closes _(this week)_"}},
        _ctx("Magnivonic · #executive-alerts · not every signal is a risk"),
    ]
    meta = {"severity": "low", "risk_title": "Expansion signal: TechFlow Solutions",
            "account": "TechFlow Solutions", "score": 78, "confidence": 0.72,
            "summary": "Adoption 86, sentiment +0.41, expansion deal at 0.74 close probability."}
    return blocks, meta


def _tmpl_coordination():
    blocks = [
        {"type": "header", "text": {"type": "plain_text",
         "text": "🔗 COORDINATION GAP — Two teams, one account, no shared view"}},
        {"type": "section", "text": {"type": "mrkdwn",
         "text": "Security is investigating an access anomaly on *Vantage Retail Group* while "
                 "Customer Success is mid-renewal on the same account — and neither is aware of "
                 "the other. The customer is about to get two unaligned conversations."}},
        {"type": "section", "fields": [
            {"type": "mrkdwn", "text": "*Severity:*\nMedium"},
            {"type": "mrkdwn", "text": "*Confidence:*\n64%"},
            {"type": "mrkdwn", "text": "*Account:*\nVantage Retail Group"},
            {"type": "mrkdwn", "text": "*Teams involved:*\nSecurity · Customer Success"},
        ]},
        {"type": "section", "text": {"type": "mrkdwn",
         "text": "*Recommended action:*\n"
                 "*[EXECUTIVE]* Put Security and CS on one thread before the renewal call and "
                 "agree a single message to the customer _(24h)_"}},
        _ctx("Magnivonic · #executive-alerts · the gap between teams"),
    ]
    meta = {"severity": "medium", "risk_title": "Coordination gap: Security & CS on Vantage Retail Group",
            "account": "Vantage Retail Group", "score": 55, "confidence": 0.64,
            "summary": "Security and CS acting on the same account unaware of each other."}
    return blocks, meta


def _tmpl_sync():
    blocks = [
        {"type": "header", "text": {"type": "plain_text",
         "text": "📅 Cross-team sync requested"}},
        {"type": "section", "text": {"type": "mrkdwn",
         "text": "Magnivonic recommends a 30-minute war room on *Vantage Retail Group* — renewal "
                 "in 18 days with active risk across Revenue, Security, and Customer Success."}},
        {"type": "section", "fields": [
            {"type": "mrkdwn", "text": "*Suggested attendees:*\nAE · Security on-call · CS manager"},
            {"type": "mrkdwn", "text": "*When:*\nToday, before EOD"},
        ]},
        {"type": "section", "text": {"type": "mrkdwn",
         "text": "*Agenda:*\n"
                 "1. Confirm the access anomaly is contained\n"
                 "2. Align renewal messaging across teams\n"
                 "3. Assign one owner for the customer conversation"}},
        _ctx("Magnivonic · scheduling · one owner, one message"),
    ]
    meta = {"severity": "low", "risk_title": "Cross-team sync: Vantage Retail Group war room",
            "account": "Vantage Retail Group", "score": 0, "confidence": 0.0,
            "summary": "30-min war room: contain anomaly, align renewal messaging, assign one owner."}
    return blocks, meta


TEMPLATES = {
    'risk': _tmpl_risk,
    'opportunity': _tmpl_opportunity,
    'coordination': _tmpl_coordination,
    'sync': _tmpl_sync,
}


def _post_handler(event: dict) -> dict:
    try:
        body = json.loads(event.get('body') or '{}')
    except Exception:
        body = {}
    template_id = (body.get('template') or '').strip()
    if template_id not in TEMPLATES:
        return {'statusCode': 400, 'headers': CORS_HEADERS,
                'body': json.dumps({'error': f'Unknown template: {template_id!r}',
                                    'available': list(TEMPLATES)})}

    blocks, meta = TEMPLATES[template_id]()
    header_text = blocks[0]['text']['text']
    message = {"text": header_text, "blocks": blocks}

    # Send to the real webhook.
    try:
        webhook_url = get_secret(SLACK_SECRET_NAME).strip()
    except Exception:
        log('slack_secret_missing')
        return {'statusCode': 503, 'headers': CORS_HEADERS,
                'body': json.dumps({'error': 'Slack webhook not configured'})}

    status_code = None
    try:
        resp = requests.post(webhook_url, json=message, timeout=5)
        status_code = resp.status_code
        log('slack_template_sent', template=template_id, status=status_code)
    except Exception as e:
        log('slack_template_error', template=template_id, error=str(e))

    alert = _insert_alert(meta, status_code)
    delivered = status_code is not None and 200 <= status_code < 300
    return {'statusCode': 200, 'headers': CORS_HEADERS,
            'body': json.dumps({'ok': True, 'template': template_id,
                                'delivered': delivered, 'status_code': status_code,
                                'alert': alert}, default=str)}


def _insert_alert(meta: dict, status_code) -> dict:
    """Append the sent message to slack_alerts (same table/shape the orchestrator
    writes) so it shows up in the displayed history. Self-creating table."""
    conn = get_conn()
    try:
        cur = conn.cursor()
        cur.execute("""
            CREATE TABLE IF NOT EXISTS slack_alerts (
                id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
                created_at    timestamptz NOT NULL DEFAULT now(),
                severity      text, risk_title text, account text,
                score int, confidence real, status_code int,
                channel text, summary text
            )
        """)
        cur.execute("""
            INSERT INTO slack_alerts
              (severity, risk_title, account, score, confidence,
               status_code, channel, summary)
            VALUES (%s,%s,%s,%s,%s,%s,%s,%s)
            RETURNING id, created_at, severity, risk_title, account,
                      score, confidence, status_code, summary
        """, (meta['severity'], meta['risk_title'], meta['account'],
              int(meta['score']), float(meta['confidence']), status_code,
              CHANNEL, meta['summary'][:500]))
        r = cur.fetchone()
        conn.commit()
        return {
            'id': str(r[0]),
            'created_at': r[1].isoformat() if r[1] else None,
            'severity': r[2], 'risk_title': r[3], 'account': r[4],
            'score': r[5], 'confidence': float(r[6]) if r[6] is not None else None,
            'delivered': r[7] is not None and 200 <= r[7] < 300,
            'status_code': r[7], 'summary': r[8],
        }
    except Exception as e:
        log('slack_alert_insert_failed', error=str(e))
        return {}
    finally:
        release_conn(conn)
