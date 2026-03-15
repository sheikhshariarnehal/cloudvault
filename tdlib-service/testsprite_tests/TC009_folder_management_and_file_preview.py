import requests
import uuid

BASE_URL = "http://localhost:3001"
JWT_TOKEN = "<YOUR_JWT_TOKEN>"
HEADERS = {"Authorization": f"Bearer {JWT_TOKEN}"}
TIMEOUT = 30


def create_sample_file():
    # Create a small sample file content for upload
    return {
        'file': ('testfile.txt', b'This is a test file for folder management and preview.', 'text/plain')
    }


def test_folder_management_and_file_preview():
    folder_id = None
    file_id = None
    remote_file_id = None
    try:
        # Step 1: Upload a file to get a fileId and remoteFileId
        upload_resp = requests.post(
            f"{BASE_URL}/api/upload/",
            headers=HEADERS,
            files=create_sample_file(),
            timeout=TIMEOUT
        )
        assert upload_resp.status_code == 200, f"File upload failed: {upload_resp.text}"
        upload_data = upload_resp.json()
        file_id = upload_data.get("fileId") or upload_data.get("id") or upload_data.get("file_id")
        remote_file_id = upload_data.get("remoteFileId") or upload_data.get("telegram_file_id") or upload_data.get("remote_file_id")
        assert file_id is not None, "fileId missing in upload response"
        assert remote_file_id is not None, "remoteFileId missing in upload response"

        # Step 2: Create a folder (POST /api/folders)
        folder_name = f"TestFolder_{uuid.uuid4()}"
        folder_payload = {"name": folder_name, "parent_id": None}
        folder_resp = requests.post(
            f"{BASE_URL}/api/folders",
            headers={**HEADERS, "Content-Type": "application/json"},
            json=folder_payload,
            timeout=TIMEOUT
        )
        assert folder_resp.status_code == 201, f"Folder creation failed: {folder_resp.text}"
        folder_data = folder_resp.json()
        folder_id = folder_data.get("folderId") or folder_data.get("id")
        assert folder_id is not None, "folderId missing in folder creation response"

        # Step 3: Move the uploaded file into the newly created folder (PATCH /api/files/:fileId)
        move_payload = {"folder_id": folder_id}
        move_resp = requests.patch(
            f"{BASE_URL}/api/files/{file_id}",
            headers={**HEADERS, "Content-Type": "application/json"},
            json=move_payload,
            timeout=TIMEOUT
        )
        assert move_resp.status_code == 200, f"Move file to folder failed: {move_resp.text}"
        move_data = move_resp.json()
        moved_folder_id = move_data.get("folder_id") or move_data.get("folderId")
        assert moved_folder_id == folder_id, "File folder_id not updated correctly"

        # Step 4: Attempt to move file to a non-existent folder (should 404)
        invalid_folder_id = "nonexistent-folder-id-xyz"
        invalid_move_payload = {"folder_id": invalid_folder_id}
        invalid_move_resp = requests.patch(
            f"{BASE_URL}/api/files/{file_id}",
            headers={**HEADERS, "Content-Type": "application/json"},
            json=invalid_move_payload,
            timeout=TIMEOUT
        )
        assert invalid_move_resp.status_code == 404, "Expected 404 when moving file to non-existent folder"

        # Step 5: Preview thumbnail for the remoteFileId (GET /api/thumbnail/:remoteFileId)
        thumb_resp = requests.get(
            f"{BASE_URL}/api/thumbnail/{remote_file_id}",
            headers=HEADERS,
            timeout=TIMEOUT
        )
        assert thumb_resp.status_code == 200, f"Thumbnail retrieval failed: {thumb_resp.text}"
        assert thumb_resp.content and len(thumb_resp.content) > 0, "Thumbnail content is empty"

        # Step 6: Preview file with preview=true (GET /api/download/:remoteFileId?preview=true)
        preview_resp = requests.get(
            f"{BASE_URL}/api/download/{remote_file_id}",
            headers=HEADERS,
            params={"preview": "true"},
            timeout=TIMEOUT,
            stream=True
        )
        assert preview_resp.status_code == 200, f"File preview failed: {preview_resp.text}"
        chunk = next(preview_resp.iter_content(chunk_size=1024), None)
        assert chunk is not None and len(chunk) > 0, "Preview stream is empty"

        # Step 7: Preview with unsupported preview type should return 415 (simulate by using unsupported dummy file)
        # For this we create a new upload with an unsupported type if possible
        unsupported_file = {
            'file': ('test.unsupportedtype', b"dummydata", 'application/unsupported-media-type')
        }
        unsupported_upload_resp = requests.post(
            f"{BASE_URL}/api/upload/",
            headers=HEADERS,
            files=unsupported_file,
            timeout=TIMEOUT
        )
        if unsupported_upload_resp.status_code == 200:
            unsupported_data = unsupported_upload_resp.json()
            unsupported_remote_file_id = unsupported_data.get("remoteFileId") or unsupported_data.get("telegram_file_id")
            if unsupported_remote_file_id:
                # Try preview on unsupported file
                unsupported_preview_resp = requests.get(
                    f"{BASE_URL}/api/download/{unsupported_remote_file_id}",
                    headers=HEADERS,
                    params={"preview": "true"},
                    timeout=TIMEOUT
                )
                assert unsupported_preview_resp.status_code == 415, "Expected 415 for unsupported preview media type"
                # Clean up unsupported test file if API supports deletion (not in scope - optional)

    finally:
        # Cleanup
        # Delete uploaded file if API supports deletion - not specified in PRD so skipping
        # Delete created folder if API supports deletion - not specified in PRD so skipping
        pass


test_folder_management_and_file_preview()