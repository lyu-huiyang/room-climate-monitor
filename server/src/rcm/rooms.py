"""Room registry and per-room device keys."""

import hashlib
import hmac
import re
import secrets
import sqlite3
import time
from dataclasses import dataclass

ROOM_ID_RE = re.compile(r"[a-z0-9-]{1,32}")

type Range = tuple[float, float]


class RoomExists(ValueError):
    pass


class RoomNotFound(LookupError):
    pass


@dataclass(frozen=True)
class Room:
    id: str
    name: str
    key_hash: str
    comfort_t: Range
    comfort_h: Range
    created_at: int


def is_valid_room_id(value: object) -> bool:
    return isinstance(value, str) and ROOM_ID_RE.fullmatch(value) is not None


def new_key() -> str:
    return secrets.token_urlsafe(24)


def hash_key(key: str) -> str:
    # surrogatepass encodes any str, so odd header values can never raise here.
    return hashlib.sha256(key.encode("utf-8", "surrogatepass")).hexdigest()


def verify_key(room: Room, header_value: str) -> bool:
    return hmac.compare_digest(hash_key(header_value).encode(), room.key_hash.encode())


def _check_range(value: Range, what: str) -> None:
    if not value[0] < value[1]:
        raise ValueError(f"{what}: min must be below max")


def _row_to_room(row: sqlite3.Row) -> Room:
    return Room(
        id=row["id"],
        name=row["name"],
        key_hash=row["key_hash"],
        comfort_t=(row["comfort_t_min"], row["comfort_t_max"]),
        comfort_h=(row["comfort_h_min"], row["comfort_h_max"]),
        created_at=row["created_at"],
    )


def create_room(
    conn: sqlite3.Connection,
    id: str,
    name: str,
    comfort_t: Range = (22, 26),
    comfort_h: Range = (40, 60),
    now: int | None = None,
) -> tuple[Room, str]:
    if not is_valid_room_id(id):
        raise ValueError("room id must match [a-z0-9-]{1,32}")
    _check_range(comfort_t, "comfort temperature")
    _check_range(comfort_h, "comfort humidity")
    key = new_key()
    room = Room(id, name, hash_key(key), comfort_t, comfort_h, int(time.time()) if now is None else now)
    try:
        with conn:
            conn.execute(
                "INSERT INTO rooms (id, name, key_hash, comfort_t_min, comfort_t_max,"
                " comfort_h_min, comfort_h_max, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
                (room.id, room.name, room.key_hash, *room.comfort_t, *room.comfort_h, room.created_at),
            )
    except sqlite3.IntegrityError as e:
        raise RoomExists(id) from e
    return room, key


def get_room(conn: sqlite3.Connection, id: str) -> Room | None:
    row = conn.execute("SELECT * FROM rooms WHERE id = ?", (id,)).fetchone()
    return _row_to_room(row) if row else None


def list_rooms(conn: sqlite3.Connection) -> list[Room]:
    return [_row_to_room(r) for r in conn.execute("SELECT * FROM rooms ORDER BY id")]


def _update(conn: sqlite3.Connection, id: str, sql: str, params: tuple) -> None:
    with conn:
        if conn.execute(sql, (*params, id)).rowcount == 0:
            raise RoomNotFound(id)


def rename_room(conn: sqlite3.Connection, id: str, name: str) -> None:
    _update(conn, id, "UPDATE rooms SET name = ? WHERE id = ?", (name,))


def set_comfort(
    conn: sqlite3.Connection, id: str, comfort_t: Range | None = None, comfort_h: Range | None = None
) -> None:
    room = get_room(conn, id)
    if room is None:
        raise RoomNotFound(id)
    t = comfort_t or room.comfort_t
    h = comfort_h or room.comfort_h
    _check_range(t, "comfort temperature")
    _check_range(h, "comfort humidity")
    _update(
        conn,
        id,
        "UPDATE rooms SET comfort_t_min = ?, comfort_t_max = ?, comfort_h_min = ?, comfort_h_max = ?"
        " WHERE id = ?",
        (*t, *h),
    )


def rotate_key(conn: sqlite3.Connection, id: str) -> str:
    key = new_key()
    _update(conn, id, "UPDATE rooms SET key_hash = ? WHERE id = ?", (hash_key(key),))
    return key


def delete_room(conn: sqlite3.Connection, id: str) -> bool:
    with conn:
        return conn.execute("DELETE FROM rooms WHERE id = ?", (id,)).rowcount > 0
