from conftest import NOW

from rcm.readings import put_readings

MINUTE = NOW - NOW % 60


def seed(conn, room_id="living-room", ts=MINUTE):
    put_readings(conn, room_id, [{"ts": ts, "sensors": {"sht40": (24.0, 50.0)}, "rssi": -60}])


def test_list_rooms_with_latest(client, conn, room, other_room):
    seed(conn)
    body = client.get("/api/rooms").json()
    assert [r["id"] for r in body] == ["bedroom", "living-room"]
    assert body[0]["latest"] is None
    assert body[0]["name"] == "卧室"
    assert body[1]["latest"]["ts"] == MINUTE
    assert body[1]["latest"]["age_s"] == NOW - MINUTE


def test_list_rooms_empty(client):
    assert client.get("/api/rooms").json() == []


def test_get_room(client, room):
    assert client.get("/api/rooms/living-room").json() == {
        "id": "living-room",
        "name": "客厅",
        "comfort": {"t": [22, 26], "h": [40, 60]},
        "latest": None,
    }


def test_room_never_exposes_key_hash(client, room):
    r = client.get("/api/rooms/living-room")
    assert r.status_code == 200
    assert "key" not in r.text


def test_get_unknown_room_is_404(client):
    assert client.get("/api/rooms/nope").status_code == 404
    assert client.get("/api/rooms/Bad%20Id").status_code == 404


def test_history_default_is_24h(client, conn, room):
    seed(conn)
    assert client.get("/api/rooms/living-room/history").json() == {
        "range": "24h",
        "bucket_s": 60,
        "sensors": ["sht40"],
        "points": [[MINUTE, 24.0, 50.0]],
    }


def test_history_7d(client, conn, room):
    seed(conn, ts=NOW - NOW % 900)
    body = client.get("/api/rooms/living-room/history?range=7d").json()
    assert (body["range"], body["bucket_s"]) == ("7d", 900)
    assert body["points"] == [[NOW - NOW % 900, 24.0, 50.0]]


def test_history_bad_range_is_400(client, room):
    assert client.get("/api/rooms/living-room/history?range=1y").status_code == 400


def test_history_unknown_room_is_404(client):
    assert client.get("/api/rooms/nope/history").status_code == 404


def test_unknown_api_path_is_json_404(client):
    r = client.get("/api/nope")
    assert r.status_code == 404
    assert r.headers["content-type"].startswith("application/json")


def test_openapi_names_the_response_models(client):
    schemas = client.get("/api/openapi.json").json()["components"]["schemas"]
    assert {"RoomOut", "LatestOut", "HistoryOut"} <= set(schemas)
