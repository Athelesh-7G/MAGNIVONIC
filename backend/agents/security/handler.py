# Security agent — anomaly, access patterns
import json
import os
import sys
from datetime import datetime, timezone

sys.path.insert(0, '/opt/python')
from db import get_conn, release_conn
from events import publish_event

AGENT_NAME = 'security'


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


def _score_account(row: tuple) -> dict:
    (cid, name, arr, api_calls, baseline, anomaly_score,
     outside_hours, export_mb, failed_auth, unusual_ips) = row

    api_calls = float(api_calls)
    baseline = float(baseline)
    anomaly_score = float(anomaly_score)
    export_mb = float(export_mb)
    failed_auth = int(failed_auth)
    unusual_ips = int(unusual_ips)

    api_spike_ratio = api_calls / max(baseline, 1)

    score = 0.0
    score += anomaly_score * 0.35

    if api_spike_ratio >= 50:
        score += 0.30
    elif api_spike_ratio >= 20:
        score += 0.20
    elif api_spike_ratio >= 5:
        score += 0.10
    elif api_spike_ratio >= 2:
        score += 0.05

    if outside_hours:
        score += 0.10

    if export_mb >= 1000:
        score += 0.15
    elif export_mb >= 500:
        score += 0.10
    elif export_mb >= 100:
        score += 0.05

    if failed_auth >= 10:
        score += 0.10
    elif failed_auth >= 5:
        score += 0.05

    if unusual_ips >= 5:
        score += 0.10
    elif unusual_ips >= 2:
        score += 0.05

    security_score = min(round(score, 3), 1.0)

    signals = []
    if api_spike_ratio >= 2:
        signals.append(
            f"API spike {api_calls:.0f}/hr vs baseline "
            f"{baseline:.0f}/hr ({api_spike_ratio:.0f}x normal)")
    if outside_hours:
        signals.append("Access detected outside business hours")
    if export_mb >= 100:
        signals.append(f"Data export {export_mb:.0f}MB")
    if failed_auth >= 5:
        signals.append(f"{failed_auth} failed auth attempts")
    if unusual_ips >= 2:
        signals.append(f"{unusual_ips} unusual IP addresses")

    return {
        'name': name,
        'arr': float(arr or 0),
        'security_score': security_score,
        'anomaly_score': float(anomaly_score),
        'api_calls': float(api_calls),
        'baseline': float(baseline),
        'api_spike_ratio': round(api_spike_ratio, 1),
        'access_outside_hours': bool(outside_hours),
        'data_export_mb': float(export_mb),
        'failed_auth_attempts': int(failed_auth),
        'unusual_ip_count': int(unusual_ips),
        'signals': signals
    }


def run(event: dict) -> dict:
    conn = get_conn()
    try:
        cur = conn.cursor()
        cur.execute("""
            SELECT DISTINCT ON (c.id)
              c.id::text, c.name, c.arr,
              COALESCE(se.api_calls_per_hour, 0),
              COALESCE(se.baseline_api_calls, 1),
              COALESCE(se.anomaly_score, 0),
              COALESCE(se.access_outside_hours, false),
              COALESCE(se.data_export_volume_mb, 0),
              COALESCE(se.failed_auth_attempts, 0),
              COALESCE(se.unusual_ip_count, 0)
            FROM customers c
            LEFT JOIN security_events se ON se.customer_id = c.id
            WHERE c.account_stage != 'churned'
            ORDER BY c.id, c.arr DESC
        """)
        rows = cur.fetchall()
    finally:
        release_conn(conn)

    all_account_scores = [_score_account(row) for row in rows]

    highest_account = max(
        all_account_scores, key=lambda a: a['security_score'],
        default=None)
    at_risk_accounts = [a for a in all_account_scores
                         if a['security_score'] >= 0.4]

    overall_confidence = (highest_account['security_score']
                           if highest_account else 0.0)

    if overall_confidence >= 0.8:
        severity = 'critical'
    elif overall_confidence >= 0.5:
        severity = 'high'
    elif overall_confidence >= 0.3:
        severity = 'medium'
    else:
        severity = 'low'

    evidence = {
        'agent': 'security',
        'signal': 'SecurityAnomaly',
        'description': (
            f"{len(at_risk_accounts)} accounts with anomalous "
            f"activity. Highest risk: {highest_account['name']}. "
            f"API spike: {highest_account['api_calls']:.0f}/hr "
            f"vs baseline {highest_account['baseline']:.0f}/hr."
        ) if highest_account else "No security data available.",
        'confidence': round(overall_confidence, 3),
        'severity': severity,
        'impact_area': 'security',
        'affected_customers': [a['name'] for a in at_risk_accounts],
        'data': {
            'accounts': all_account_scores,
            'highest_risk_account': (
                highest_account['name'] if highest_account else None),
            'max_anomaly_score': (
                highest_account['anomaly_score']
                if highest_account else 0.0)
        }
    }

    conn = get_conn()
    try:
        cur = conn.cursor()
        cur.execute(
            "INSERT INTO agent_events "
            "(agent_type, event_type, severity, payload) "
            "VALUES (%s, %s, %s, %s)",
            ('security', 'SecurityAnomaly', severity,
             json.dumps(evidence)))
        conn.commit()
    finally:
        release_conn(conn)

    publish_event('magnivonic.security', 'SecurityAnomaly', evidence)

    log('evidence_produced', signal='SecurityAnomaly',
        confidence=evidence['confidence'], severity=severity,
        affected_count=len(at_risk_accounts))

    return evidence


def _fallback_evidence(reason: str) -> dict:
    return {
        'agent': 'security',
        'signal': 'SecurityAnomaly',
        'description': f'Security analysis unavailable: {reason}',
        'confidence': 0.2,
        'severity': 'low',
        'impact_area': 'security',
        'affected_customers': [],
        'data': {}
    }
