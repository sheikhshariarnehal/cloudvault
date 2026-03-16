import requests
import time

BASE_URL = "http://localhost:3001"
ADMIN_BEARER_TOKEN = "your_admin_bearer_token_here"  # Replace with actual admin Bearer token

HEADERS = {
    "Authorization": f"Bearer {ADMIN_BEARER_TOKEN}"
}

TIMEOUT = 30


def test_admin_and_diagnostics_endpoints():
    # 1) GET /api/admin/storage/stats with valid admin token
    stats_resp = requests.get(f"{BASE_URL}/api/admin/storage/stats", headers=HEADERS, timeout=TIMEOUT)
    assert stats_resp.status_code == 200
    stats_json = stats_resp.json()
    assert isinstance(stats_json, dict) and len(stats_json) > 0

    # 2) POST /api/admin/storage/cleanup targeted cleanup
    cleanup_payload = {"target": "uploads", "olderThan": "2026-01-01"}
    cleanup_resp = requests.post(f"{BASE_URL}/api/admin/storage/cleanup", json=cleanup_payload, headers=HEADERS, timeout=TIMEOUT)
    assert cleanup_resp.status_code == 200
    cleanup_json = cleanup_resp.json()
    assert "jobId" in cleanup_json and cleanup_json["jobId"]

    # 3) POST /api/admin/storage/uploads/cleanup
    uploads_cleanup_resp = requests.post(f"{BASE_URL}/api/admin/storage/uploads/cleanup", headers=HEADERS, timeout=TIMEOUT)
    assert uploads_cleanup_resp.status_code == 200
    uploads_cleanup_json = uploads_cleanup_resp.json()
    assert "summary" in uploads_cleanup_json

    # 4) POST /api/admin/storage/cleanup/all - test success and error handling for failure

    full_cleanup_resp = requests.post(f"{BASE_URL}/api/admin/storage/cleanup/all", headers=HEADERS, timeout=TIMEOUT)
    # The response may be 200 or 202 if successful
    assert full_cleanup_resp.status_code in (200, 202)
    if full_cleanup_resp.status_code == 200:
        full_cleanup_json = full_cleanup_resp.json()
        # Accept either a jobId or summary or empty body logically
        assert full_cleanup_json.get("jobId") or ("summary" in full_cleanup_json) or full_cleanup_json == {}
    else:
        # 202 usually means job accepted, may return a jobId
        full_cleanup_json = full_cleanup_resp.json()
        assert "jobId" in full_cleanup_json and full_cleanup_json["jobId"]

    # Simulate cleanup failure by attempting call with missing/bad Authorization header (expect 500 or 401/403)
    bad_auth_headers = {"Authorization": "Bearer invalidtoken"}
    cleanup_fail_resp = requests.post(f"{BASE_URL}/api/admin/storage/cleanup/all", headers=bad_auth_headers, timeout=TIMEOUT)
    assert cleanup_fail_resp.status_code in (401, 403, 500)

    # 5) POST /api/admin/cache/clear
    cache_clear_resp = requests.post(f"{BASE_URL}/api/admin/cache/clear", headers=HEADERS, timeout=TIMEOUT)
    assert cache_clear_resp.status_code == 200
    cache_clear_json = cache_clear_resp.json()
    assert cache_clear_json.get("message") or cache_clear_json.get("status") or cache_clear_json == {}

    # 6) POST /api/admin/tdlib/optimize
    optimize_resp = requests.post(f"{BASE_URL}/api/admin/tdlib/optimize", headers=HEADERS, timeout=TIMEOUT)
    assert optimize_resp.status_code == 200
    optimize_json = optimize_resp.json()
    assert "scheduled" in optimize_json or "message" in optimize_json or optimize_json == {}

    # 7) GET /api/admin/metrics
    metrics_resp = requests.get(f"{BASE_URL}/api/admin/metrics", headers=HEADERS, timeout=TIMEOUT)
    assert metrics_resp.status_code == 200
    metrics_json = metrics_resp.json()
    assert isinstance(metrics_json, dict)
    # Sample keys to verify presence if possible
    assert any(k in metrics_json for k in ["cpu_usage", "memory_usage", "uptime", "requests"])

    # 8) GET /api/admin/logs
    logs_resp = requests.get(f"{BASE_URL}/api/admin/logs", headers=HEADERS, timeout=TIMEOUT)
    assert logs_resp.status_code == 200
    logs_content = logs_resp.content
    assert logs_content  # Should not be empty bytes


    # 9) Authorization Enforcement: try admin endpoint without or wrong token -> expect 401 or 403
    no_auth_resp = requests.get(f"{BASE_URL}/api/admin/storage/stats", timeout=TIMEOUT)
    assert no_auth_resp.status_code in (401, 403)

    wrong_auth_resp = requests.get(f"{BASE_URL}/api/admin/storage/stats", headers={"Authorization": "Bearer badtoken"}, timeout=TIMEOUT)
    assert wrong_auth_resp.status_code in (401, 403)


test_admin_and_diagnostics_endpoints()
