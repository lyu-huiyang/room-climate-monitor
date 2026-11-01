import sqlite3
from pathlib import Path

SCHEMA_VERSION = 1

MIGRATIONS: list[str] = [
    """
CREATE TABLE rooms (
  id            TEXT PRIMARY KEY,
  name          TEXT NOT NULL,
  key_hash      TEXT NOT NULL,
  comfort_t_min REAL NOT NULL DEFAULT 22, comfort_t_max REAL NOT NULL DEFAULT 26,
  comfort_h_min REAL NOT NULL DEFAULT 40, comfort_h_max REAL NOT NULL DEFAULT 60,
  created_at    INTEGER NOT NULL
);

CREATE TABLE readings (
  room_id TEXT NOT NULL REFERENCES rooms(id) ON DELETE CASCADE,
  ts      INTEGER NOT NULL,
  sensor  TEXT NOT NULL,
  t       REAL NOT NULL,
  h       REAL NOT NULL,
  rssi    INTEGER,
  PRIMARY KEY (room_id, ts, sensor)
) WITHOUT ROWID;
""",
]

assert len(MIGRATIONS) == SCHEMA_VERSION


def connect(path: Path) -> sqlite3.Connection:
    path.parent.mkdir(parents=True, exist_ok=True)
    conn = sqlite3.connect(path)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA journal_mode=WAL")
    conn.execute("PRAGMA synchronous=NORMAL")
    conn.execute("PRAGMA foreign_keys=ON")
    conn.execute("PRAGMA busy_timeout=5000")
    return conn


def migrate(conn: sqlite3.Connection) -> None:
    current = conn.execute("PRAGMA user_version").fetchone()[0]
    for version, sql in enumerate(MIGRATIONS[current:], start=current + 1):
        # Each step and its version bump commit together.
        conn.executescript(f"BEGIN;\n{sql}\nPRAGMA user_version = {version};\nCOMMIT;")
