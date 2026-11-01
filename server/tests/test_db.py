from rcm.db import SCHEMA_VERSION, connect, migrate


def test_migrate_creates_tables_and_sets_version(conn):
    tables = {r[0] for r in conn.execute("SELECT name FROM sqlite_master WHERE type='table'")}
    assert {"rooms", "readings"} <= tables
    assert conn.execute("PRAGMA user_version").fetchone()[0] == SCHEMA_VERSION


def test_migrate_is_idempotent(conn):
    migrate(conn)
    migrate(conn)
    assert conn.execute("PRAGMA user_version").fetchone()[0] == SCHEMA_VERSION


def test_connection_pragmas(conn):
    assert conn.execute("PRAGMA journal_mode").fetchone()[0] == "wal"
    assert conn.execute("PRAGMA foreign_keys").fetchone()[0] == 1
    assert conn.execute("PRAGMA synchronous").fetchone()[0] == 1  # NORMAL
    assert conn.execute("PRAGMA busy_timeout").fetchone()[0] == 5000


def test_connect_creates_parent_directory(tmp_path):
    c = connect(tmp_path / "nested" / "dir" / "x.sqlite3")
    c.close()
    assert (tmp_path / "nested" / "dir" / "x.sqlite3").exists()
