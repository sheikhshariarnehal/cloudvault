import requests
import uuid

BASE_URL = "http://localhost:3001"
TIMEOUT = 30

def test_guest_mode_file_operations():
    guest_session_id = str(uuid.uuid4())
    upload_url = f"{BASE_URL}/api/files"
    list_url = f"{BASE_URL}/api/files"
    share_url = f"{BASE_URL}/api/share"
    test_file_content = b"Hello Guest Mode File Upload"
    test_file_name = "guest_test_file.txt"

    headers_guest = {
        "X-Guest-Session": guest_session_id
    }

    # 1. Test guest file upload with X-Guest-Session header (should succeed)
    files = {
        "file": (test_file_name, test_file_content, "text/plain"),
    }
    response = requests.post(upload_url, headers=headers_guest, files=files, timeout=TIMEOUT)
    assert response.status_code == 200, f"Expected 200 but got {response.status_code}"
    data = response.json()
    assert "guest_session_id" in data and data["guest_session_id"] == guest_session_id
    assert "remoteFileId" in data or "telegram_file_id" in data, "Missing file identifier in response"
    file_id = data.get("remoteFileId") or data.get("telegram_file_id")

    # 2. Test listing files by guest_session_id (should include uploaded file)
    params = {"guest_session_id": guest_session_id}
    list_resp = requests.get(list_url, params=params, timeout=TIMEOUT)
    assert list_resp.status_code == 200, f"List files failed with {list_resp.status_code}"
    list_data = list_resp.json()
    assert isinstance(list_data, list), "File list response is not a list"
    assert any((f.get("remoteFileId") == file_id or f.get("telegram_file_id") == file_id) for f in list_data), \
        "Uploaded file not found in guest session file list"

    # 3. Test guest share link creation without Authorization but with guest session (should fail 403)
    resp_share = requests.post(share_url, headers=headers_guest, timeout=TIMEOUT)
    assert resp_share.status_code == 403, f"Guest share creation expected 403 but got {resp_share.status_code}"

    # 4. Test POST /api/files without X-Guest-Session or Authorization (should fail 401)
    resp_upload_no_auth = requests.post(upload_url, files=files, timeout=TIMEOUT)
    assert resp_upload_no_auth.status_code == 401, f"Upload missing guest/session token expected 401 but got {resp_upload_no_auth.status_code}"


test_guest_mode_file_operations()
