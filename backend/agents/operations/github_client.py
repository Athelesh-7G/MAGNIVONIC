from datetime import datetime, timezone
import requests
import json

BASE = "https://api.github.com"

def _headers(token):
    return {
        "Authorization": f"token {token}",
        "Accept": "application/vnd.github.v3+json"
    }

def _get(url, token, params=None):
    try:
        r = requests.get(url, headers=_headers(token),
                        params=params,
                        timeout=(5, 10))
        r.raise_for_status()
        return r.json()
    except Exception as e:
        _log("github_api_error", url=url, error=str(e))
        return None

def get_open_prs(owner, repo, token):
    data = _get(f"{BASE}/repos/{owner}/{repo}/pulls",
                token, params={"state": "open", "per_page": 30})
    if data is None:
        return {"count": 0, "titles": [], "error": True}
    return {"count": len(data),
            "titles": [p["title"] for p in data[:5]],
            "error": False}

def get_blocker_issues(owner, repo, token):
    data = _get(f"{BASE}/repos/{owner}/{repo}/issues",
                token, params={"labels": "blocker",
                               "state": "open", "per_page": 30})
    if data is None:
        return {"count": 0, "issues": [], "error": True}
    # Filter out pull requests (GitHub returns PRs in issues API)
    issues = [i for i in data if "pull_request" not in i]
    return {"count": len(issues),
            "issues": [i["title"] for i in issues[:5]],
            "error": False}

def get_recent_failures(owner, repo, token):
    data = _get(
        f"{BASE}/repos/{owner}/{repo}/actions/runs",
        token, params={"status": "failure", "per_page": 5})
    if data is None:
        return {"count": 0, "runs": [], "error": True}
    runs = data.get("workflow_runs", [])
    return {"count": data.get("total_count", 0),
            "runs": [r["name"] for r in runs[:5]],
            "error": False}

def get_commit_velocity(owner, repo, token):
    data = _get(f"{BASE}/repos/{owner}/{repo}/commits",
                token, params={"per_page": 60})
    if data is None:
        return {"commits_7d": 0, "commits_14d": 0,
                "trend": "unknown", "error": True}
    now = datetime.now(timezone.utc)
    c7, c14 = 0, 0
    for c in data:
        try:
            dt_str = c["commit"]["author"]["date"]
            dt = datetime.fromisoformat(
                dt_str.replace("Z", "+00:00"))
            age = (now - dt).days
            if age <= 7:  c7 += 1
            if age <= 14: c14 += 1
        except Exception:
            continue
    # Compare 7-day to expected half of 14-day
    expected_7d = c14 / 2 if c14 > 0 else 0
    if expected_7d == 0:
        trend = "stable"
    elif c7 >= expected_7d * 1.2:
        trend = "increasing"
    elif c7 <= expected_7d * 0.8:
        trend = "decreasing"
    else:
        trend = "stable"
    return {"commits_7d": c7, "commits_14d": c14,
            "trend": trend, "error": False}

def get_all_signals(owner, repo, token):
    return {
        "open_prs":        get_open_prs(owner, repo, token),
        "blocker_issues":  get_blocker_issues(owner, repo, token),
        "recent_failures": get_recent_failures(owner, repo, token),
        "commit_velocity": get_commit_velocity(owner, repo, token),
    }

def _log(event, **kwargs):
    print(json.dumps({
        "service": "magnivonic",
        "component": "github_client",
        "event": event, **kwargs}))
