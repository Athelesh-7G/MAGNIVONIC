# Coordinator — aggregates domain results
import json
import os
import sys
import boto3
from datetime import datetime, timezone
from concurrent.futures import ThreadPoolExecutor, as_completed

sys.path.insert(0, '/opt/python')
from db import get_conn, release_conn
from events import publish_event

AGENT_NAME = 'coordinator'

DOMAIN_AGENTS = [
    'magnivonic-operations-agent',
    'magnivonic-revenue-agent',
    'magnivonic-customer-agent',
    'magnivonic-security-agent'
]

_lambda_client = None


def _get_lambda():
    global _lambda_client
    if _lambda_client is None:
        _lambda_client = boto3.client('lambda',
                                      region_name='us-east-1')
    return _lambda_client


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


def _severity_rank(severity: str) -> int:
    return {'critical': 4, 'high': 3,
            'medium': 2, 'low': 1}.get(severity, 0)


def _invoke_agent(agent_name: str, trigger: str = 'coordinator') -> dict:
    try:
        response = _get_lambda().invoke(
            FunctionName=agent_name,
            InvocationType='RequestResponse',
            Payload=json.dumps({"trigger": trigger}).encode()
        )
        payload = json.loads(response['Payload'].read())
        if payload.get('statusCode') == 200:
            result = payload.get('result', {})
            log('agent_invoked_ok', agent=agent_name,
                signal=result.get('signal'),
                severity=result.get('severity'),
                confidence=result.get('confidence'))
            return result
        else:
            log('agent_invoked_error', agent=agent_name,
                status=payload.get('statusCode'),
                error=payload.get('error', 'unknown'))
            return _fallback_evidence(agent_name)
    except Exception as e:
        log('agent_invoke_exception', agent=agent_name,
            error=str(e))
        return _fallback_evidence(agent_name)


def run(event: dict) -> dict:
    trigger = event.get('trigger', 'manual')
    log('coordinator_starting', trigger=trigger,
        agent_count=len(DOMAIN_AGENTS))

    evidence_list = []
    with ThreadPoolExecutor(max_workers=4) as executor:
        futures = {
            executor.submit(_invoke_agent, agent, trigger): agent
            for agent in DOMAIN_AGENTS
        }
        for future in as_completed(futures, timeout=25):
            agent_name = futures[future]
            try:
                result = future.result()
                evidence_list.append(result)
            except Exception as e:
                log('future_error', agent=agent_name,
                    error=str(e))
                evidence_list.append(
                    _fallback_evidence(agent_name))

    context = _build_context(evidence_list, trigger)

    conn = get_conn()
    try:
        cur = conn.cursor()
        cur.execute("""
            INSERT INTO coordinator_contexts
              (triggered_by, affected_customer_ids,
               combined_severity, domain_results,
               orchestrator_triggered)
            VALUES (%s, %s::uuid[], %s, %s, %s)
            RETURNING id
        """, (
            trigger,
            [],
            context['combined_severity'],
            json.dumps(context),
            False
        ))
        context_id = cur.fetchone()[0]
        conn.commit()
        log('context_saved', context_id=str(context_id))
    finally:
        release_conn(conn)

    publish_event('magnivonic.coordinator', 'ContextReady',
                  {'context_id': str(context_id),
                   'combined_severity': context['combined_severity'],
                   'evidence_count': len(evidence_list)})

    context['context_id'] = str(context_id)
    return context


def _build_context(evidence_list: list, trigger: str) -> dict:
    valid_evidence = [e for e in evidence_list
                      if e.get('confidence', 0) > 0.2
                      or e.get('affected_customers')]

    severity_order = {'critical': 4, 'high': 3,
                      'medium': 2, 'low': 1}
    valid_evidence.sort(
        key=lambda e: severity_order.get(
            e.get('severity', 'low'), 0),
        reverse=True)

    all_affected = []
    for e in valid_evidence:
        for c in e.get('affected_customers', []):
            if c not in all_affected:
                all_affected.append(c)

    combined_severity = max(
        valid_evidence,
        key=lambda e: _severity_rank(e.get('severity', 'low'))
    ).get('severity', 'low') if valid_evidence else 'low'

    total_weight = sum(_severity_rank(e.get('severity', 'low'))
                       for e in valid_evidence)
    if total_weight > 0:
        combined_confidence = sum(
            e.get('confidence', 0) *
            _severity_rank(e.get('severity', 'low'))
            for e in valid_evidence
        ) / total_weight
    else:
        combined_confidence = 0.0

    agent_summaries = {}
    for e in evidence_list:
        agent = e.get('agent', 'unknown')
        agent_summaries[agent] = {
            'signal': e.get('signal'),
            'severity': e.get('severity'),
            'confidence': e.get('confidence'),
            'affected': e.get('affected_customers', []),
            'description': e.get('description', '')
        }

    return {
        'trigger': trigger,
        'timestamp': datetime.now(timezone.utc).isoformat(),
        'combined_severity': combined_severity,
        'combined_confidence': round(combined_confidence, 3),
        'all_affected_customers': all_affected,
        'evidence_count': len(valid_evidence),
        'evidence': valid_evidence,
        'agent_summaries': agent_summaries
    }


def _fallback_evidence(source: str) -> dict:
    return {
        'agent': source,
        'signal': 'Unavailable',
        'description': f"{source} did not respond",
        'confidence': 0.0,
        'severity': 'low',
        'impact_area': 'unknown',
        'affected_customers': [],
        'data': {}
    }
