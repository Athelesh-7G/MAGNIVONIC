# GET /customers — returns customer states from Aurora
import json
import sys
from datetime import datetime, timezone

sys.path.insert(0, '/opt/python')
from db import get_conn, release_conn

CORS_HEADERS = {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET,POST,OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type'
}


def handler(event, context):
    if event.get('httpMethod') == 'OPTIONS':
        return {'statusCode': 200, 'headers': CORS_HEADERS,
                'body': ''}
    conn = get_conn()
    try:
        cur = conn.cursor()
        cur.execute("""
            SELECT DISTINCT ON (c.id)
              c.id, c.name, c.arr, c.health_score,
              c.renewal_date, c.account_stage, c.cs_tier,
              COALESCE(sm.ticket_count_7d, 0) as tickets,
              COALESCE(sm.avg_sentiment_score, 0) as sentiment,
              COALESCE(sm.feature_adoption_score, 50) as adoption,
              COALESCE(se.anomaly_score, 0) as anomaly_score,
              COALESCE(se.api_calls_per_hour, 0) as api_calls,
              COALESCE(se.baseline_api_calls, 0) as api_baseline
            FROM customers c
            LEFT JOIN support_metrics sm
              ON sm.customer_id = c.id
            LEFT JOIN security_events se
              ON se.customer_id = c.id
            WHERE c.account_stage != 'churned'
            ORDER BY c.id, c.arr DESC
        """)
        cols = [d[0] for d in cur.description]
        rows = [dict(zip(cols, r)) for r in cur.fetchall()]
        for row in rows:
            row['id'] = str(row['id'])
            row['arr'] = float(row['arr'] or 0)
            row['health_score'] = int(row['health_score'] or 0)
            row['renewal_date'] = row['renewal_date'].isoformat() \
                if row['renewal_date'] else None
            row['sentiment'] = float(row['sentiment'] or 0)
            row['anomaly_score'] = float(
                row['anomaly_score'] or 0)
            row['api_calls'] = float(row['api_calls'] or 0)
            row['api_baseline'] = float(
                row['api_baseline'] or 0)
        return {
            'statusCode': 200,
            'headers': CORS_HEADERS,
            'body': json.dumps({'customers': rows,
                                'count': len(rows)},
                               default=str)
        }
    except Exception as e:
        return {
            'statusCode': 500,
            'headers': CORS_HEADERS,
            'body': json.dumps({'error': str(e)})
        }
    finally:
        release_conn(conn)
