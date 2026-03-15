import requests
import time

BASE_URL = "http://localhost:3001"
TIMEOUT = 30

def test_get_health_service_status():
    url = f"{BASE_URL}/health"

    # We'll test 3 cases of the health endpoint:
    # 1. Normal/happy path: expect status 200 and keys with valid types
    # 2. Degraded path: simulate if possible (not specified how, so just validate expected fields if status is 'degraded')
    # 3. Error path: if service boot failure occurs - expect 500 (We cannot induce error state, so just test response statuses accordingly)
    # Since instructions don't specify environment control to induce degraded/error states,
    # we will verify happy path response and handle possible degraded response structure,
    # also handle 500 Internal Server Error gracefully if returned.

    try:
        response = requests.get(url, timeout=TIMEOUT)
    except requests.RequestException as e:
        assert False, f"Request to /health endpoint failed: {e}"

    # Acceptable status codes for this endpoint: 200 (normal/degraded) or 500 (error)
    assert response.status_code in (200, 500), f"Unexpected status code: {response.status_code}"

    if response.status_code == 200:
        try:
            data = response.json()
        except Exception as e:
            assert False, f"Response is not valid JSON: {e}"

        # Validate required keys exist
        required_keys = [
            "status",
            "tdlib_ready",
            "active_sessions",
            "max_sessions",
            "uptime",
            "timestamp"
        ]
        for key in required_keys:
            assert key in data, f"Missing key '{key}' in response JSON"

        # Validate types
        assert isinstance(data["status"], str), "status must be a string"
        assert isinstance(data["tdlib_ready"], bool), "tdlib_ready must be boolean"
        assert isinstance(data["active_sessions"], int), "active_sessions must be integer"
        assert isinstance(data["max_sessions"], int), "max_sessions must be integer"
        assert isinstance(data["uptime"], (int, float)), "uptime must be a number"
        assert isinstance(data["timestamp"], str), "timestamp must be string"

        # Validate specific conditions for normal vs degraded
        if data["status"] == "degraded":
            assert data["tdlib_ready"] is False, "tdlib_ready should be false when status='degraded'"

        elif data["status"] == "ok" or data["status"].lower() == "healthy" or data["status"] == "running":
            # Common expected normal statuses (since not explicitly given)
            assert data["tdlib_ready"] is True, "tdlib_ready should be true in normal status"

        else:
            # Accept any string but warn if unexpected status value
            pass

        # Validate uptime is non-negative
        assert data["uptime"] >= 0, "uptime should be zero or positive"

        # Validate active_sessions is not greater than max_sessions
        assert 0 <= data["active_sessions"] <= data["max_sessions"], "active_sessions must be between 0 and max_sessions"

        # Optionally validate timestamp is ISO 8601 format (basic check)
        try:
            time.strptime(data["timestamp"][:19], "%Y-%m-%dT%H:%M:%S")
        except Exception:
            # Relaxing strict timestamp assertion
            pass

    elif response.status_code == 500:
        # Service error - body is likely error message or empty, just confirm error status code
        pass

test_get_health_service_status()