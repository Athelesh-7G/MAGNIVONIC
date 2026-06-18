# GET /risks — returns active risks
import json
from datetime import datetime, timezone

CORS_HEADERS = {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET,POST,OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type'
}


def log(event_name: str, **kwargs):
    print(json.dumps({
        'service': 'magnivonic',
        'api': 'risks',
        'event': event_name,
        'timestamp': datetime.now(timezone.utc).isoformat(),
        **kwargs
    }))


def handler(event: dict, context) -> dict:
    if event.get('httpMethod') == 'OPTIONS':
        return {'statusCode': 200, 'headers': CORS_HEADERS,
                'body': ''}

    log('risks_invoked')

    return {
        'statusCode': 200,
        'headers': CORS_HEADERS,
        'body': json.dumps({
            'status': 'skeleton',
            'message': ('Risks endpoint ready. Will return active risks '
                        'from the Aurora risks table.'),
            'risks': [],
            'timestamp': datetime.now(timezone.utc).isoformat()
        })
    }
