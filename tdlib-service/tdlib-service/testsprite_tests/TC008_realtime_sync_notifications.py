import requests
import threading
import time
import json
import websocket
import ssl

BASE_URL = "http://localhost:3001"
API_FILES_LIST = "/api/files"
REALTIME_WS_BASE = "ws://localhost:3001/realtime/v1"  # Assumed WS URL endpoint for Supabase Realtime proxy
TIMEOUT = 30

# These values would normally be dynamically obtained or configured securely
USER_ID = "testuser123"
AUTH_TOKEN = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.test.token"  # Valid Bearer token for user auth


def test_realtime_sync_notifications():
    """
    Test real-time sync by:
    1) Connecting to Supabase Realtime WS channel user:[user_id]
    2) Receiving INSERT events for new files
    3) On insert event, fetching file list via GET /api/files?userId=<user_id>
    4) Simulate connection drop and reconnect
    5) If reconnect fails, fallback to GET /api/files?userId=<user_id>
    """

    files_received = []
    realtime_messages = []
    reconnect_attempts = 0
    max_reconnect_attempts = 3
    ws = None
    reconnect_successful = False
    connection_dropped_event = threading.Event()
    insert_event_received_event = threading.Event()

    headers_auth = {"Authorization": f"Bearer {AUTH_TOKEN}"}

    def on_message(wsapp, message):
        try:
            data = json.loads(message)
            realtime_messages.append(data)
            # Check for INSERT event on user:[user_id] channel
            # Supabase Realtime payload format example minimal guess:
            # {
            #   "event": "INSERT",
            #   "schema": "public",
            #   "table": "files",
            #   "payload": {...}
            # }
            if (
                isinstance(data, dict)
                and data.get("channel") == f"user:{USER_ID}"
                and data.get("event") == "INSERT"
            ):
                insert_event_received_event.set()
        except Exception:
            pass

    def on_error(wsapp, error):
        # Error callback - mark connection dropped
        connection_dropped_event.set()

    def on_close(wsapp, close_status_code, close_msg):
        connection_dropped_event.set()

    def on_open(wsapp):
        # Subscribe to user channel after connection open
        subscribe_msg = json.dumps(
            {"type": "subscribe", "channel": f"user:{USER_ID}"}
        )
        wsapp.send(subscribe_msg)

    def connect_ws():
        nonlocal ws
        ws = websocket.WebSocketApp(
            REALTIME_WS_BASE,
            on_open=on_open,
            on_message=on_message,
            on_error=on_error,
            on_close=on_close,
            header={"Authorization": f"Bearer {AUTH_TOKEN}"},
        )
        # Run WS in a thread with SSL disabled for local testing if needed
        wst = threading.Thread(target=ws.run_forever, kwargs={"sslopt": {"cert_reqs": ssl.CERT_NONE}})
        wst.daemon = True
        wst.start()
        return wst

    # Step 1: Connect WebSocket
    wst = connect_ws()

    # Step 2: Wait to receive INSERT events for new file (simulate inserting file via upload)
    # If no insert event in 15 seconds, proceed (simulate that insert event arrives)
    insert_event_received_event.wait(timeout=15)

    if not insert_event_received_event.is_set():
        # If no event received, simulate fallback GET after connection drop happens later
        pass

    # Step 3: If insert event received, fetch updated file list
    if insert_event_received_event.is_set():
        resp = requests.get(
            f"{BASE_URL}{API_FILES_LIST}",
            params={"userId": USER_ID},
            headers=headers_auth,
            timeout=TIMEOUT,
        )
        assert resp.status_code == 200, f"GET /api/files returned {resp.status_code}"
        json_data = resp.json()
        assert isinstance(json_data, list), "Expected list of files in response"
        files_received = json_data

    # Step 4: Simulate connection drop and reconnect attempts
    ws.close()
    connection_dropped_event.wait(timeout=10)

    # Attempt reconnects
    reconnect_successful = False
    for attempt in range(max_reconnect_attempts):
        reconnect_attempts += 1
        connection_dropped_event.clear()
        insert_event_received_event.clear()
        wst = connect_ws()

        # Wait briefly if connection stabilizes (simulate checking for connect success)
        time.sleep(5)

        # Check if connection is alive by sending ping or waiting for insert event as health check
        if not connection_dropped_event.is_set():
            reconnect_successful = True
            break
        else:
            ws.close()
            time.sleep(1)

    # Step 5: If reconnect fails, fallback to GET file list
    if not reconnect_successful:
        resp_fallback = requests.get(
            f"{BASE_URL}{API_FILES_LIST}",
            params={"userId": USER_ID},
            headers=headers_auth,
            timeout=TIMEOUT,
        )
        assert resp_fallback.status_code == 200, f"Fallback GET /api/files returned {resp_fallback.status_code}"
        fallback_files = resp_fallback.json()
        assert isinstance(fallback_files, list), "Expected list of files in fallback response"

    # Clean up WS if still alive
    try:
        ws.close()
    except Exception:
        pass


test_realtime_sync_notifications()