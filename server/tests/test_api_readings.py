import json
import sqlite3

import pytest
from conftest import NOW

from rcm import readings
from rcm.db import connect

URL = "/api/rooms/living-room/readings"


def reading(ts=NOW, **sensors):
    return {"ts": ts, "sensors": sensors or {"sht40": {"t": 24.31, "h": 52.1}}, "rssi": -58}


def post(client, url=URL, key=None, payload=None, raw=None):
    headers = {"Content-Type": "application/json"}
    if key is not None:
        headers["X-Device-Key"] = key
    content = raw if raw is not None else json.dumps(payload)
    return client.post(url, headers=headers, content=content)


def stored(settings, room_id="living-room"):
    c = connect(settings.db_path)
    try:
        return c.execute("SELECT COUNT(*) FROM readings WHERE room_id = ?", (room_id,)).fetchone()[0]
    finally:
        c.close()


def test_valid_upload_stored(client, room):
    _, key = room
    r = post(client, key=key, payload={"readings": [reading()]})
    assert r.status_code == 200
    assert r.json() == {"accepted": 1, "rejected": 0}
    latest = client.get("/api/rooms/living-room").json()["latest"]
    assert latest == {"ts": NOW, "age_s": 0, "sensors": {"sht40": {"t": 24.31, "h": 52.1}}, "rssi": -58}


def test_unknown_room_is_404(client, room):
    _, key = room
    assert (
        post(client, "/api/rooms/nope/readings", key=key, payload={"readings": [reading()]}).status_code
        == 404
    )
    assert post(client, "/api/rooms/nope/readings", payload={"readings": [reading()]}).status_code == 404


def test_bad_room_id_format_is_404(client, room):
    _, key = room
    r = post(client, "/api/rooms/Living%20Room/readings", key=key, payload={"readings": [reading()]})
    assert r.status_code == 404


@pytest.mark.parametrize("key", [None, "", "wrong"])
def test_bad_key_is_401_nothing_stored(client, room, settings, key):
    assert post(client, key=key, payload={"readings": [reading()]}).status_code == 401
    assert stored(settings) == 0


def test_non_ascii_key_is_401(client, room, settings):
    r = client.post(
        URL, headers={"X-Device-Key": "密钥".encode()}, content=json.dumps({"readings": [reading()]})
    )
    assert r.status_code == 401
    assert stored(settings) == 0


def test_key_of_another_room_is_401(client, room, other_room, settings):
    _, bedroom_key = other_room
    assert post(client, key=bedroom_key, payload={"readings": [reading()]}).status_code == 401
    assert stored(settings, "living-room") == 0
    assert stored(settings, "bedroom") == 0


def test_body_over_64kb_is_413(client, room):
    _, key = room
    assert post(client, key=key, raw=" " * (64 * 1024 + 1)).status_code == 413


def test_body_of_exactly_64kb_is_not_413(client, room):
    _, key = room
    raw = json.dumps({"readings": [reading()]})
    assert post(client, key=key, raw=raw + " " * (64 * 1024 - len(raw))).status_code == 200


def test_bad_key_wins_over_large_body(client, room):
    assert post(client, key="wrong", raw=" " * (64 * 1024 + 1)).status_code == 401


@pytest.mark.parametrize("raw", ["not json", "{", "", "[" * 60000])
def test_unparseable_body_is_400(client, room, raw):
    _, key = room
    assert post(client, key=key, raw=raw).status_code == 400


def test_structural_error_is_400_with_message(client, room):
    _, key = room
    r = post(client, key=key, payload={"readings": "x"})
    assert r.status_code == 400
    assert "readings" in r.json()["detail"]


def test_all_rejected_still_200(client, room, settings):
    _, key = room
    r = post(client, key=key, payload={"readings": [reading(ts=NOW - 10 * 86400)]})
    assert r.status_code == 200
    assert r.json() == {"accepted": 0, "rejected": 1}
    assert stored(settings) == 0


def test_retransmit_is_idempotent(client, room, settings):
    _, key = room
    for _ in range(2):
        assert post(client, key=key, payload={"readings": [reading()]}).json() == {
            "accepted": 1,
            "rejected": 0,
        }
    assert stored(settings) == 1


def test_batch_of_100_with_duplicate(client, room, settings):
    _, key = room
    batch = [reading(ts=NOW - i) for i in range(99)] + [reading(ts=NOW)]
    r = post(client, key=key, payload={"readings": batch})
    assert r.json() == {"accepted": 99, "rejected": 1}
    assert stored(settings) == 99


def test_db_error_is_503(client, room, monkeypatch):
    _, key = room

    def boom(*args, **kwargs):
        raise sqlite3.OperationalError("database is locked")

    monkeypatch.setattr(readings, "put_readings", boom)
    assert post(client, key=key, payload={"readings": [reading()]}).status_code == 503


def test_get_on_readings_is_405(client, room):
    assert client.get(URL).status_code == 405


@pytest.mark.parametrize(("path", "status"), [("/api/rooms/nope/readings", 404), (URL, 401)])
def test_rejected_upload_reads_the_whole_body_first(settings, room, path, status):
    # The device's HTTP client gives up (status -3) if the server answers and closes the connection
    # while the body is still being written, so even a 404/401 must consume the body first.
    import asyncio

    from rcm.api import create_app

    chunks = [b'{"readings": [', b"]}"]
    sent = []

    async def receive():
        if chunks:
            body = chunks.pop(0)
            return {"type": "http.request", "body": body, "more_body": bool(chunks)}
        return {"type": "http.disconnect"}

    async def send(message):
        sent.append(message)

    scope = {
        "type": "http",
        "asgi": {"version": "3.0"},
        "http_version": "1.1",
        "method": "POST",
        "scheme": "http",
        "path": path,
        "raw_path": path.encode(),
        "query_string": b"",
        "root_path": "",
        "headers": [(b"x-device-key", b"wrong"), (b"content-type", b"application/json")],
        "client": ("127.0.0.1", 50000),
        "server": ("testserver", 80),
    }
    asyncio.run(create_app(settings, clock=lambda: NOW)(scope, receive, send))
    assert sent[0]["status"] == status
    assert chunks == []
