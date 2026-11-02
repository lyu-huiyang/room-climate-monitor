"""Readings storage, latest values and bucketed history (docs/design/server-web.md §4.2, §4.3)."""

import sqlite3
from typing import TypedDict

from rcm.validation import FUTURE_LIMIT_S, Reading

# range name -> (span seconds, bucket seconds)
RANGES: dict[str, tuple[int, int]] = {
    "8h": (8 * 3600, 60),
    "24h": (24 * 3600, 60),
    "7d": (7 * 24 * 3600, 900),
}
LATEST_WINDOW_S = 30 * 86400


class Latest(TypedDict):
    ts: int
    age_s: int
    sensors: dict[str, dict[str, float]]
    rssi: int | None


class History(TypedDict):
    range: str
    bucket_s: int
    sensors: list[str]
    points: list[list[int | float | None]]


def put_readings(conn: sqlite3.Connection, room_id: str, items: list[Reading]) -> None:
    rows = [
        (room_id, item["ts"], name, t, h, item["rssi"])
        for item in items
        for name, (t, h) in item["sensors"].items()
    ]
    with conn:
        conn.executemany(
            "INSERT OR REPLACE INTO readings (room_id, ts, sensor, t, h, rssi) VALUES (?, ?, ?, ?, ?, ?)",
            rows,
        )


def latest(conn: sqlite3.Connection, room_id: str, now: int) -> Latest | None:
    ts = conn.execute(
        "SELECT MAX(ts) FROM readings WHERE room_id = ? AND ts >= ?", (room_id, now - LATEST_WINDOW_S)
    ).fetchone()[0]
    if ts is None:
        return None
    rows = conn.execute(
        "SELECT sensor, t, h, rssi FROM readings WHERE room_id = ? AND ts = ? ORDER BY sensor", (room_id, ts)
    ).fetchall()
    return {
        "ts": ts,
        "age_s": max(0, now - ts),
        "sensors": {r["sensor"]: {"t": r["t"], "h": r["h"]} for r in rows},
        "rssi": next((r["rssi"] for r in rows if r["rssi"] is not None), None),
    }


def history(conn: sqlite3.Connection, room_id: str, range_name: str, now: int) -> History:
    if range_name not in RANGES:
        raise ValueError(f"range must be one of {', '.join(RANGES)}")
    span, bucket = RANGES[range_name]
    rows = conn.execute(
        "SELECT ts - ts % :b AS bucket, sensor, ROUND(AVG(t), 2) AS t, ROUND(AVG(h), 2) AS h"
        " FROM readings WHERE room_id = :room AND ts BETWEEN :start AND :end"
        " GROUP BY bucket, sensor ORDER BY bucket",
        {"b": bucket, "room": room_id, "start": now - span, "end": now + FUTURE_LIMIT_S},
    ).fetchall()
    sensors = sorted({r["sensor"] for r in rows})
    column = {name: 1 + 2 * i for i, name in enumerate(sensors)}
    points: dict[int, list[int | float | None]] = {}
    for r in rows:
        point = points.setdefault(r["bucket"], [r["bucket"]] + [None] * (2 * len(sensors)))
        point[column[r["sensor"]]] = r["t"]
        point[column[r["sensor"]] + 1] = r["h"]
    return {"range": range_name, "bucket_s": bucket, "sensors": sensors, "points": list(points.values())}


def count_readings(conn: sqlite3.Connection, room_id: str) -> int:
    return conn.execute("SELECT COUNT(*) FROM readings WHERE room_id = ?", (room_id,)).fetchone()[0]


def latest_ts(conn: sqlite3.Connection, room_id: str) -> int | None:
    return conn.execute("SELECT MAX(ts) FROM readings WHERE room_id = ?", (room_id,)).fetchone()[0]
