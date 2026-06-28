# GET /github — real, read-only GitHub delivery signals for the demo repo.
# Exposes directly what the Operations agent already reads internally (open PRs,
# blocker issues, CI failures, commit velocity) so the raw delivery feed is
# reachable on its own, not only buried inside CoordinationGap evidence.
import json
import os
import sys
from datetime import datetime, timezone

sys.path.insert(0, '/opt/python')
from secrets import get_secret  # noqa: E402  (Lambda layer)
from github_client import get_all_signals  # noqa: E402  (bundled sibling)

CORS_HEADERS = {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET,POST,OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type'
}

GITHUB_SECRET_NAME = 'magnivonic/github-pat'


def log(event_name: str, **kwargs):
    print(json.dumps({
        'service': 'magnivonic', 'api': 'github', 'event': event_name,
        'timestamp': datetime.now(timezone.utc).isoformat(), **kwargs
    }))


def handler(event: dict, context) -> dict:
    if event.get('httpMethod') == 'OPTIONS':
        return {'statusCode': 200, 'headers': CORS_HEADERS, 'body': ''}

    owner = os.environ.get('GITHUB_OWNER', 'Athelesh-7G')
    repo = os.environ.get('GITHUB_REPO', 'magnivonic-demo')
    repo_url = f'https://github.com/{owner}/{repo}'

    try:
        token = get_secret(GITHUB_SECRET_NAME).strip()
    except Exception:
        log('github_secret_missing')
        # Honest disconnected state — no fabricated signals.
        return {
            'statusCode': 200, 'headers': CORS_HEADERS,
            'body': json.dumps({
                'connected': False,
                'repo': f'{owner}/{repo}',
                'repo_url': repo_url,
                'signals': None,
                'checked_at': datetime.now(timezone.utc).isoformat(),
            })
        }

    signals = get_all_signals(owner, repo, token)
    # connected = the GitHub API actually answered (no per-call error flags)
    any_error = any(
        isinstance(v, dict) and v.get('error') for v in signals.values()
    )
    log('github_signals_read', any_error=any_error)

    return {
        'statusCode': 200, 'headers': CORS_HEADERS,
        'body': json.dumps({
            'connected': not any_error,
            'repo': f'{owner}/{repo}',
            'repo_url': repo_url,
            'signals': signals,
            'checked_at': datetime.now(timezone.utc).isoformat(),
        })
    }
