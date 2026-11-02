import pytest

from rcm.config import Settings

NOW = 1_792_308_900


@pytest.fixture
def settings(tmp_path):
    return Settings(db_path=tmp_path / "test.sqlite3", host="127.0.0.1", port=8080, static_dir=None)


@pytest.fixture
def conn(settings):
    from rcm.db import connect, migrate

    c = connect(settings.db_path)
    migrate(c)
    yield c
    c.close()


@pytest.fixture
def room(conn):
    from rcm.rooms import create_room

    return create_room(conn, "living-room", "客厅", now=NOW)


@pytest.fixture
def other_room(conn):
    from rcm.rooms import create_room

    return create_room(conn, "bedroom", "卧室", now=NOW)
