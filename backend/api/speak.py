# POST /speak — convert a chat ANSWER (text only) to speech via Amazon Polly.
# Returns base64-encoded MP3 in the JSON body (no S3/presign). Neural voice.
# This is a real second output modality (Polly); Nova Pro does not generate audio.
import base64
import json
from datetime import datetime, timezone

import boto3

CORS_HEADERS = {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'POST,OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
}

VOICE_ID = 'Matthew'   # one good en-US neural voice; no picker
MAX_CHARS = 2900       # well under Polly's per-request limit


def log(event_name: str, **kwargs):
    print(json.dumps({
        'service': 'magnivonic', 'api': 'speak', 'event': event_name,
        'timestamp': datetime.now(timezone.utc).isoformat(), **kwargs
    }))


def handler(event: dict, context) -> dict:
    if event.get('httpMethod') == 'OPTIONS':
        return {'statusCode': 200, 'headers': CORS_HEADERS, 'body': ''}

    try:
        body = json.loads(event.get('body') or '{}')
    except Exception:
        body = {}
    text = (body.get('text') or '').strip()
    if not text:
        return {'statusCode': 400, 'headers': CORS_HEADERS,
                'body': json.dumps({'error': 'text is required'})}
    text = text[:MAX_CHARS]

    try:
        polly = boto3.client('polly', region_name='us-east-1')
        resp = polly.synthesize_speech(
            Text=text, OutputFormat='mp3', VoiceId=VOICE_ID, Engine='neural')
        audio = resp['AudioStream'].read()
        b64 = base64.b64encode(audio).decode('ascii')
        log('synthesized', chars=len(text), bytes=len(audio), voice=VOICE_ID)
        return {'statusCode': 200, 'headers': CORS_HEADERS,
                'body': json.dumps({'audio': b64, 'format': 'mp3', 'voice': VOICE_ID})}
    except Exception as e:
        log('synthesis_failed', error=str(e))
        return {'statusCode': 500, 'headers': CORS_HEADERS,
                'body': json.dumps({'error': 'Speech synthesis failed'})}
