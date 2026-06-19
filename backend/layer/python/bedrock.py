# Bedrock Nova Pro + Titan Embed clients
import boto3, json
from datetime import datetime, timezone

_client = None


def _get_client():
    global _client
    if _client is None:
        _client = boto3.client('bedrock-runtime',
                               region_name='us-east-1')
    return _client


def invoke_nova_pro(system_prompt: str,
                    user_content: str,
                    max_tokens: int = 1000) -> str:
    _log('nova_pro_invoking')
    body = {
        "messages": [
            {"role": "user", "content": [{"text": user_content}]}
        ],
        "system": [{"text": system_prompt}],
        "inferenceConfig": {"max_new_tokens": max_tokens}
    }
    try:
        response = _get_client().invoke_model(
            modelId='us.amazon.nova-pro-v1:0',
            body=json.dumps(body),
            contentType='application/json',
            accept='application/json'
        )
        result = json.loads(response['body'].read())
        text = result['output']['message']['content'][0]['text']
        usage = result.get('usage', {})
        _log('nova_pro_success',
             input_tokens=usage.get('inputTokens', 0),
             output_tokens=usage.get('outputTokens', 0))
        return text
    except Exception as e:
        _log('nova_pro_error', error=str(e))
        raise RuntimeError(f"Nova Pro invocation failed: {e}")


def invoke_titan_embed(text: str) -> list:
    _log('titan_embed_invoking',
         text_length=len(text))
    body = {"inputText": text,
            "dimensions": 1024,
            "normalize": True}
    try:
        response = _get_client().invoke_model(
            modelId='amazon.titan-embed-text-v2:0',
            body=json.dumps(body),
            contentType='application/json',
            accept='application/json'
        )
        result = json.loads(response['body'].read())
        embedding = result['embedding']
        _log('titan_embed_success',
             dimensions=len(embedding))
        return embedding
    except Exception as e:
        _log('titan_embed_error', error=str(e))
        raise RuntimeError(
            f"Titan Embed invocation failed: {e}")


def _log(event: str, **kwargs):
    print(json.dumps({
        'service': 'magnivonic',
        'component': 'bedrock',
        'event': event,
        'timestamp': datetime.now(timezone.utc).isoformat(),
        **kwargs
    }))
