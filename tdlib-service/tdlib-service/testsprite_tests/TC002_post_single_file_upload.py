import requests
import io

BASE_URL = "http://localhost:3001"
JWT_TOKEN = "your-jwt-token-here"  # Replace with actual valid JWT token
UPLOAD_ENDPOINT = "/api/upload/"
TIMEOUT = 30


def test_post_single_file_upload():
    headers_auth = {
        "Authorization": f"Bearer {JWT_TOKEN}"
    }
    # Prepare a small in-memory file (valid size)
    file_content = b"Hello, CloudVault upload test"
    file_name = "testfile.txt"

    # 1. Happy path: valid authorization and valid file upload
    files = {
        "file": (file_name, io.BytesIO(file_content), "text/plain")
    }
    response = requests.post(
        BASE_URL + UPLOAD_ENDPOINT,
        headers=headers_auth,
        files=files,
        timeout=TIMEOUT,
    )
    assert response.status_code == 200, f"Expected 200 OK, got {response.status_code}"
    json_resp = response.json()
    # Validate presence of remoteFileId or telegram_file_id in response metadata
    assert (
        "remoteFileId" in json_resp or "telegram_file_id" in json_resp
    ), "Response missing remoteFileId or telegram_file_id"
    # Save remoteFileId to cleanup if needed
    uploaded_remote_file_id = json_resp.get("remoteFileId") or json_resp.get("telegram_file_id")

    # 2. Error case: missing authorization header
    files = {
        "file": (file_name, io.BytesIO(file_content), "text/plain")
    }
    response_missing_auth = requests.post(
        BASE_URL + UPLOAD_ENDPOINT,
        files=files,
        timeout=TIMEOUT,
    )
    assert response_missing_auth.status_code == 401, \
        f"Expected 401 Unauthorized for missing auth, got {response_missing_auth.status_code}"

    # 3. Error case: file size exceeding limits
    # Assume size limit is less than some large size, create a file bigger than that (e.g., 100MB)
    # Using 100MB file for test (adjust size if known limit is smaller)
    large_file_size = 100 * 1024 * 1024
    large_file_content = b"a" * large_file_size
    files_large = {
        "file": ("largefile.bin", io.BytesIO(large_file_content), "application/octet-stream")
    }
    response_large_file = requests.post(
        BASE_URL + UPLOAD_ENDPOINT,
        headers=headers_auth,
        files=files_large,
        timeout=TIMEOUT,
    )
    assert response_large_file.status_code == 413, \
        f"Expected 413 Payload Too Large for large file, got {response_large_file.status_code}"


test_post_single_file_upload()
