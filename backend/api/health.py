# GET /health — service healthcheck
import json
from datetime import datetime, timezone

SERVICE_VERSION = '0.1.0'

CORS_HEADERS = {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET,POST,OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type'
}


def log(event_name: str, **kwargs):
    print(json.dumps({
        'service': 'magnivonic',
        'api': 'health',
        'event': event_name,
        'timestamp': datetime.now(timezone.utc).isoformat(),
        **kwargs
    }))


def handler(event: dict, context) -> dict:
    if event.get('httpMethod') == 'OPTIONS':
        return {'statusCode': 200, 'headers': CORS_HEADERS,
                'body': ''}

    log('healthcheck')
    return {
        'statusCode': 200,
        'headers': CORS_HEADERS,
        'body': json.dumps({
            'service': 'magnivonic',
            'status': 'healthy',
            'version': SERVICE_VERSION,
            'timestamp': datetime.now(timezone.utc).isoformat()
        })
    }
