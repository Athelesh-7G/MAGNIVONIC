# GET /risks — returns active risks + recommendations from Aurora
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
            SELECT r.id, r.title, r.severity,
              r.confidence_score, r.revenue_exposure,
              r.root_cause, r.status, r.created_at,
              json_agg(json_build_object(
                'department', rec.department,
                'action', rec.action,
                'priority', rec.priority,
                'urgency_hint', rec.rationale,
                'status', rec.status
              ) ORDER BY rec.priority)
                FILTER (WHERE rec.id IS NOT NULL)
                as recommendations
            FROM risks r
            LEFT JOIN recommendations rec
              ON rec.risk_id = r.id
            WHERE r.status = 'active'
            GROUP BY r.id
            ORDER BY r.created_at DESC
            LIMIT 10
        """)
        cols = [d[0] for d in cur.description]
        rows = [dict(zip(cols, r)) for r in cur.fetchall()]
        for row in rows:
            row['id'] = str(row['id'])
            row['created_at'] = row['created_at'].isoformat() \
                if row['created_at'] else None
            row['confidence_score'] = float(
                row['confidence_score'] or 0)
            row['revenue_exposure'] = float(
                row['revenue_exposure'] or 0)
        return {
            'statusCode': 200,
            'headers': CORS_HEADERS,
            'body': json.dumps({'risks': rows,
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
