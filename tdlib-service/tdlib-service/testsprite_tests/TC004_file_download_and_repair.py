import requests
import time

BASE_URL = "http://localhost:3001"
JWT_TOKEN = "backend_jwt_token"  # replace with actual JWT token
API_KEY = "test_api_key"  # replace with actual API key if required

HEADERS_AUTH = {
    "Authorization": f"Bearer {JWT_TOKEN}",
    "X-API-Key": API_KEY
}

TIMEOUT = 30

def test_file_download_and_repair():
    # Step 1: Upload a file first to get a valid remoteFileId for testing download and repair endpoints
    upload_url = f"{BASE_URL}/api/upload/"
    files = {
        'file': ('testfile.txt', b'This is test file content for download and repair test.', 'text/plain')
    }
    # Using Authorization Bearer header and API key (auth_required)
    try:
        upload_resp = requests.post(upload_url, headers=HEADERS_AUTH, files=files, timeout=TIMEOUT)
        assert upload_resp.status_code == 200, f"Upload failed with status {upload_resp.status_code}: {upload_resp.text}"
    except Exception as e:
        raise AssertionError(f"Upload step failed: {e}")

    upload_data = upload_resp.json()
    remoteFileId = upload_data.get('remoteFileId') or upload_data.get('telegram_file_id')
    assert remoteFileId, "remoteFileId not returned in upload response"

    try:
        # --- Happy path: GET /api/download/:remoteFileId full file (200) ---
        download_url = f"{BASE_URL}/api/download/{remoteFileId}"
        resp_full = requests.get(download_url, headers=HEADERS_AUTH, timeout=TIMEOUT, stream=True)
        assert resp_full.status_code == 200, f"Full download failed with status {resp_full.status_code}"
        content_full = resp_full.raw.read()
        assert content_full, "Full download response empty"

        # --- Happy path: GET /api/download/:remoteFileId with Range header (206 Partial Content) ---
        headers_range = HEADERS_AUTH.copy()
        headers_range["Range"] = "bytes=5-15"
        resp_range = requests.get(download_url, headers=headers_range, timeout=TIMEOUT, stream=True)
        assert resp_range.status_code == 206, f"Range download failed with status {resp_range.status_code}"
        content_range = resp_range.raw.read()
        assert content_range, "Range download response empty"
        assert len(content_range) <= 11, "Range download content length unexpected"

        # --- Happy path: GET /api/dl/:remoteFileId with valid signed URL validation (simulate valid signature) ---
        # Invalid signature test
        dl_url_invalid = f"{BASE_URL}/api/dl/{remoteFileId}?signature=invalidsignature"
        resp_dl_invalid = requests.get(dl_url_invalid, timeout=TIMEOUT, stream=True)
        assert resp_dl_invalid.status_code in (401, 403), f"Invalid signature did not produce expected auth error but {resp_dl_invalid.status_code}"

        # --- Happy path: GET /api/download/status/:remoteFileId ---
        status_url = f"{BASE_URL}/api/download/status/{remoteFileId}"
        resp_status = requests.get(status_url, headers=HEADERS_AUTH, timeout=TIMEOUT)
        assert resp_status.status_code == 200, f"Cache status failed with status {resp_status.status_code}"
        status_json = resp_status.json()
        assert isinstance(status_json, dict), "Cache status response not JSON"
        assert "cached" in status_json and isinstance(status_json["cached"], bool), "Cache status missing or invalid 'cached' field"

        # --- Happy path: POST /api/download/repair ---
        repair_url = f"{BASE_URL}/api/download/repair"
        repair_payload = {"remoteFileId": remoteFileId}
        resp_repair = requests.post(repair_url, headers={**HEADERS_AUTH, "Content-Type": "application/json"}, json=repair_payload, timeout=TIMEOUT)
        assert resp_repair.status_code == 202, f"Repair request failed with status {resp_repair.status_code}"
        repair_json = resp_repair.json()
        assert "repairJobId" in repair_json, "Repair response missing 'repairJobId'"

        repairJobId = repair_json["repairJobId"]

        # Wait and poll the status endpoint to confirm repair reflected
        for _ in range(10):
            resp_status_after = requests.get(status_url, headers=HEADERS_AUTH, timeout=TIMEOUT)
            if resp_status_after.status_code == 200:
                status_after_json = resp_status_after.json()
                if "lastUpdated" in status_after_json:
                    break
            time.sleep(2)
        else:
            assert False, "Repair cache status not updated after waiting"

        # --- Error scenario: GET /api/download/:remoteFileId with non-existent file (expect 404) ---
        non_exist_id = "nonexistentremotefileid12345"
        resp_notfound = requests.get(f"{BASE_URL}/api/download/{non_exist_id}", headers=HEADERS_AUTH, timeout=TIMEOUT)
        assert resp_notfound.status_code == 404, f"Non-existent file did not produce 404 but {resp_notfound.status_code}"

        # --- Error scenario: GET /api/dl/:remoteFileId with tampered signature (expect 401 or 403) ---
        # Already tested above with invalid signature

    finally:
        # Clean up: No delete endpoint described, so skip
        pass

test_file_download_and_repair()
