import io
import json
import sqlite3
import subprocess
import sys
from pathlib import Path

import pytest

from rcm.cli import main
from rcm.db import connect
from rcm.readings import count_readings, put_readings
from rcm.rooms import get_room, hash_key, verify_key

SERVER_DIR = Path(__file__).resolve().parents[1]


@pytest.fixture
def db_path(tmp_path, monkeypatch):
    path = tmp_path / "cli.sqlite3"
    monkeypatch.setenv("RCM_DB_PATH", str(path))
    return path


@pytest.fixture
def run(db_path, capsys):
    def _run(*args):
        code = main(list(args))
        out, err = capsys.readouterr()
        return code, out, err

    return _run


def open_db(path):
    return connect(path)


def test_room_add_prints_key_once_and_list_hides_it(run, db_path):
    code, out, _ = run("room", "add", "living-room", "--name", "客厅")
    assert code == 0
    key = out.strip().splitlines()[-1]
    conn = open_db(db_path)
    assert verify_key(get_room(conn, "living-room"), key)
    code, out, _ = run("room", "list")
    assert code == 0
    assert "living-room" in out and "客厅" in out and "22-26" in out and "40-60" in out
    assert key not in out
    assert hash_key(key) not in out


def test_room_add_with_comfort(run, db_path):
    assert (
        run(
            "room",
            "add",
            "bedroom",
            "--name",
            "卧室",
            "--comfort-temp",
            "20.5-24",
            "--comfort-humidity",
            "45-65",
        )[0]
        == 0
    )
    room = get_room(open_db(db_path), "bedroom")
    assert (room.comfort_t, room.comfort_h) == ((20.5, 24), (45, 65))


def test_room_add_bad_id_exits_2_with_message(run):
    code, _, err = run("room", "add", "Living Room", "--name", "x")
    assert code == 2
    assert "房间 ID" in err and "room id" in err


def test_room_add_duplicate_exits_1(run):
    run("room", "add", "living-room", "--name", "客厅")
    code, _, err = run("room", "add", "living-room", "--name", "again")
    assert code == 1
    assert "已存在" in err and "exists" in err


def test_rename_and_set_comfort(run):
    run("room", "add", "living-room", "--name", "客厅")
    assert run("room", "rename", "living-room", "Living room")[0] == 0
    assert run("room", "set-comfort", "living-room", "--temp", "21-25")[0] == 0
    out = run("room", "list")[1]
    assert "Living room" in out and "21-25" in out and "40-60" in out


def test_set_comfort_bad_range_exits_2(run):
    run("room", "add", "living-room", "--name", "客厅")
    for bad in ["26-22", "abc", "24-24"]:
        assert run("room", "set-comfort", "living-room", "--temp", bad)[0] == 2
    assert run("room", "set-comfort", "living-room")[0] == 2


def test_unknown_room_exits_1(run):
    for args in (
        ["rename", "nope", "x"],
        ["set-comfort", "nope", "--temp", "1-2"],
        ["rotate-key", "nope"],
        ["delete", "nope", "--yes"],
    ):
        code, _, err = run("room", *args)
        assert code == 1
        assert "房间不存在" in err and "room not found" in err


def test_rotate_key_old_key_fails_new_key_works(run, db_path):
    old = run("room", "add", "living-room", "--name", "客厅")[1].strip().splitlines()[-1]
    code, out, _ = run("room", "rotate-key", "living-room")
    assert code == 0
    new = out.strip().splitlines()[-1]
    room = get_room(open_db(db_path), "living-room")
    assert verify_key(room, new) and not verify_key(room, old)


def test_delete_requires_matching_confirmation(run, db_path, monkeypatch):
    run("room", "add", "living-room", "--name", "客厅")
    monkeypatch.setattr(sys, "stdin", io.StringIO("bedroom\n"))
    assert run("room", "delete", "living-room")[0] == 1
    assert get_room(open_db(db_path), "living-room") is not None
    monkeypatch.setattr(sys, "stdin", io.StringIO("living-room\n"))
    assert run("room", "delete", "living-room")[0] == 0
    assert get_room(open_db(db_path), "living-room") is None


def test_delete_with_yes_removes_room_and_readings(run, db_path):
    run("room", "add", "living-room", "--name", "客厅")
    conn = open_db(db_path)
    put_readings(conn, "living-room", [{"ts": 1, "sensors": {"sht40": (24.0, 50.0)}, "rssi": None}])
    assert run("room", "delete", "living-room", "--yes")[0] == 0
    assert get_room(conn, "living-room") is None
    assert count_readings(conn, "living-room") == 0


def test_backup_creates_readable_copy(run, tmp_path):
    run("room", "add", "living-room", "--name", "客厅")
    run("room", "add", "bedroom", "--name", "卧室")
    dest = tmp_path / "backups" / "rcm-backup.sqlite3"
    assert run("backup", str(dest))[0] == 0
    copy = sqlite3.connect(dest)
    assert copy.execute("SELECT COUNT(*) FROM rooms").fetchone()[0] == 2
    assert copy.execute("PRAGMA journal_mode").fetchone()[0] == "delete"
    copy.close()


def test_openapi_prints_json_with_paths(run):
    code, out, _ = run("openapi")
    assert code == 0
    assert "/api/rooms/{room_id}/readings" in json.loads(out)["paths"]


def test_help_exits_0(run):
    assert run("--help")[0] == 0


def test_seed_demo_creates_two_rooms_with_readings(tmp_path):
    db = tmp_path / "demo.sqlite3"
    result = subprocess.run(
        [sys.executable, "scripts/seed_demo.py", "--db", str(db), "--hours", "2"],
        cwd=SERVER_DIR,
        capture_output=True,
        text=True,
        check=True,
    )
    assert "demo-key-living" in result.stdout and "demo-key-bedroom" in result.stdout
    conn = connect(db)
    for room_id, name, key in [
        ("living-room", "客厅", "demo-key-living"),
        ("bedroom", "卧室", "demo-key-bedroom"),
    ]:
        room = get_room(conn, room_id)
        assert room.name == name
        assert verify_key(room, key)
        assert count_readings(conn, room_id) == 2 * 2 * 60


def test_list_columns_align_with_wide_characters(run):
    import unicodedata

    def width(s):
        return sum(2 if unicodedata.east_asian_width(c) in "WF" else 1 for c in s)

    run("room", "add", "bedroom", "--name", "卧室")
    run("room", "add", "living-room", "--name", "Living")
    lines = run("room", "list")[1].splitlines()
    starts = {
        width(line[: line.index(token)])
        for line, token in zip(lines, ["TEMP", "22-26", "22-26"], strict=True)
    }
    assert len(starts) == 1


def test_serve_with_unusable_data_dir_explains_instead_of_crashing(tmp_path, monkeypatch, capsys):
    blocker = tmp_path / "data"
    blocker.write_text("not a directory")
    monkeypatch.setenv("RCM_DB_PATH", str(blocker / "rcm.sqlite3"))

    def no_server(*_args, **_kwargs):
        raise AssertionError("uvicorn must not start")

    monkeypatch.setattr("uvicorn.run", no_server)
    code = main(["serve"])
    err = capsys.readouterr().err
    assert code == 1
    assert str(blocker / "rcm.sqlite3") in err
    assert "10001" in err
    assert "Traceback" not in err


def test_serve_prepares_the_database_before_starting(db_path, monkeypatch):
    started = []
    monkeypatch.setattr("uvicorn.run", lambda *a, **k: started.append(a))
    assert main(["serve"]) == 0
    assert started
    conn = open_db(db_path)
    assert conn.execute("PRAGMA user_version").fetchone()[0] >= 1


def test_serve_with_corrupt_database_points_to_the_backup(tmp_path, monkeypatch, capsys):
    path = tmp_path / "rcm.sqlite3"
    path.write_bytes(b"this is not a database" * 100)
    monkeypatch.setenv("RCM_DB_PATH", str(path))

    def no_server(*_args, **_kwargs):
        raise AssertionError("uvicorn must not start")

    monkeypatch.setattr("uvicorn.run", no_server)
    code = main(["serve"])
    err = capsys.readouterr().err
    assert code == 1
    assert "备份" in err and "backup" in err
    assert "10001" not in err
