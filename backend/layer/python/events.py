# EventBridge publisher
import boto3, json, os
from datetime import datetime, timezone

_client = None
BUS_NAME = os.environ.get('EVENTBRIDGE_BUS_NAME',
                           'magnivonic-events')


def _get_client():
    global _client
    if _client is None:
        _client = boto3.client('events',
                               region_name='us-east-1')
    return _client


def publish_event(source: str,
                  detail_type: str,
                  detail: dict) -> None:
    try:
        _get_client().put_events(Entries=[{
            'Source': source,
            'DetailType': detail_type,
            'Detail': json.dumps(detail),
            'EventBusName': BUS_NAME
        }])
        _log('published', source=source,
             detail_type=detail_type)
    except Exception as e:
        _log('publish_error', source=source,
             detail_type=detail_type, error=str(e))
        # Do NOT raise — agent flow must not fail
        # because EventBridge fails


def _log(event: str, **kwargs):
    print(json.dumps({
        'service': 'magnivonic',
        'component': 'events',
        'event': event,
        'timestamp': datetime.now(timezone.utc).isoformat(),
        **kwargs
    }))
