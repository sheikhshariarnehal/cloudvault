import requests
import time

BASE_URL = "http://localhost:3001"
API_KEY = "backend_key_value"  # Replace with actual backend key
AUTH_TOKEN = "Bearer valid_jwt_token"  # Replace with actual JWT token for Authorization header
HEADERS_API_KEY = {"x-api-key": API_KEY}
HEADERS_AUTH = {"Authorization": AUTH_TOKEN, "x-api-key": API_KEY}
TIMEOUT = 30

def test_chunked_upload_lifecycle():
    upload_id = None
    job_id = None

    # Step 1: Initialize chunked upload session (no auth required)
    init_payload = {
        "name": "test_large_file.bin",
        "size": 25,
        "contentType": "application/octet-stream"
    }
    try:
        resp = requests.post(
            f"{BASE_URL}/api/chunked-upload/init",
            json=init_payload,
            headers=HEADERS_API_KEY,
            timeout=TIMEOUT
        )
        assert resp.status_code == 200, f"Init upload failed: {resp.status_code}"
        data = resp.json()
        assert "uploadId" in data and "chunkSize" in data and "expiresAt" in data
        upload_id = data["uploadId"]
        chunk_size = data["chunkSize"]
        # Validate chunkSize reasonable (positive int)
        assert isinstance(chunk_size, int) and chunk_size > 0
        expires_at = data["expiresAt"]
        assert isinstance(expires_at, str) and expires_at != ""

        # Prepare chunks (simulate the file of size 25 bytes splitted by chunkSize)
        file_content = b"abcdefghijklmnopqrstuvwxy"  # 25 bytes content
        total_chunks = (len(file_content) + chunk_size - 1) // chunk_size

        # Step 2: Upload chunks one by one (no auth required, multipart/form-data)
        headers_chunk = HEADERS_API_KEY.copy()
        for chunk_idx in range(total_chunks):
            start = chunk_idx * chunk_size
            end = min(start + chunk_size, len(file_content))
            chunk_data = file_content[start:end]

            files = {
                "uploadId": (None, upload_id),
                "chunk": ("chunk.bin", chunk_data, "application/octet-stream")
            }
            resp = requests.post(
                f"{BASE_URL}/api/chunked-upload/chunk",
                files=files,
                headers=headers_chunk,
                timeout=TIMEOUT
            )
            assert resp.status_code == 200, f"Chunk {chunk_idx} upload failed: {resp.status_code}"

        # Step 3: Poll upload status (no auth required)
        params_status = {"uploadId": upload_id}
        resp = requests.get(
            f"{BASE_URL}/api/chunked-upload/status",
            params=params_status,
            headers=HEADERS_API_KEY,
            timeout=TIMEOUT
        )
        assert resp.status_code == 200, f"Status poll failed: {resp.status_code}"
        status_data = resp.json()
        assert "uploadedChunks" in status_data and "totalChunks" in status_data
        assert status_data["uploadedChunks"] == total_chunks
        assert status_data["totalChunks"] == total_chunks

        # Step 4: Start async completion (requires Authorization)
        complete_start_payload = {"uploadId": upload_id}
        resp = requests.post(
            f"{BASE_URL}/api/chunked-upload/complete-start",
            json=complete_start_payload,
            headers=HEADERS_AUTH,
            timeout=TIMEOUT
        )
        assert resp.status_code == 202, f"Async complete-start failed: {resp.status_code}"
        complete_start_data = resp.json()
        assert "jobId" in complete_start_data
        job_id = complete_start_data["jobId"]
        assert isinstance(job_id, str) and job_id != ""

        # Step 5: Check completion status until 'completed'
        complete_status_url = f"{BASE_URL}/api/chunked-upload/complete-status"
        params_job = {"jobId": job_id}
        status = None
        for _ in range(10):  # max 10 retries with 1s delay
            resp = requests.get(
                complete_status_url,
                params=params_job,
                headers=HEADERS_AUTH,
                timeout=TIMEOUT
            )
            assert resp.status_code == 200, f"Complete status failed: {resp.status_code}"
            status_data = resp.json()
            assert "status" in status_data
            status = status_data["status"]
            if status == "completed":
                break
            time.sleep(1)
        assert status == "completed", "Completion status never reached 'completed'"

        # Step 6: Fetch completion result (final metadata with remoteFileId)
        complete_result_url = f"{BASE_URL}/api/chunked-upload/complete-result"
        resp = requests.get(
            complete_result_url,
            params=params_job,
            headers=HEADERS_AUTH,
            timeout=TIMEOUT
        )
        assert resp.status_code == 200, f"Complete result fetch failed: {resp.status_code}"
        result_data = resp.json()
        assert "remoteFileId" in result_data or "telegram_file_id" in result_data, "Missing final file identifier"

        # Step 7: Single-call completion (all chunks included in one request)
        # Initialize another upload session for single-call completion
        resp = requests.post(
            f"{BASE_URL}/api/chunked-upload/init",
            json=init_payload,
            headers=HEADERS_API_KEY,
            timeout=TIMEOUT
        )
        assert resp.status_code == 200, "Single-call init failed"
        init_data_single = resp.json()
        upload_id_single = init_data_single["uploadId"]

        all_chunks_data = file_content  # full content as single chunk for single-call complete

        files_single_complete = {
            "uploadId": (None, upload_id_single),
            "chunk": ("file.bin", all_chunks_data, "application/octet-stream")
        }
        resp = requests.post(
            f"{BASE_URL}/api/chunked-upload/complete",
            files=files_single_complete,
            headers=HEADERS_AUTH,
            timeout=TIMEOUT
        )
        assert resp.status_code == 200, f"Single-call complete failed: {resp.status_code}"
        single_complete_data = resp.json()
        assert "remoteFileId" in single_complete_data or "telegram_file_id" in single_complete_data

        # Step 8: Error handling - invalid uploadId on chunk upload
        invalid_upload_id = "invalid_upload_id_123"
        files_invalid_chunk = {
            "uploadId": (None, invalid_upload_id),
            "chunk": ("chunk.bin", b"data", "application/octet-stream")
        }
        resp = requests.post(
            f"{BASE_URL}/api/chunked-upload/chunk",
            files=files_invalid_chunk,
            headers=HEADERS_API_KEY,
            timeout=TIMEOUT
        )
        assert resp.status_code == 404, f"Expected 404 for invalid uploadId chunk upload, got {resp.status_code}"

        # Step 9: Error handling - missing Authorization on complete-start
        payload_missing_auth = {"uploadId": upload_id}
        resp = requests.post(
            f"{BASE_URL}/api/chunked-upload/complete-start",
            json=payload_missing_auth,
            headers=HEADERS_API_KEY,  # Only x-api-key without Authorization
            timeout=TIMEOUT
        )
        assert resp.status_code == 401 or resp.status_code == 403, f"Expected 401/403 for missing auth on complete-start, got {resp.status_code}"

        # Step 10: Error handling - insufficient permission on complete-start
        headers_insufficient = {"Authorization": "Bearer invalid_or_insufficient_token", "x-api-key": API_KEY}
        resp = requests.post(
            f"{BASE_URL}/api/chunked-upload/complete-start",
            json=payload_missing_auth,
            headers=headers_insufficient,
            timeout=TIMEOUT
        )
        assert resp.status_code == 401 or resp.status_code == 403, f"Expected 401/403 for insufficient permissions, got {resp.status_code}"

    finally:
        # Cleanup if possible by deleting upload session or related artifacts - endpoint not specified for deletion
        pass  # PRD does not specify an endpoint to delete chunked upload sessions

test_chunked_upload_lifecycle()
