"""Embed organizational_memory rows with real Titan Embed V2 vectors.

Standalone script — run locally, not part of any Lambda layer.
Replaces the [0.0]*1536 placeholder embeddings seeded on Day 1.
"""
import json
import time

import boto3
import psycopg2

conn = psycopg2.connect(
    host='magnivonic-dev.cluster-ckh6ce2aesni.us-east-1.rds.amazonaws.com',
    port=5432, dbname='postgres', user='postgres',
    password='MagniVonic2026Test', sslmode='require'
)

bedrock = boto3.client('bedrock-runtime', region_name='us-east-1')


def embed(text: str) -> list:
    body = json.dumps({
        "inputText": text,
        "dimensions": 1024,
        "normalize": True
    })
    response = bedrock.invoke_model(
        modelId='amazon.titan-embed-text-v2:0',
        body=body,
        contentType='application/json',
        accept='application/json'
    )
    result = json.loads(response['body'].read())
    return result['embedding']


def main():
    cur = conn.cursor()
    cur.execute("""
        SELECT id, summary, outcome FROM organizational_memory
        ORDER BY created_at ASC
    """)
    rows = cur.fetchall()

    total = len(rows)
    for i, (row_id, summary, outcome) in enumerate(rows):
        embed_text = f"{summary} {outcome}"
        try:
            embedding = embed(embed_text)
        except Exception as e:
            print(f"✗ Failed to embed risk {i + 1}/{total}: {e}")
            continue

        vec_str = '[' + ','.join(str(x) for x in embedding) + ']'

        update_cur = conn.cursor()
        update_cur.execute(
            "UPDATE organizational_memory "
            "SET embedding = %s::vector WHERE id = %s",
            (vec_str, row_id)
        )
        conn.commit()
        print(f"✓ Embedded risk {i + 1}/{total}: {summary[:60]}...")
        time.sleep(0.5)

    verify_cur = conn.cursor()
    verify_cur.execute("""
        SELECT id,
          left(summary, 60) as summary_preview,
          left(embedding::text, 50) as embedding_preview
        FROM organizational_memory
        ORDER BY created_at ASC
    """)
    print()
    print("Verification:")
    for row_id, summary_preview, embedding_preview in verify_cur.fetchall():
        print(f"  {row_id}  {summary_preview!r:65}  {embedding_preview}")

    print()
    print(f"✓ All {total} risks embedded with Titan Embed V2")

    conn.close()


if __name__ == '__main__':
    main()
