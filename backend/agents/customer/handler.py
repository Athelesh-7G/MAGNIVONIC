# Customer agent — health, churn, sentiment
import json
import os
import sys
import re
from datetime import datetime, timezone

sys.path.insert(0, '/opt/python')
from db import get_conn, release_conn
from bedrock import invoke_nova_pro
from events import publish_event

CUSTOMER_SYSTEM_PROMPT = """You are the Customer Success Risk Analyst for Magnivonic, an organizational intelligence platform. You receive a JSON array of customer health data and must evaluate each account for genuine churn risk.

For each account you receive: name, arr, health_score, ticket_count_7d, ticket_count_prev_7d, avg_sentiment_score, feature_adoption_score, nps_score, open_escalations.

Evaluate each account against these 6 churn signals. Each signal can be moderate (severity 1) or severe (severity 2):

SIGNAL 1 — Health score:
  health_score < 55 = moderate (severity 1)
  health_score < 40 = severe (severity 2)

SIGNAL 2 — Sentiment:
  avg_sentiment_score < -0.25 = moderate (severity 1)
  avg_sentiment_score < -0.5  = severe (severity 2)

SIGNAL 3 — Ticket spike:
  Triggered ONLY when ticket_count_7d > (ticket_count_prev_7d * 1.8) AND ticket_count_7d > 10.
  Treat as severe (severity 2) when the increase is very large (more than triple); otherwise moderate (severity 1).

SIGNAL 4 — Feature adoption:
  feature_adoption_score < 45 = moderate (severity 1)
  feature_adoption_score < 30 = severe (severity 2)

SIGNAL 5 — Open escalations:
  open_escalations >= 1 = moderate (severity 1)
  open_escalations >= 3 = severe (severity 2)

SIGNAL 6 — NPS:
  nps_score < 25 = moderate (severity 1)

For each account:
1. Determine which of the 6 signals are triggered and the severity (1 = moderate, 2 = severe) of each triggered signal.
2. Sum the severities of all triggered signals to get raw_signal_score.
3. Count the number of distinct triggered signals.

Assign a churn_risk_score between 0.0 and 1.0 using the number of triggered signals and their severity:
  0 signals:                       0.0-0.10
  1 signal (moderate):             0.10-0.25
  1 signal (severe):               0.20-0.35
  2 signals:                       0.35-0.55
  3 or more signals:               0.55-0.85
  3 or more including any severe:  0.75-1.0

For each account, list specific churn_signals (maximum 3 per account). Be precise and quantitative, e.g. "Ticket spike 11->47 (327% increase)", "Health score 43 (severe)", "Sentiment -0.62 (severe)" rather than vague statements.

Identify primary_driver as the single strongest signal driving that account's churn risk (one short phrase).

Count high_risk_count as the number of accounts with churn_risk_score > 0.5.

Identify highest_risk_account as the name of the account with the single highest churn_risk_score.

Calculate overall_churn_confidence as the ARR-weighted average of churn_risk_scores across all accounts with churn_risk_score > 0.35 (weight each qualifying account's churn_risk_score by its arr). If no account qualifies, use 0.5.

Return ONLY valid JSON. Do not include any prose, explanation, or markdown code fences before or after the JSON object. Your entire response must be exactly one JSON object matching this shape:

{
  "accounts": [
    {
      "name": "string",
      "churn_risk_score": number,
      "churn_signals": ["string"],
      "primary_driver": "string"
    }
  ],
  "high_risk_count": number,
  "highest_risk_account": "string",
  "overall_churn_confidence": number
}"""

AGENT_NAME = 'customer'


def log(event_name: str, **kwargs):
    print(json.dumps({
        'service': 'magnivonic',
        'agent': AGENT_NAME,
        'event': event_name,
        'timestamp': datetime.now(timezone.utc).isoformat(),
        **kwargs
    }))


def handler(event: dict, context) -> dict:
    if event.get('is_warmup'):
        log('keep_warm_ping')
        return {'statusCode': 200, 'agent': AGENT_NAME,
                'result': {'status': 'warm'}}
    log('agent_invoked',
        trigger=event.get('trigger', 'direct'),
        request_id=getattr(context, 'aws_request_id',
                           'local'))
    try:
        result = run(event)
        log('agent_completed', status='success')
        return {
            'statusCode': 200,
            'agent': AGENT_NAME,
            'result': result
        }
    except Exception as e:
        log('agent_error', error=str(e), status='failed')
        return {
            'statusCode': 500,
            'agent': AGENT_NAME,
            'error': str(e)
        }


def _extract_json(text: str) -> dict:
    text = text.strip()
    text = re.sub(r'^```(?:json)?\s*', '', text, flags=re.MULTILINE)
    text = re.sub(r'```\s*$', '', text, flags=re.MULTILINE)
    text = text.strip()
    start = text.find('{')
    end = text.rfind('}')
    if start == -1 or end == -1 or end < start:
        raise ValueError(f"No JSON object found in: {text[:200]}")
    return json.loads(text[start:end + 1])


def _compute_churn_risk(c: dict) -> float:
    """Deterministic churn score in [0,1]. Each of the six documented signals
    contributes severity 0/1/2 by its threshold; the sum is normalised by 8
    (≈4 moderate signals → ceiling). No model judgment."""
    sev = 0
    h = c.get('health_score')
    if h is not None:
        if h < 40:
            sev += 2
        elif h < 55:
            sev += 1
    s = c.get('avg_sentiment_score', 0.0)
    if s < -0.5:
        sev += 2
    elif s < -0.25:
        sev += 1
    prev = c.get('ticket_count_prev_7d') or 0
    cur = c.get('ticket_count_7d') or 0
    if prev > 0:
        ratio = cur / prev
        if ratio > 3:
            sev += 2
        elif ratio > 2:
            sev += 1
    elif cur >= 10:
        sev += 2
    elif cur > 0:
        sev += 1
    ad = c.get('feature_adoption_score')
    if ad is not None:
        if ad < 30:
            sev += 2
        elif ad < 45:
            sev += 1
    esc = c.get('open_escalations') or 0
    if esc >= 3:
        sev += 2
    elif esc >= 1:
        sev += 1
    nps = c.get('nps_score')
    if nps is not None:
        if nps < 0:
            sev += 2
        elif nps < 25:
            sev += 1
    return round(min(1.0, sev / 8.0), 3)


def run(event: dict) -> dict:
    conn = get_conn()
    try:
        cur = conn.cursor()
        cur.execute("""
            SELECT DISTINCT ON (c.id)
              c.id::text, c.name, c.arr, c.health_score,
              COALESCE(sm.ticket_count_7d, 0),
              COALESCE(sm.ticket_count_prev_7d, 0),
              COALESCE(sm.avg_sentiment_score, 0.0),
              COALESCE(sm.feature_adoption_score, 50),
              COALESCE(sm.nps_score, 50),
              COALESCE(sm.open_escalations, 0)
            FROM customers c
            LEFT JOIN support_metrics sm
              ON sm.customer_id = c.id
            WHERE c.account_stage != 'churned'
            ORDER BY c.id, c.arr DESC
        """)
        rows = cur.fetchall()
    finally:
        release_conn(conn)

    customers_data = []
    for row in rows:
        (cust_id, name, arr, health_score,
         ticket_count_7d, ticket_count_prev_7d,
         avg_sentiment_score, feature_adoption_score,
         nps_score, open_escalations) = row
        customers_data.append({
            'name': name,
            'arr': float(arr) if arr is not None else 0.0,
            'health_score': health_score,
            'ticket_count_7d': ticket_count_7d,
            'ticket_count_prev_7d': ticket_count_prev_7d,
            'avg_sentiment_score': float(avg_sentiment_score),
            'feature_adoption_score': feature_adoption_score,
            'nps_score': nps_score,
            'open_escalations': open_escalations
        })

    user_content = json.dumps(customers_data, indent=2)

    raw = invoke_nova_pro(CUSTOMER_SYSTEM_PROMPT, user_content,
                          max_tokens=700)

    try:
        analysis = _extract_json(raw)
    except (json.JSONDecodeError, ValueError) as e:
        log('json_parse_failed', raw_preview=raw[:500], error=str(e))
        return _fallback_evidence(f"Parse failed: {e}")

    # ── Real computed scores (Nova only narrates churn_signals text) ────────
    # churn_risk_score per account is a deterministic signal-severity formula
    # from the six documented signals, NOT the model's number. The raw input
    # metrics are re-attached so the Orchestrator can still spot Opportunity.
    nova_signals = {a.get('name'): a.get('churn_signals', [])
                    for a in analysis.get('accounts', [])}
    arr_by_name = {c['name']: c['arr'] for c in customers_data}
    accounts = []
    for c in customers_data:
        s = _compute_churn_risk(c)
        accounts.append({
            'name': c['name'],
            'churn_risk_score': s,
            'churn_signals': nova_signals.get(c['name'], []),
            'health_score': c.get('health_score'),
            'feature_adoption_score': c.get('feature_adoption_score'),
            'avg_sentiment_score': c.get('avg_sentiment_score'),
            'nps_score': c.get('nps_score'),
        })

    high_risk = len([a for a in accounts if a['churn_risk_score'] > 0.5])
    at_risk = [a['name'] for a in accounts if a['churn_risk_score'] >= 0.35]

    qual = [(a['churn_risk_score'], arr_by_name.get(a['name'], 0.0))
            for a in accounts if a['churn_risk_score'] > 0.35]
    total_w = sum(w for _, w in qual)
    confidence = (sum(s * w for s, w in qual) / total_w
                  if total_w > 0 else 0.5)
    highest = (max(accounts, key=lambda a: a['churn_risk_score'])['name']
               if accounts else 'Unknown')

    analysis['accounts'] = accounts
    analysis['overall_churn_confidence'] = round(confidence, 3)
    analysis['highest_risk_account'] = highest
    analysis['high_risk_count'] = high_risk

    if high_risk >= 3:
        severity = 'critical'
    elif high_risk >= 2:
        severity = 'high'
    elif high_risk >= 1:
        severity = 'medium'
    else:
        severity = 'low'

    # accounts[0] may not be the highest risk — find the account
    # matching highest_risk_account by name for its signals.
    highest_account = next(
        (a for a in accounts if a.get('name') == highest), None)
    if highest_account is None and accounts:
        highest_account = accounts[0]
    top_signals = (highest_account.get('churn_signals', [])[:2]
                   if highest_account else [])

    evidence = {
        'agent': 'customer',
        'signal': 'ChurnRisk',
        'description': (
            f"{high_risk} accounts showing genuine churn signals. "
            f"Highest risk: {highest}. "
            f"Signals: {', '.join(top_signals)}"
        ),
        'confidence': round(confidence, 3),
        'severity': severity,
        'impact_area': 'churn',
        'affected_customers': at_risk,
        'data': analysis
    }

    conn = get_conn()
    try:
        cur = conn.cursor()
        cur.execute(
            "INSERT INTO agent_events "
            "(agent_type, event_type, severity, payload) "
            "VALUES (%s, %s, %s, %s)",
            ('customer', 'ChurnRisk', severity,
             json.dumps(evidence)))
        conn.commit()
    finally:
        release_conn(conn)

    publish_event('magnivonic.customer', 'ChurnRisk', evidence)

    log('evidence_produced', signal='ChurnRisk',
        confidence=confidence, severity=severity,
        high_risk_count=high_risk, highest_risk=highest)

    return evidence


def _fallback_evidence(reason: str) -> dict:
    return {
        'agent': 'customer',
        'signal': 'ChurnRisk',
        'description': f'Customer churn analysis unavailable: {reason}',
        'confidence': 0.2,
        'severity': 'low',
        'impact_area': 'churn',
        'affected_customers': [],
        'data': {}
    }
