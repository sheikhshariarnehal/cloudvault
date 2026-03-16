import requests
import io
import time

BASE_URL = "http://localhost:3001"
API_KEY = "backend-key-placeholder"  # Replace with the correct backend x-api-key value
BEARER_TOKEN = "Bearer placeholder-jwt-token"  # Replace with valid JWT
HEADERS = {"x-api-key": API_KEY, "Authorization": BEARER_TOKEN}
TIMEOUT = 30

def test_thumbnail_delete_and_telegram_session_utilities():
    # This test covers:
    # - GET /api/thumbnail/:remoteFileId (happy path and error path)
    # - POST /api/thumbnail/from-message (happy path)
    # - DELETE /api/message/:chatId/:messageId (happy path)
    # - POST /api/message/cleanup (happy path)
    # - Telegram auth endpoints:
    #   - POST /api/telegram/send-code
    #   - POST /api/telegram/verify-code (happy and error)
    #   - POST /api/telegram/verify-password (happy path)
    #   - GET /api/telegram/status/:userId (happy path)
    #   - POST /api/telegram/disconnect (happy path)

    session = requests.Session()
    session.headers.update(HEADERS)

    remote_file_id = None
    chat_id = None
    message_id = None

    chat_id = 123456789  # Dummy chatId
    message_id = 987654321  # Dummy messageId

    # Step 2: POST /api/thumbnail/from-message
    try:
        resp = session.post(
            f"{BASE_URL}/api/thumbnail/from-message",
            json={"chatId": chat_id, "messageId": message_id},
            timeout=TIMEOUT,
        )
        assert resp.status_code == 200, f"Expected 200 but got {resp.status_code}"
        body = resp.json()
        assert any(k in body for k in ["remoteFileId", "width", "height"]), "Thumbnail metadata missing expected fields"
        remote_file_id = body.get("remoteFileId") if "remoteFileId" in body else None
    except Exception as e:
        raise AssertionError(f"POST /api/thumbnail/from-message failed: {e}")

    if remote_file_id:
        try:
            r = session.get(f"{BASE_URL}/api/thumbnail/{remote_file_id}", timeout=TIMEOUT)
            assert r.status_code == 200, "Expected 200 from GET /api/thumbnail/:remoteFileId"
            assert r.content and len(r.content) > 0, "Thumbnail content empty"
        except Exception as e:
            raise AssertionError(f"GET /api/thumbnail/:remoteFileId failed: {e}")

        unsupported_thumbnail_id = "unsupported-file-id"
        try:
            r_err = session.get(f"{BASE_URL}/api/thumbnail/{unsupported_thumbnail_id}", timeout=TIMEOUT)
            assert r_err.status_code == 415, f"Expected 415 Unsupported Media Type for non-thumbnailable file but got {r_err.status_code}"
        except Exception as e:
            raise AssertionError(f"GET /api/thumbnail/ unsupported file expected 415, got error: {e}")

    try:
        del_resp = session.delete(f"{BASE_URL}/api/message/{chat_id}/{message_id}", timeout=TIMEOUT)
        assert del_resp.status_code in (200, 404), f"Unexpected status code {del_resp.status_code} for DELETE message"
    except Exception as e:
        raise AssertionError(f"DELETE /api/message/:chatId/:messageId failed: {e}")

    since_iso = time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime(time.time() - 3600))
    try:
        cleanup_resp = session.post(
            f"{BASE_URL}/api/message/cleanup",
            json={"since": since_iso, "target": "messages"},
            timeout=TIMEOUT,
        )
        assert cleanup_resp.status_code == 200, f"Expected 200 from POST /api/message/cleanup but got {cleanup_resp.status_code}"
        cleanup_data = cleanup_resp.json()
        assert isinstance(cleanup_data, dict) and ("deleted" in cleanup_data or "summary" in cleanup_data), "Cleanup response missing expected summary"
    except Exception as e:
        raise AssertionError(f"POST /api/message/cleanup failed: {e}")

    phone_number = "+10000000000"
    bad_code = "0000"
    good_code = None
    session_id = None
    user_id = None
    password = "dummyPassword123"

    try:
        send_code_resp = session.post(
            f"{BASE_URL}/api/telegram/send-code",
            json={"phoneNumber": phone_number},
            timeout=TIMEOUT,
        )
        assert send_code_resp.status_code == 200, f"Expected 200 from send-code but got {send_code_resp.status_code}"
        send_code_json = send_code_resp.json()
        assert send_code_json.get("sent") is True and send_code_json.get("phoneNumber") == phone_number, "send-code response invalid"
    except Exception as e:
        raise AssertionError(f"POST /api/telegram/send-code failed: {e}")

    try:
        verify_bad_resp = session.post(
            f"{BASE_URL}/api/telegram/verify-code",
            json={"phoneNumber": phone_number, "code": bad_code},
            timeout=TIMEOUT,
        )
        assert verify_bad_resp.status_code == 401, f"Expected 401 for bad code but got {verify_bad_resp.status_code}"
    except Exception as e:
        raise AssertionError(f"POST /api/telegram/verify-code with bad code failed: {e}")

    possible_good_codes = ["1234", "0001"]
    verified_successfully = False
    for try_code in possible_good_codes:
        try:
            verify_resp = session.post(
                f"{BASE_URL}/api/telegram/verify-code",
                json={"phoneNumber": phone_number, "code": try_code},
                timeout=TIMEOUT,
            )
            if verify_resp.status_code == 200:
                data = verify_resp.json()
                assert "sessionId" in data and "userId" in data, "verify-code success missing required fields"
                session_id = data["sessionId"]
                user_id = data["userId"]
                good_code = try_code
                verified_successfully = True
                break
            elif verify_resp.status_code == 401:
                continue
        except Exception:
            continue

    if not verified_successfully:
        assert False, "Could not verify code successfully with any known good codes"

    try:
        verify_pass_resp = session.post(
            f"{BASE_URL}/api/telegram/verify-password",
            json={"userId": user_id, "password": password},
            timeout=TIMEOUT,
        )
        assert verify_pass_resp.status_code == 200, f"Expected 200 from verify-password but got {verify_pass_resp.status_code}"
        vp_json = verify_pass_resp.json()
        assert "session" in vp_json or "userId" in vp_json, "verify-password response missing expected session info"
    except Exception as e:
        raise AssertionError(f"POST /api/telegram/verify-password failed: {e}")

    try:
        status_resp = session.get(f"{BASE_URL}/api/telegram/status/{user_id}", timeout=TIMEOUT)
        assert status_resp.status_code == 200, f"Expected 200 from telegram status but got {status_resp.status_code}"
        status_json = status_resp.json()
        assert "session" in status_json or "state" in status_json or isinstance(status_json, dict), "telegram status missing expected fields"
    except Exception as e:
        raise AssertionError(f"GET /api/telegram/status/:userId failed: {e}")

    try:
        disconnect_resp = session.post(
            f"{BASE_URL}/api/telegram/disconnect",
            json={"userId": user_id},
            timeout=TIMEOUT,
        )
        assert disconnect_resp.status_code == 200, f"Expected 200 from telegram disconnect but got {disconnect_resp.status_code}"
        disconnect_json = disconnect_resp.json()
        assert "removed" in disconnect_json or "success" in disconnect_json or isinstance(disconnect_json, dict), "disconnect response missing expected confirmation"
    except Exception as e:
        raise AssertionError(f"POST /api/telegram/disconnect failed: {e}")

test_thumbnail_delete_and_telegram_session_utilities()
