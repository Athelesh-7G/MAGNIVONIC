# POST /analyze — triggers full analysis
import json
import boto3
from datetime import datetime, timezone

CORS_HEADERS = {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET,POST,OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type'
}

_lambda_client = None


def _get_lambda():
    global _lambda_client
    if _lambda_client is None:
        _lambda_client = boto3.client('lambda',
                                      region_name='us-east-1')
    return _lambda_client


def log(event_name, **kwargs):
    print(json.dumps({
        'service': 'magnivonic', 'component': 'api-analyze',
        'event': event_name,
        'timestamp': datetime.now(timezone.utc).isoformat(),
        **kwargs
    }))


def handler(event, context):
    if event.get('httpMethod') == 'OPTIONS':
        return {'statusCode': 200, 'headers': CORS_HEADERS,
                'body': ''}

    log('analyze_requested')

    try:
        body = json.loads(event.get('body') or '{}')
        trigger = body.get('trigger', 'api_request')

        response = _get_lambda().invoke(
            FunctionName='magnivonic-orchestrator-agent',
            InvocationType='RequestResponse',
            Payload=json.dumps({"trigger": trigger}).encode()
        )
        payload = json.loads(response['Payload'].read())

        if payload.get('statusCode') == 200:
            result = payload.get('result', {})
            log('analyze_success',
                risk_score=result.get('overall_risk_score'),
                severity=result.get('context', {}).get(
                    'combined_severity'))
            return {
                'statusCode': 200,
                'headers': CORS_HEADERS,
                'body': json.dumps(result, default=str)
            }
        else:
            log('analyze_agent_error',
                error=payload.get('error'))
            return {
                'statusCode': 502,
                'headers': CORS_HEADERS,
                'body': json.dumps({
                    'error': 'Analysis pipeline failed',
                    'detail': payload.get('error', 'unknown')
                })
            }
    except Exception as e:
        log('analyze_exception', error=str(e))
        return {
            'statusCode': 500,
            'headers': CORS_HEADERS,
            'body': json.dumps({'error': str(e)})
        }
