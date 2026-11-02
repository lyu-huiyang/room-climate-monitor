import pytest
from conftest import NOW

from rcm.readings import count_readings, put_readings
from rcm.rooms import (
    RoomExists,
    RoomNotFound,
    create_room,
    delete_room,
    get_room,
    hash_key,
    is_valid_room_id,
    list_rooms,
    rename_room,
    rotate_key,
    set_comfort,
    verify_key,
)


def test_create_returns_key_and_stores_only_hash(conn):
    room, key = create_room(conn, "living-room", "客厅", now=NOW)
    assert len(key) >= 32
    assert room.key_hash == hash_key(key)
    assert verify_key(room, key)
    row = conn.execute("SELECT * FROM rooms WHERE id = 'living-room'").fetchone()
    assert all(key not in str(v) for v in tuple(row))
    stored = get_room(conn, "living-room")
    assert stored == room
    assert (stored.name, stored.comfort_t, stored.comfort_h) == ("客厅", (22, 26), (40, 60))
    assert stored.created_at == NOW


def test_create_rejects_bad_id_and_duplicate(conn):
    for bad in ["Living Room", "living-room\n", "", "x" * 33, "a_b"]:
        with pytest.raises(ValueError):
            create_room(conn, bad, "x")
    create_room(conn, "living-room", "客厅")
    with pytest.raises(RoomExists):
        create_room(conn, "living-room", "again")


def test_is_valid_room_id():
    assert is_valid_room_id("a" * 32)
    assert is_valid_room_id("bedroom-2")
    assert not is_valid_room_id(None)
    assert not is_valid_room_id("a" * 33)


def test_rotate_key_invalidates_old_key(conn, room):
    old_room, old_key = room
    new_key = rotate_key(conn, "living-room")
    updated = get_room(conn, "living-room")
    assert not verify_key(updated, old_key)
    assert verify_key(updated, new_key)
    assert new_key != old_key
    with pytest.raises(RoomNotFound):
        rotate_key(conn, "nope")


def test_verify_key_tolerates_non_ascii_header(conn, room):
    r, _ = room
    assert verify_key(r, "密钥") is False
    assert verify_key(r, "\udcff") is False
    assert verify_key(r, "\ud800") is False
    assert verify_key(r, "") is False


def test_set_comfort_requires_min_below_max(conn, room):
    set_comfort(conn, "living-room", comfort_t=(21, 25))
    assert get_room(conn, "living-room").comfort_t == (21, 25)
    assert get_room(conn, "living-room").comfort_h == (40, 60)
    set_comfort(conn, "living-room", comfort_h=(35, 55))
    assert get_room(conn, "living-room").comfort_h == (35, 55)
    for bad in [(26, 22), (24, 24)]:
        with pytest.raises(ValueError):
            set_comfort(conn, "living-room", comfort_t=bad)
    with pytest.raises(ValueError):
        create_room(conn, "x", "x", comfort_h=(60, 40))
    with pytest.raises(RoomNotFound):
        set_comfort(conn, "nope", comfort_t=(1, 2))


def test_rename(conn, room):
    rename_room(conn, "living-room", "Living room")
    assert get_room(conn, "living-room").name == "Living room"
    with pytest.raises(RoomNotFound):
        rename_room(conn, "nope", "x")


def test_delete_cascades_readings(conn, room):
    put_readings(conn, "living-room", [{"ts": NOW, "sensors": {"sht40": (24.0, 50.0)}, "rssi": None}])
    assert count_readings(conn, "living-room") == 1
    assert delete_room(conn, "living-room") is True
    assert get_room(conn, "living-room") is None
    assert conn.execute("SELECT COUNT(*) FROM readings WHERE room_id = 'living-room'").fetchone()[0] == 0
    assert delete_room(conn, "living-room") is False


def test_list_rooms_sorted_by_id(conn):
    create_room(conn, "living-room", "客厅")
    create_room(conn, "bedroom", "卧室")
    assert [r.id for r in list_rooms(conn)] == ["bedroom", "living-room"]
