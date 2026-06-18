import json
import os
import sys
from datetime import datetime, timezone

sys.path.insert(0, '/opt/python')
from secrets import get_secret
from events import publish_event
from db import get_conn, release_conn
from github_client import get_all_signals

AGENT_NAME = "operations"

def log(event_name, **kwargs):
    print(json.dumps({
        "service": "magnivonic", "agent": AGENT_NAME,
        "event": event_name,
        "timestamp": datetime.now(timezone.utc).isoformat(),
        **kwargs}))

def handler(event, context):
    log("agent_invoked",
        trigger=event.get("trigger", "direct"),
        request_id=getattr(context, "aws_request_id", "local"))
    try:
        result = run(event)
        log("agent_completed", status="success")
        return {"statusCode": 200, "agent": AGENT_NAME,
                "result": result}
    except Exception as e:
        log("agent_error", error=str(e), status="failed")
        return {"statusCode": 500, "agent": AGENT_NAME,
                "error": str(e)}

def run(event):
    owner = os.environ.get("GITHUB_OWNER", "Athelesh-7G")
    repo  = os.environ.get("GITHUB_REPO", "magnivonic-demo")

    # Get GitHub token — graceful fallback if not configured
    try:
        token = get_secret("magnivonic/github-pat").strip()
    except Exception:
        log("github_pat_missing")
        token = None

    if token:
        signals = get_all_signals(owner, repo, token)
        github_available = True
    else:
        signals = {
            "open_prs":        {"count": 0, "error": True},
            "blocker_issues":  {"count": 0, "error": True},
            "recent_failures": {"count": 0, "error": True},
            "commit_velocity": {"trend": "unknown", "error": True}
        }
        github_available = False

    # Risk scoring
    score = 0.0
    score += min(signals["open_prs"]["count"] * 0.05, 0.25)
    score += min(signals["blocker_issues"]["count"] * 0.15, 0.30)
    score += min(signals["recent_failures"]["count"] * 0.10, 0.20)
    if signals["commit_velocity"].get("trend") == "decreasing":
        score += 0.15
    score = min(round(score, 3), 1.0)

    if score >= 0.7:   severity = "critical"
    elif score >= 0.4: severity = "high"
    elif score >= 0.2: severity = "medium"
    else:              severity = "low"

    bl  = signals["blocker_issues"]["count"]
    pr  = signals["open_prs"]["count"]
    cf  = signals["recent_failures"]["count"]

    if not github_available:
        desc = "GitHub unavailable — engineering signals not collected."
        score = 0.0
        severity = "low"
    else:
        desc = (f"Engineering: {bl} blocker issues, {pr} open PRs, "
                f"{cf} recent CI failures.")

    evidence = {
        "agent":              "operations",
        "signal":             "DeliveryRisk",
        "description":        desc,
        "confidence":         score,
        "severity":           severity,
        "impact_area":        "coordination",
        "affected_customers": [],
        "data":               signals
    }

    # Write to Aurora
    conn = get_conn()
    try:
        cur = conn.cursor()
        cur.execute(
            "INSERT INTO agent_events "
            "(agent_type, event_type, severity, payload) "
            "VALUES (%s, %s, %s, %s)",
            ("operations", "DeliveryRisk", severity,
             json.dumps(evidence)))
        conn.commit()
    finally:
        release_conn(conn)

    publish_event("magnivonic.operations",
                  "DeliveryRisk", evidence)
    return evidence
