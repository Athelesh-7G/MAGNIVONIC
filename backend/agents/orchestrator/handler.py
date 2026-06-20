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

ORCHESTRATOR_SYSTEM_PROMPT = """You are the Chief Intelligence Orchestrator for Magnivonic, an organizational intelligence platform. You receive cross-domain evidence collected in parallel from four specialist agents (revenue, operations, customer success, security) plus similar historical risks retrieved from organizational memory. Your job is to synthesize this into a single executive brief.

You receive a JSON object with:
  evidence: array of structured evidence objects (already sorted by severity), each with agent, signal, description, confidence, severity, impact_area, affected_customers, data
  agent_summaries: per-agent summary dict
  combined_severity: overall severity string
  combined_confidence: overall confidence 0.0-1.0
  all_affected_customers: list of affected customer names
  past_risks: array of similar historical risks, each with summary, outcome, prevented_churn, revenue_saved, lessons_learned, similarity (0.0-1.0)

CORE PRINCIPLE — cross-domain synthesis is the intelligence:
Do not merely restate each agent's finding. The value is in connecting signals across pillars. A security API spike, a support ticket surge, a declining health score, and an imminent renewal affecting the SAME customer are not four problems — they are one cascading event. Identify that connective tissue.

Your tasks:

1. root_cause — Identify the single underlying cause that best explains ALL the signals together, across domains, not per-agent. Two sentences maximum.

2. overall_risk_score (0-100):
   - Start from combined_confidence * 100 as the base.
   - Add a boost when multiple pillars corroborate the same customer or event (e.g. security + customer + revenue all implicate the same account), because corroboration across independent domains increases certainty.
   - Never exceed 98. Never claim absolute (100) certainty.

3. confidence_narrative — One sentence explaining why confidence is high, medium, or low, grounded in how many independent domains corroborate the finding.

4. cross_domain_connections — A list of specific, concrete correlations. Each entry must name a signal from one agent and the signal from another agent it correlates with (e.g. "Security's 847/hr API spike on Acme Corp correlates with Customer's 47-ticket support surge and Revenue's 28-day renewal window for the same account").

5. recommended_actions — EXACTLY 5 actions, one for each of these departments: revenue, operations, customer, security, executive. Each action must be:
   - Specific and concretely actionable (name the step, not generic advice)
   - Time-bound (set urgency to one of: immediate, 24h, 48h, this_week)
   - Tied to the specific evidence that motivates it (put that in rationale)

6. historical_precedent — If any past_risk has similarity > 0.35, reference the single most similar one in the form: "Similar to <summary snippet>, which was resolved by <outcome snippet>." If no past_risk exceeds 0.35 similarity, return null. When referencing a past_risk in historical_precedent, include its lessons_learned insight if the field is present and non-empty — e.g. "Similar to [summary snippet], resolved by [outcome snippet]. Lesson at the time: [lessons_learned snippet]."

7. estimated_resolution_hours — A realistic integer estimate informed by past_risks resolution where available.

Return ONLY valid JSON. Do not include any prose, explanation, or markdown code fences before or after the JSON object. Your entire response must be exactly one JSON object matching this shape:

{
  "risk_title": "string — compelling one-line description",
  "root_cause": "string — cross-domain explanation, 2 sentences max",
  "overall_risk_score": number,
  "confidence_narrative": "string — one sentence",
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
}"""

AGENT_NAME = 'orchestrator'
SLACK_SECRET_NAME = 'magnivonic/slack-webhook'


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


def _synthesize(context: dict, past_risks: list) -> dict:
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
                          user_content, max_tokens=1200)

    try:
        return _extract_json(raw)
    except (json.JSONDecodeError, ValueError) as e:
        log('synthesis_parse_failed', raw_preview=raw[:500],
            error=str(e))
        return _fallback_brief(f"Synthesis parse failed: {e}")


def _extract_exposure(context: dict) -> float:
    for e in context.get('evidence', []):
        if e.get('agent') == 'revenue':
            data = e.get('data', {})
            return float(data.get('total_revenue_exposure', 0))
    return 0.0


def _save_risk(brief: dict, context: dict) -> str:
    conn = get_conn()
    try:
        cur = conn.cursor()

        cur.execute("""
            INSERT INTO risks
              (title, severity, confidence_score,
               revenue_exposure, root_cause,
               affected_customer_ids, contributing_agents,
               status)
            VALUES (%s, %s, %s, %s, %s, %s::uuid[], %s, %s)
            RETURNING id
        """, (
            brief.get('risk_title', 'Untitled Risk'),
            context.get('combined_severity', 'medium'),
            context.get('combined_confidence', 0.5),
            _extract_exposure(context),
            brief.get('root_cause', ''),
            [],
            ['revenue', 'operations', 'customer', 'security'],
            'active'
        ))
        risk_id = cur.fetchone()[0]

        for i, rec in enumerate(
                brief.get('recommended_actions', [])[:5]):
            cur.execute("""
                INSERT INTO recommendations
                  (risk_id, department, action, priority,
                   rationale, status)
                VALUES (%s, %s, %s, %s, %s, %s)
            """, (
                risk_id,
                rec.get('department', 'executive'),
                rec.get('action', ''),
                i + 1,
                rec.get('rationale', ''),
                'pending'
            ))

        conn.commit()
        log('risk_saved', risk_id=str(risk_id))
        return str(risk_id)
    finally:
        release_conn(conn)


def _notify_slack(brief: dict, context: dict):
    try:
        webhook_url = get_secret(SLACK_SECRET_NAME).strip()
    except Exception:
        log('slack_secret_missing')
        return

    severity = context.get('combined_severity', 'unknown')
    emoji = {'critical': '🚨', 'high': '⚠️',
             'medium': '📊', 'low': 'ℹ️'}.get(severity, '📋')

    score = brief.get('overall_risk_score', 0)
    customers = context.get('all_affected_customers', [])
    actions = brief.get('recommended_actions', [])

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
                            f"{brief.get('risk_title','Risk Detected')}"
                }
            },
            {
                "type": "section",
                "fields": [
                    {"type": "mrkdwn",
                     "text": f"*Risk Score:*\n{score}/100"},
                    {"type": "mrkdwn",
                     "text": f"*Confidence:*\n"
                             f"{round(context.get('combined_confidence',0)*100)}%"},
                    {"type": "mrkdwn",
                     "text": f"*Accounts Affected:*\n"
                             f"{', '.join(customers)}"},
                    {"type": "mrkdwn",
                     "text": f"*Revenue at Risk:*\n"
                             f"${_extract_exposure(context):,.0f}"}
                ]
            },
            {
                "type": "section",
                "text": {
                    "type": "mrkdwn",
                    "text": f"*Root Cause:*\n"
                            f"{brief.get('root_cause','')}"
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

    try:
        resp = requests.post(webhook_url, json=message, timeout=5)
        log('slack_notified', status=resp.status_code)
    except Exception as e:
        log('slack_error', error=str(e))


def run(event: dict) -> dict:
    trigger = event.get('trigger', 'manual')
    log('orchestrator_starting', trigger=trigger)

    try:
        context = _invoke_coordinator(trigger)
    except Exception as e:
        log('coordinator_failed', error=str(e))
        return _fallback_brief(f"Coordinator failed: {e}")

    past_risks = _search_memory(context)
    log('memory_searched',
        results=len(past_risks),
        top_similarity=past_risks[0]['similarity']
        if past_risks else 0)

    brief = _synthesize(context, past_risks)
    if not brief or brief.get('confidence_narrative') is None:
        brief = _fallback_brief("Synthesis incomplete")

    try:
        risk_id = _save_risk(brief, context)
        brief['risk_id'] = risk_id
    except Exception as e:
        log('save_risk_failed', error=str(e))
        brief['risk_id'] = None

    _notify_slack(brief, context)

    publish_event('magnivonic.orchestrator',
                  'ExecutiveBriefReady', {
                      'risk_id': brief.get('risk_id'),
                      'severity': context.get('combined_severity'),
                      'risk_score': brief.get('overall_risk_score'),
                      'affected_customers': context.get(
                          'all_affected_customers', [])
                  })

    log('orchestrator_complete',
        risk_score=brief.get('overall_risk_score'),
        risk_id=brief.get('risk_id'),
        actions_count=len(brief.get('recommended_actions', [])))

    return {
        **brief,
        "context": {
            "combined_severity": context.get('combined_severity'),
            "combined_confidence": context.get('combined_confidence'),
            "all_affected_customers": context.get(
                'all_affected_customers', []),
            "evidence_count": context.get('evidence_count', 0),
            "past_risks_found": len(past_risks)
        }
    }


def _fallback_brief(reason: str) -> dict:
    return {
        "risk_title": "Analysis Incomplete",
        "root_cause": reason,
        "overall_risk_score": 0,
        "confidence_narrative": "Analysis could not be completed",
        "cross_domain_connections": [],
        "recommended_actions": [],
        "historical_precedent": None,
        "estimated_resolution_hours": 0,
        "risk_id": None
    }
