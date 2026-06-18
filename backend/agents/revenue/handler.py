# Revenue agent — ARR, pipeline, renewals
import json
import os
import sys
import re
from datetime import date, datetime, timezone

sys.path.insert(0, '/opt/python')
from db import get_conn, release_conn
from bedrock import invoke_nova_pro
from events import publish_event

REVENUE_SYSTEM_PROMPT = """You are the Revenue Risk Analyst for Magnivonic, an organizational intelligence platform. You receive a JSON array of customer financial and engagement data and must analyse each account for renewal risk.

For each account, you receive: name, arr, days_to_renewal, health_score, close_probability, sentiment_score, tickets_7d.

Apply these signal thresholds when reasoning about each account:

days_to_renewal:
  < 14 days   = critical urgency
  14-30 days  = high urgency
  31-60 days  = medium urgency
  > 60 days   = low urgency

health_score:
  < 35        = critical
  35-50       = at risk
  50-65       = monitoring
  > 65        = healthy

close_probability:
  < 0.4       = very low confidence
  0.4-0.55    = low confidence

sentiment_score:
  < -0.4          = strong warning
  -0.4 to -0.2    = warning

tickets_7d:
  > 30 = elevated support load

For each account, assign a risk_score between 0.0 and 1.0 using this weighted combination:
  renewal urgency:    35%
  health score:       30%
  close probability:  20%
  sentiment:           15%

Normalise each signal to a 0.0-1.0 sub-score before applying weights (higher sub-score = higher risk). For example, critical renewal urgency contributes close to 1.0 to the renewal urgency component; a healthy health_score contributes close to 0.0 to the health component.

For each account, list specific risk_factors (maximum 3 per account). Be precise and quantitative, e.g. "28-day renewal window with health score 43" rather than vague statements.

Calculate total_revenue_exposure as the sum of ARR for all accounts where risk_score > 0.4.

Identify highest_risk_account as the name of the account with the single highest risk_score.

Identify root_cause as a one-sentence description of the single dominant factor driving the highest risk account's score.

Calculate overall_confidence as the weighted average of risk_scores across all accounts with risk_score > 0.3 (weight each by its own risk_score, or use a simple average across the qualifying accounts if scores are similar).

Return ONLY valid JSON. Do not include any prose, explanation, or markdown code fences before or after the JSON object. Your entire response must be exactly one JSON object matching this shape:

{
  "accounts": [
    {
      "name": "string",
      "arr": number,
      "risk_score": number,
      "days_to_renewal": number,
      "risk_factors": ["string", "string"]
    }
  ],
  "total_revenue_exposure": number,
  "highest_risk_account": "string",
  "root_cause": "string",
  "overall_confidence": number
}"""

AGENT_NAME = 'revenue'


def log(event_name: str, **kwargs):
    print(json.dumps({
        'service': 'magnivonic',
        'agent': AGENT_NAME,
        'event': event_name,
        'timestamp': datetime.now(timezone.utc).isoformat(),
        **kwargs
    }))


def handler(event: dict, context) -> dict:
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


def run(event: dict) -> dict:
    conn = get_conn()
    try:
        cur = conn.cursor()
        cur.execute("""
            SELECT DISTINCT ON (c.id)
              c.id::text, c.name, c.arr,
              c.renewal_date, c.health_score,
              COALESCE(pd.close_probability, 0.5),
              COALESCE(sm.avg_sentiment_score, 0.0),
              COALESCE(sm.ticket_count_7d, 0)
            FROM customers c
            LEFT JOIN pipeline_deals pd ON pd.customer_id = c.id
            LEFT JOIN support_metrics sm ON sm.customer_id = c.id
            WHERE c.account_stage != 'churned'
            ORDER BY c.id, c.arr DESC
        """)
        rows = cur.fetchall()
    finally:
        release_conn(conn)

    today = date.today()
    customers = []
    for row in rows:
        (cust_id, name, arr, renewal_date, health_score,
         close_probability, sentiment_score, tickets_7d) = row
        if renewal_date is None:
            days_to_renewal = 999
        else:
            days_to_renewal = (renewal_date - today).days
        customers.append({
            'name': name,
            'arr': float(arr) if arr is not None else 0.0,
            'days_to_renewal': days_to_renewal,
            'health_score': health_score,
            'close_probability': float(close_probability),
            'sentiment_score': float(sentiment_score),
            'tickets_7d': tickets_7d
        })

    user_content = json.dumps(customers)

    raw = invoke_nova_pro(REVENUE_SYSTEM_PROMPT, user_content,
                          max_tokens=900)

    try:
        analysis = _extract_json(raw)
    except (json.JSONDecodeError, ValueError) as e:
        log('json_parse_failed', raw_preview=raw[:500], error=str(e))
        return _fallback_evidence(f"Parse failed: {e}")

    exposure = float(analysis.get('total_revenue_exposure', 0))
    confidence = float(analysis.get('overall_confidence', 0.5))
    accounts = analysis.get('accounts', [])
    highest = analysis.get('highest_risk_account', 'Unknown')

    if exposure > 1_200_000:
        severity = 'critical'
    elif exposure > 600_000:
        severity = 'high'
    elif exposure > 200_000:
        severity = 'medium'
    else:
        severity = 'low'

    at_risk = [a.get('name') for a in accounts
               if a.get('risk_score', 0) > 0.35]

    evidence = {
        'agent': 'revenue',
        'signal': 'RevenueExposure',
        'description': (
            f"${exposure:,.0f} ARR at risk across {len(at_risk)} "
            f"accounts. Highest risk: {highest}. "
            f"Root cause: {analysis.get('root_cause', 'Unknown')}"
        ),
        'confidence': round(confidence, 3),
        'severity': severity,
        'impact_area': 'economy',
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
            ('revenue', 'RevenueExposure', severity,
             json.dumps(evidence)))
        conn.commit()
    finally:
        release_conn(conn)

    publish_event('magnivonic.revenue', 'RevenueExposure', evidence)

    log('evidence_produced', signal='RevenueExposure',
        confidence=evidence['confidence'], severity=severity,
        exposure=exposure, affected_count=len(at_risk))

    return evidence


def _fallback_evidence(reason: str) -> dict:
    return {
        'agent': 'revenue',
        'signal': 'RevenueExposure',
        'description': f'Revenue analysis unavailable: {reason}',
        'confidence': 0.2,
        'severity': 'low',
        'impact_area': 'economy',
        'affected_customers': [],
        'data': {}
    }
