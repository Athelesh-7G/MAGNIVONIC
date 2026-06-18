# Secrets Manager helper
import boto3, json
from datetime import datetime, timezone

_client = None
_cache = {}


def _get_client():
    global _client
    if _client is None:
        _client = boto3.client('secretsmanager',
                               region_name='us-east-1')
    return _client


def get_secret(secret_name: str) -> str:
    """
    Returns raw secret string value.
    Callers must parse JSON themselves if needed.
    Caches result for warm Lambda container reuse.
    """
    if secret_name in _cache:
        _log('cache_hit', secret=secret_name)
        return _cache[secret_name]

    _log('cache_miss', secret=secret_name)
    try:
        response = _get_client().get_secret_value(
            SecretId=secret_name)
        value = response.get('SecretString', '')
        _cache[secret_name] = value
        _log('secret_retrieved', secret=secret_name)
        return value
    except Exception as e:
        _log('secret_error', secret=secret_name, error=str(e))
        raise RuntimeError(
            f"Failed to retrieve secret '{secret_name}': {e}")


def _log(event: str, **kwargs):
    print(json.dumps({
        'service': 'magnivonic',
        'component': 'secrets',
        'event': event,
        'timestamp': datetime.now(timezone.utc).isoformat(),
        **kwargs
    }))
