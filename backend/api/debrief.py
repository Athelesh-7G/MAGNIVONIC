# POST /debrief — ad-hoc natural-language query with real citation tracing.
# Additive, parallel capability: does NOT touch the Orchestrator/Coordinator/
# domain agents or the /analyze flow. Flow: embed question (Titan) -> pgvector
# similarity search over organizational_memory (real cosine scores) + relevant
# active risks -> Nova Pro answers using ONLY the retrieved evidence.
import json
import sys
from datetime import datetime, timezone

sys.path.insert(0, '/opt/python')
from db import get_conn, release_conn
from bedrock import invoke_titan_embed, invoke_nova_pro

CORS_HEADERS = {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET,POST,OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type'
}

KNOWN_DOMAINS = {'revenue', 'operations', 'customer', 'security', 'executive'}
# The four real domain teams a scoped chat can be constrained to. 'executive'
# is intentionally excluded — it is a synthesis role, not a domain team.
TEAM_DOMAINS = {'revenue', 'operations', 'customer', 'security'}

DEBRIEF_SYSTEM_PROMPT = """You are the Debrief analyst for Magnivonic, an organizational intelligence platform. A leader has asked a question. You are given ONLY a set of retrieved evidence: historical precedents from organizational memory (each with a cosine similarity score) and currently active risks.

Rules:
- Answer the question using ONLY the retrieved evidence provided. Do not introduce facts, numbers, customers, or events that are not present in the evidence.
- When you make a claim, indicate which evidence informed it by referring to the precedent's subject or the risk's title in-line (e.g. "based on the TechFlow API regression precedent…").
- Prefer higher-similarity precedents; treat low-similarity matches with appropriate caution and you may say a precedent is only loosely related.
- If the retrieved evidence is insufficient to answer the question, say so plainly rather than guessing.
- Be concise and executive in tone: 3 to 6 sentences. Return prose only — no JSON, no markdown headings, no bullet lists."""


def handler(event, context):
    if event.get('httpMethod') == 'OPTIONS':
        return {'statusCode': 200, 'headers': CORS_HEADERS, 'body': ''}

    try:
        body = json.loads(event.get('body') or '{}')
        question = (body.get('question') or '').strip()
        if not question:
            return {'statusCode': 400, 'headers': CORS_HEADERS,
                    'body': json.dumps({'error': 'A question is required.'})}

        # Optional per-team scoping. When present, the constraint is pushed into
        # the SQL (a WHERE/EXISTS filter applied BEFORE the LIMIT) so retrieval
        # genuinely searches only that domain's corpus — not a post-hoc filter
        # of an already-truncated broad result. Unknown/invalid values are
        # ignored (treated as unscoped) rather than erroring.
        department = (body.get('department') or '').strip().lower() or None
        if department not in TEAM_DOMAINS:
            department = None

        # 1 & 2 — embed the question with Titan Embed V2 (1024-dim).
        embedding = invoke_titan_embed(question)
        vec_str = '[' + ','.join(str(x) for x in embedding) + ']'

        # 3 & 4 — real pgvector similarity search + relevant active risks.
        conn = get_conn()
        try:
            cur = conn.cursor()

            # Memory: the domain filter is a WHERE on contributing_agents (TEXT[]),
            # applied before the LIMIT so a narrow team can't be starved by
            # broad-but-irrelevant higher-similarity rows ranking ahead of it.
            if department:
                cur.execute("""
                    SELECT summary, outcome, lessons_learned, contributing_agents,
                      prevented_churn, revenue_saved,
                      1 - (embedding <=> %s::vector) as similarity
                    FROM organizational_memory
                    WHERE %s = ANY(contributing_agents)
                    ORDER BY embedding <=> %s::vector
                    LIMIT 5
                """, (vec_str, department, vec_str))
            else:
                cur.execute("""
                    SELECT summary, outcome, lessons_learned, contributing_agents,
                      prevented_churn, revenue_saved,
                      1 - (embedding <=> %s::vector) as similarity
                    FROM organizational_memory
                    ORDER BY embedding <=> %s::vector
                    LIMIT 5
                """, (vec_str, vec_str))
            mem_cols = [d[0] for d in cur.description]
            mem_rows = [dict(zip(mem_cols, r)) for r in cur.fetchall()]

            # Risks: scoped to those with a directive for this team via EXISTS,
            # again before the LIMIT.
            if department:
                cur.execute("""
                    SELECT r.id, r.title, r.severity, r.confidence_score,
                      r.revenue_exposure, r.root_cause, r.created_at,
                      json_agg(rec.department) FILTER (WHERE rec.id IS NOT NULL)
                        as departments
                    FROM risks r
                    LEFT JOIN recommendations rec ON rec.risk_id = r.id
                    WHERE r.status = 'active'
                      AND EXISTS (
                        SELECT 1 FROM recommendations rec2
                        WHERE rec2.risk_id = r.id AND rec2.department = %s
                      )
                    GROUP BY r.id
                    ORDER BY r.created_at DESC
                    LIMIT 5
                """, (department,))
            else:
                cur.execute("""
                    SELECT r.id, r.title, r.severity, r.confidence_score,
                      r.revenue_exposure, r.root_cause, r.created_at,
                      json_agg(rec.department) FILTER (WHERE rec.id IS NOT NULL)
                        as departments
                    FROM risks r
                    LEFT JOIN recommendations rec ON rec.risk_id = r.id
                    WHERE r.status = 'active'
                    GROUP BY r.id
                    ORDER BY r.created_at DESC
                    LIMIT 5
                """)
            risk_cols = [d[0] for d in cur.description]
            risk_rows = [dict(zip(risk_cols, r)) for r in cur.fetchall()]
        finally:
            release_conn(conn)

        # Build precedents with real similarity scores.
        precedents = [{
            'summary': m['summary'],
            'outcome': m['outcome'],
            'lessons_learned': m['lessons_learned'],
            'similarity': round(float(m['similarity']), 3),
        } for m in mem_rows]

        # evidence_used — the real risk rows passed to the model.
        evidence_used = [{
            'id': str(r['id']),
            'title': r['title'],
            'severity': r['severity'],
            'confidence_score': float(r['confidence_score'] or 0),
            'revenue_exposure': float(r['revenue_exposure'] or 0),
            'root_cause': r['root_cause'],
            'created_at': r['created_at'].isoformat() if r['created_at'] else None,
        } for r in risk_rows]

        # agents_consulted — honestly derived from what was actually retrieved:
        # the domains represented in matched memory rows + active-risk directives.
        agents = set()
        for m in mem_rows:
            for a in (m['contributing_agents'] or []):
                if a in KNOWN_DOMAINS:
                    agents.add(a)
        for r in risk_rows:
            for d in (r['departments'] or []):
                if d in KNOWN_DOMAINS:
                    agents.add(d)
        agents_consulted = sorted(agents)

        # Honest zero: if a scoped query retrieved no precedent AND no active
        # risk for this team, say so plainly instead of asking Nova to answer
        # from nothing (which risks a confident-sounding non-answer). This is
        # only safe under a scope — an unscoped empty result is a real
        # data-availability problem worth letting the model address.
        if department and not precedents and not evidence_used:
            return {
                'statusCode': 200,
                'headers': CORS_HEADERS,
                'body': json.dumps({
                    'answer': f'No {department} precedent or active {department}-directed '
                              f'risk was found for this question. Nothing was searched outside '
                              f'the {department} team’s scope.',
                    'agents_consulted': agents_consulted,
                    'precedents': precedents,
                    'evidence_used': evidence_used,
                    'department': department,
                }, default=str)
            }

        # 5 — Nova Pro answers using ONLY the retrieved evidence.
        scope_note = (
            f'\n\nThis query is scoped to the {department} team only: the evidence below '
            f'was retrieved exclusively from {department}-related memory and '
            f'{department}-directed active risks. Answer for the {department} team and do '
            f'not imply other domains were searched.'
            if department else ''
        )
        nova_input = {
            'question': question,
            'scope': department or 'organization-wide',
            'memory_precedents': [{
                'summary': p['summary'],
                'outcome': p['outcome'],
                'lessons_learned': p['lessons_learned'],
                'similarity': p['similarity'],
            } for p in precedents],
            'active_risks': [{
                'title': e['title'],
                'severity': e['severity'],
                'root_cause': e['root_cause'],
            } for e in evidence_used],
        }
        answer = invoke_nova_pro(
            DEBRIEF_SYSTEM_PROMPT + scope_note,
            json.dumps(nova_input, indent=2, default=str),
            max_tokens=800,
        ).strip()

        return {
            'statusCode': 200,
            'headers': CORS_HEADERS,
            'body': json.dumps({
                'answer': answer,
                'agents_consulted': agents_consulted,
                'precedents': precedents,
                'evidence_used': evidence_used,
                'department': department,
            }, default=str)
        }
    except Exception as e:
        return {
            'statusCode': 500,
            'headers': CORS_HEADERS,
            'body': json.dumps({'error': str(e)})
        }
