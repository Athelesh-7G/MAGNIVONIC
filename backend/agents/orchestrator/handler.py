# Orchestrator agent — hero agent
import json
import os
import sys
import re
import requests
from datetime import datetime, timezone

sys.path.insert(0, '/opt/python')
from db import get_conn, release_conn
from bedrock import invoke_nova_pro, invoke_titan_embed
from secrets import get_secret
from events import publish_event
import boto3

ORCHESTRATOR_SYSTEM_PROMPT = """You are the Chief Intelligence Orchestrator for Magnivonic, an organizational intelligence platform. You receive cross-domain evidence collected in parallel from four specialist agents (revenue, operations, customer success, security) plus similar historical risks retrieved from organizational memory. Your job is to find every distinct, real cross-domain event or pattern in that evidence and classify each one.

You receive a JSON object with:
  evidence: array of structured evidence objects (already sorted by severity), each with agent, signal, description, confidence, severity, impact_area, affected_customers, data
  agent_summaries: per-agent summary dict
  combined_severity: overall severity string
  combined_confidence: overall confidence 0.0-1.0
  all_affected_customers: list of affected customer names
  past_risks: array of similar historical risks, each with summary, outcome, prevented_churn, revenue_saved, lessons_learned, similarity (0.0-1.0)

CORE PRINCIPLE — cross-domain synthesis is the intelligence:
Do not merely restate each agent's finding. The value is in connecting signals across pillars. A security API spike, a support ticket surge, a declining health score, and an imminent renewal affecting the SAME customer are not four problems — they are one cascading event. Identify that connective tissue.

CRITICAL — scan every account, not just the flagged ones:
Each agent's `data.accounts` (or equivalent) array contains an entry for EVERY account it evaluated, not only the ones in `affected_customers`. affected_customers only lists accounts that crossed a RISK threshold — a healthy or expanding account will never appear there, but it will still have a full entry in `data.accounts` with its real metrics (health_score, feature_adoption_score, avg_sentiment_score, nps_score, close_probability, deal_stage, deal_value, etc). You must look at the full accounts arrays to find positive patterns, not just the affected_customers lists.

Your task: identify each distinct event or pattern and emit ONE classified insight per event, as an array. Emit between 1 and 4 insights — do not pad the array with weak or duplicate findings; if there is genuinely only one real event, return only one insight. But also do not stop early: if the evidence supports a real Risk AND a real Opportunity AND a real CoordinationGap AND a real Drift simultaneously (four different accounts/events, each genuinely meeting its own bar below), report all four — a critical Risk elsewhere in the evidence is never a reason to omit a real, distinct Opportunity, CoordinationGap, or Drift. Classify each insight as exactly one of these four types:

- "Risk" — two or more domains corroborate a NEGATIVE signal on the same account (declining health, negative sentiment, security anomaly, elevated churn risk, revenue exposure). This is the cascading-event case.

- "Opportunity" — an account with LOW risk across domains (churn_risk_score and security_score both low, not flagged in any affected_customers list) AND a genuine positive indicator actually present in its data: feature_adoption_score > 70, or avg_sentiment_score > 0.3, or a pipeline deal with deal_stage other than "renewal" (e.g. "expansion") and close_probability > 0.7. Only call something an Opportunity when the underlying numbers actually show this — never as a euphemism for "merely not at risk," and never invented.

- "CoordinationGap" — the operations agent's signals (blocker_issues, a decreasing commit_velocity trend, stalled open_prs) indicate internal delivery misalignment. This is an organizational/process problem, independent of any single customer's churn signals. Set account to null unless the delivery problem demonstrably blocks one specific customer commitment.

- "Drift" — an account showing real negative movement that does NOT clear the bar for "Risk" above. Two forms both count: (a) a literal before/after delta (e.g. ticket_count_7d vs ticket_count_prev_7d, or a decreasing commit_velocity trend), or (b) an account whose per-domain scores (risk_score, churn_risk_score, anomaly_score, security_score) are each in the moderate range — clearly elevated above a healthy baseline, corroborated by at least one domain's own "moderate" signal language, but below the magnitude you'd call a Risk. Call out the trajectory — a thing worth watching, not yet a crisis. Do not silently drop an account just because another account in the same run is more severe — if its real numbers are moderately elevated, surface it as Drift rather than omitting it.

For EACH insight, produce:

1. risk_title — compelling one-line description of this specific insight.

2. account — the single account name this insight is about, or null if it is org-internal (typically only CoordinationGap).

3. severity — "low" | "medium" | "high" | "critical", scaled to THIS insight alone (not the whole run).

4. confidence — 0.0-1.0, how confident you are in this specific classification.

5. overall_score (0-100) — for Risk/CoordinationGap/Drift this is a magnitude-of-concern score; for Opportunity this is a strength-of-upside score. Never exceed 98. Never claim absolute (100) certainty.

6. root_cause — the single underlying cause that best explains this insight's signals together, across domains where applicable. Two sentences maximum.

7. confidence_narrative — one sentence explaining why confidence is high, medium, or low, grounded in how many independent domains corroborate the finding.

8. cross_domain_connections — specific, concrete correlations for THIS insight. Each entry must name a signal from one agent and the signal from another agent it correlates with. Can be an empty array if this insight is genuinely single-domain (e.g. a pure CoordinationGap).

9. recommended_actions — 1 to 5 actions, each tied to a department that is GENUINELY relevant to this specific insight (revenue, operations, customer, security, executive). Do not force an action for an irrelevant department. Always include one executive-level action. Each action must be specific and time-bound (urgency: immediate|24h|48h|this_week), and tied to the evidence in its rationale. CRITICAL — phrase each action the way a real department head would actually instruct their team in a Slack message or standup: name the concrete next step and who owns it (e.g. "Have the AE call the Vantage champion today to get ahead of the renewal" — NOT "Engage with the account regarding the renewal"). Do not restate the signal as an action (e.g. never "Investigate the API anomaly" — instead "Rotate the affected API key and pull the last 24h of access logs for the SOC"). Use direct, operational language a CEO or manager would respect; avoid vague verbs like "monitor", "review", or "assess" unless paired with a specific target, owner, and outcome.

10. historical_precedent — if any past_risk has similarity > 0.35 AND is genuinely relevant to THIS insight, reference the single most similar one in the form: "Similar to <summary snippet>, which was resolved by <outcome snippet>." Include its lessons_learned if present and non-empty. Otherwise null. Different insights in the same run may reference different past_risks, or none.

11. estimated_resolution_hours — a realistic integer estimate of the time to act on this specific insight.

Return ONLY valid JSON. Do not include any prose, explanation, or markdown code fences before or after the JSON object. Your entire response must be exactly one JSON object matching this shape:

{
  "insights": [
    {
      "insight_type": "Risk|Opportunity|CoordinationGap|Drift",
      "account": "string or null",
      "risk_title": "string",
      "severity": "low|medium|high|critical",
      "confidence": number,
      "overall_score": number,
      "root_cause": "string",
      "confidence_narrative": "string",
      "cross_domain_connections": ["string"],
      "recommended_actions": [
        {
          "department": "revenue|operations|customer|security|executive",
          "action": "string",
          "urgency": "immediate|24h|48h|this_week",
          "rationale": "string"
        }
      ],
      "historical_precedent": "string or null",
      "estimated_resolution_hours": number
    }
  ]
}"""

AGENT_NAME = 'orchestrator'
SLACK_SECRET_NAME = 'magnivonic/slack-webhook'
VALID_INSIGHT_TYPES = {'Risk', 'Opportunity', 'CoordinationGap', 'Drift'}


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


def _invoke_coordinator(trigger: str) -> dict:
    lambda_client = boto3.client('lambda', region_name='us-east-1')
    response = lambda_client.invoke(
        FunctionName='magnivonic-coordinator-agent',
        InvocationType='RequestResponse',
        Payload=json.dumps({"trigger": trigger}).encode()
    )
    payload = json.loads(response['Payload'].read())
    if payload.get('statusCode') != 200:
        raise RuntimeError(
            f"Coordinator failed: {payload.get('error')}")
    return payload['result']


def _search_memory(context: dict) -> list:
    try:
        query_parts = []
        for e in context.get('evidence', []):
            query_parts.append(e.get('description', ''))
        query_text = ' '.join(query_parts[:4])

        embedding = invoke_titan_embed(query_text)
        vec_str = '[' + ','.join(str(x) for x in embedding) + ']'

        conn = get_conn()
        try:
            cur = conn.cursor()
            cur.execute("""
                SELECT
                  summary, outcome, prevented_churn,
                  revenue_saved, contributing_agents,
                  lessons_learned,
                  1 - (embedding <=> %s::vector) as similarity
                FROM organizational_memory
                ORDER BY embedding <=> %s::vector
                LIMIT 3
            """, (vec_str, vec_str))
            rows = cur.fetchall()
        finally:
            release_conn(conn)

        return [
            {
                "summary": r[0],
                "outcome": r[1],
                "prevented_churn": r[2],
                "revenue_saved": float(r[3] or 0),
                "contributing_agents": r[4] or [],
                "lessons_learned": r[5] or "",
                "similarity": float(r[6])
            }
            for r in rows
        ]
    except Exception as e:
        log('memory_search_error', error=str(e))
        return []


def _synthesize(context: dict, past_risks: list) -> list:
    payload = {
        "evidence": context.get('evidence', []),
        "agent_summaries": context.get('agent_summaries', {}),
        "combined_severity": context.get('combined_severity'),
        "combined_confidence": context.get('combined_confidence'),
        "all_affected_customers":
            context.get('all_affected_customers', []),
        "past_risks": past_risks
    }
    user_content = json.dumps(payload, indent=2, default=str)

    raw = invoke_nova_pro(ORCHESTRATOR_SYSTEM_PROMPT,
                          user_content, max_tokens=2200)

    try:
        parsed = _extract_json(raw)
    except (json.JSONDecodeError, ValueError) as e:
        log('synthesis_parse_failed', raw_preview=raw[:500],
            error=str(e))
        return [_fallback_insight(f"Synthesis parse failed: {e}")]

    insights = parsed.get('insights')
    if insights is None and parsed.get('risk_title'):
        # Model returned a single bare insight instead of {"insights": [...]}.
        insights = [parsed]
    if not insights:
        return [_fallback_insight("Synthesis returned no insights")]

    valid = []
    for ins in insights[:4]:
        if ins.get('insight_type') not in VALID_INSIGHT_TYPES:
            ins['insight_type'] = 'Risk'
        valid.append(ins)
    return valid


def _account_value(context: dict, account: str | None,
                   prefer_deal: bool = False) -> float:
    if not account:
        return 0.0
    for e in context.get('evidence', []):
        if e.get('agent') == 'revenue':
            for a in e.get('data', {}).get('accounts', []):
                if a.get('name') == account:
                    if prefer_deal and a.get('deal_value'):
                        return float(a.get('deal_value') or 0)
                    return float(a.get('arr', 0) or 0)
    return 0.0


def _save_insight(insight: dict, context: dict) -> str:
    conn = get_conn()
    try:
        cur = conn.cursor()

        insight_type = insight.get('insight_type', 'Risk')
        exposure = _account_value(
            context, insight.get('account'),
            prefer_deal=(insight_type == 'Opportunity'))

        cur.execute("""
            INSERT INTO risks
              (title, severity, confidence_score,
               revenue_exposure, root_cause,
               affected_customer_ids, contributing_agents,
               status, insight_type)
            VALUES (%s, %s, %s, %s, %s, %s::uuid[], %s, %s, %s)
            RETURNING id
        """, (
            insight.get('risk_title', 'Untitled Insight'),
            insight.get('severity', 'medium'),
            insight.get('confidence', 0.5),
            exposure,
            insight.get('root_cause', ''),
            [],
            ['revenue', 'operations', 'customer', 'security'],
            'active',
            insight_type
        ))
        insight_id = cur.fetchone()[0]

        for i, rec in enumerate(
                insight.get('recommended_actions', [])[:5]):
            cur.execute("""
                INSERT INTO recommendations
                  (risk_id, department, action, priority,
                   rationale, status)
                VALUES (%s, %s, %s, %s, %s, %s)
            """, (
                insight_id,
                rec.get('department', 'executive'),
                rec.get('action', ''),
                i + 1,
                rec.get('rationale', ''),
                'pending'
            ))

        conn.commit()
        log('insight_saved', insight_id=str(insight_id),
            insight_type=insight_type)
        return str(insight_id)
    finally:
        release_conn(conn)


def _notify_slack(insight: dict, context: dict):
    try:
        webhook_url = get_secret(SLACK_SECRET_NAME).strip()
    except Exception:
        log('slack_secret_missing')
        return

    severity = insight.get('severity', 'unknown')
    emoji = {'critical': '🚨', 'high': '⚠️',
             'medium': '📊', 'low': 'ℹ️'}.get(severity, '📋')

    score = insight.get('overall_score', 0)
    customers = context.get('all_affected_customers', [])
    actions = insight.get('recommended_actions', [])

    action_text = '\n'.join([
        f"*{i+1}. [{r.get('department','').upper()}]* "
        f"{r.get('action','')} _(urgency: {r.get('urgency','')})_"
        for i, r in enumerate(actions[:4])
    ])

    message = {
        "text": f"{emoji} Magnivonic Executive Alert",
        "blocks": [
            {
                "type": "header",
                "text": {
                    "type": "plain_text",
                    "text": f"{emoji} {severity.upper()} — "
                            f"{insight.get('risk_title','Risk Detected')}"
                }
            },
            {
                "type": "section",
                "fields": [
                    {"type": "mrkdwn",
                     "text": f"*Risk Score:*\n{score}/100"},
                    {"type": "mrkdwn",
                     "text": f"*Confidence:*\n"
                             f"{round(insight.get('confidence', 0)*100)}%"},
                    {"type": "mrkdwn",
                     "text": f"*Accounts Affected:*\n"
                             f"{', '.join(customers)}"},
                    {"type": "mrkdwn",
                     "text": f"*Revenue at Risk:*\n"
                             f"${_account_value(context, insight.get('account')):,.0f}"}
                ]
            },
            {
                "type": "section",
                "text": {
                    "type": "mrkdwn",
                    "text": f"*Root Cause:*\n"
                            f"{insight.get('root_cause','')}"
                }
            },
            {
                "type": "section",
                "text": {
                    "type": "mrkdwn",
                    "text": f"*Recommended Actions:*\n{action_text}"
                }
            }
        ]
    }

    status_code = None
    try:
        resp = requests.post(webhook_url, json=message, timeout=5)
        status_code = resp.status_code
        log('slack_notified', status=resp.status_code)
    except Exception as e:
        log('slack_error', error=str(e))

    # Record the alert so it can be shown truthfully on the Connections page —
    # without this the fire is invisible after it happens (CloudWatch only).
    _log_slack_alert(insight, context, status_code)


def _log_slack_alert(insight: dict, context: dict, status_code):
    """Append a durable record of a sent Slack alert. Self-creating table so no
    separate migration step is needed; append-only, never updated/deleted."""
    conn = get_conn()
    try:
        cur = conn.cursor()
        cur.execute("""
            CREATE TABLE IF NOT EXISTS slack_alerts (
                id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
                created_at    timestamptz NOT NULL DEFAULT now(),
                severity      text,
                risk_title    text,
                account       text,
                score         int,
                confidence    real,
                status_code   int,
                channel       text,
                summary       text
            )
        """)
        cur.execute("""
            INSERT INTO slack_alerts
              (severity, risk_title, account, score, confidence,
               status_code, channel, summary)
            VALUES (%s, %s, %s, %s, %s, %s, %s, %s)
        """, (
            insight.get('severity', 'unknown'),
            insight.get('risk_title', 'Risk Detected'),
            insight.get('account'),
            int(insight.get('overall_score', 0)),
            float(insight.get('confidence', 0)),
            status_code,
            '#executive-alerts',
            insight.get('root_cause', '')[:500],
        ))
        conn.commit()
        log('slack_alert_logged')
    except Exception as e:
        log('slack_alert_log_failed', error=str(e))
    finally:
        release_conn(conn)


def run(event: dict) -> dict:
    trigger = event.get('trigger', 'manual')
    log('orchestrator_starting', trigger=trigger)

    try:
        context = _invoke_coordinator(trigger)
    except Exception as e:
        log('coordinator_failed', error=str(e))
        return _fallback_response(f"Coordinator failed: {e}")

    past_risks = _search_memory(context)
    log('memory_searched',
        results=len(past_risks),
        top_similarity=past_risks[0]['similarity']
        if past_risks else 0)

    insights = _synthesize(context, past_risks)

    for insight in insights:
        try:
            insight['risk_id'] = _save_insight(insight, context)
        except Exception as e:
            log('save_insight_failed', error=str(e),
                insight_type=insight.get('insight_type'))
            insight['risk_id'] = None

    risk_insights = [i for i in insights
                     if i.get('insight_type') == 'Risk']
    if risk_insights:
        top_risk = max(risk_insights,
                       key=lambda i: i.get('overall_score', 0))
        _notify_slack(top_risk, context)

    type_counts: dict = {}
    for i in insights:
        t = i.get('insight_type', 'Risk')
        type_counts[t] = type_counts.get(t, 0) + 1

    publish_event('magnivonic.orchestrator',
                  'ExecutiveBriefReady', {
                      'insight_ids': [i.get('risk_id') for i in insights],
                      'insight_type_counts': type_counts,
                      'combined_severity': context.get('combined_severity'),
                      'affected_customers': context.get(
                          'all_affected_customers', [])
                  })

    log('orchestrator_complete',
        insight_count=len(insights),
        insight_type_counts=type_counts)

    return {
        "insights": insights,
        "context": {
            "combined_severity": context.get('combined_severity'),
            "combined_confidence": context.get('combined_confidence'),
            "all_affected_customers": context.get(
                'all_affected_customers', []),
            "evidence_count": context.get('evidence_count', 0),
            "past_risks_found": len(past_risks),
            "insight_type_counts": type_counts,
            # Real per-domain findings the Chief of Staff (coordinator) actually
            # assembled — surfaced in the UI as the aggregation step before the
            # General Manager's synthesis. Not invented; passed straight through.
            "agent_summaries": context.get('agent_summaries', {})
        }
    }


def _fallback_insight(reason: str) -> dict:
    return {
        "insight_type": "Risk",
        "account": None,
        "risk_title": "Analysis Incomplete",
        "severity": "low",
        "confidence": 0.0,
        "overall_score": 0,
        "root_cause": reason,
        "confidence_narrative": "Analysis could not be completed",
        "cross_domain_connections": [],
        "recommended_actions": [],
        "historical_precedent": None,
        "estimated_resolution_hours": 0,
        "risk_id": None
    }


def _fallback_response(reason: str) -> dict:
    return {
        "insights": [_fallback_insight(reason)],
        "context": {
            "combined_severity": "low",
            "combined_confidence": 0.0,
            "all_affected_customers": [],
            "evidence_count": 0,
            "past_risks_found": 0,
            "insight_type_counts": {},
            "agent_summaries": {}
        }
    }
