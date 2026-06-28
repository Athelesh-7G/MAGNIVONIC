# GET /memory — read-only list of organizational_memory incidents.
# No embedding vectors in the response, no agent logic — a straight SELECT.
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
        return {'statusCode': 200, 'headers': CORS_HEADERS, 'body': ''}
    conn = get_conn()
    try:
        cur = conn.cursor()
        cur.execute("""
            SELECT id, summary, outcome, lessons_learned,
              prevented_churn, revenue_saved, contributing_agents,
              resolution_time_hours, created_at
            FROM organizational_memory
            ORDER BY created_at DESC
        """)
        cols = [d[0] for d in cur.description]
        rows = [dict(zip(cols, r)) for r in cur.fetchall()]
        for row in rows:
            row['id'] = str(row['id'])
            row['revenue_saved'] = float(row['revenue_saved'] or 0)
            row['contributing_agents'] = list(row['contributing_agents'] or [])
            row['created_at'] = row['created_at'].isoformat() \
                if row['created_at'] else None
        return {
            'statusCode': 200,
            'headers': CORS_HEADERS,
            'body': json.dumps({'memory': rows, 'count': len(rows)},
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
