"""Seed a database with two demo rooms and sine-wave readings.

For local development and end-to-end tests only. The device keys are fixed
and public: never use this against a real deployment.
"""

import argparse
import math
import time
from pathlib import Path

from rcm import readings, rooms
from rcm.db import connect, migrate

DEMO_ROOMS = [
    # id, name, key, temperature base, humidity base
    ("living-room", "客厅", "demo-key-living", 24.0, 50.0),
    ("bedroom", "卧室", "demo-key-bedroom", 25.0, 55.0),
]


def seed(db: Path, hours: int, now: int) -> None:
    conn = connect(db)
    migrate(conn)
    try:
        for room_id, name, key, t0, h0 in DEMO_ROOMS:
            if rooms.get_room(conn, room_id) is None:
                rooms.create_room(conn, room_id, name, now=now)
            with conn:
                conn.execute("UPDATE rooms SET key_hash = ? WHERE id = ?", (rooms.hash_key(key), room_id))
            items = []
            end = now - now % 60
            for i in range(hours * 60):
                ts = end - i * 60
                phase = 2 * math.pi * (ts % 86400) / 86400
                t = round(t0 + 1.5 * math.sin(phase), 2)
                h = round(h0 + 6 * math.cos(phase), 2)
                items.append(
                    {
                        "ts": ts,
                        "sensors": {"sht40": (t, h), "aht20": (round(t + 0.3, 2), round(h - 1.2, 2))},
                        "rssi": -55 - i % 10,
                    }
                )
            readings.put_readings(conn, room_id, items)
            print(f"{room_id}  {name}  key={key}  readings={len(items)}")
    finally:
        conn.close()


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--db", required=True, type=Path)
    parser.add_argument("--hours", type=int, default=24)
    args = parser.parse_args()
    seed(args.db, args.hours, int(time.time()))


if __name__ == "__main__":
    main()
