import pytest
from conftest import NOW

from rcm.readings import count_readings, history, latest, latest_ts, put_readings

MINUTE = NOW - NOW % 60
QUARTER = NOW - NOW % 900


def item(ts, rssi=-58, **sensors):
    return {"ts": ts, "sensors": sensors, "rssi": rssi}


def test_put_is_idempotent_and_overwrites(conn, room):
    put_readings(conn, "living-room", [item(NOW, sht40=(24.0, 50.0))])
    put_readings(conn, "living-room", [item(NOW, sht40=(25.0, 51.0))])
    assert count_readings(conn, "living-room") == 1
    assert latest(conn, "living-room", NOW)["sensors"] == {"sht40": {"t": 25.0, "h": 51.0}}


def test_latest_returns_newest_ts_with_all_sensors(conn, room):
    put_readings(
        conn,
        "living-room",
        [
            item(NOW - 120, sht40=(20.0, 40.0), aht20=(21.0, 41.0)),
            item(NOW - 60, rssi=-61, sht40=(24.31, 52.1), aht20=(24.55, 50.8)),
        ],
    )
    assert latest(conn, "living-room", NOW) == {
        "ts": NOW - 60,
        "age_s": 60,
        "sensors": {"aht20": {"t": 24.55, "h": 50.8}, "sht40": {"t": 24.31, "h": 52.1}},
        "rssi": -61,
    }
    assert latest_ts(conn, "living-room") == NOW - 60


def test_latest_age_never_negative(conn, room):
    put_readings(conn, "living-room", [item(NOW + 120, sht40=(24.0, 50.0))])
    assert latest(conn, "living-room", NOW)["age_s"] == 0


def test_latest_is_none_without_data(conn, room):
    assert latest(conn, "living-room", NOW) is None
    assert latest_ts(conn, "living-room") is None
    assert count_readings(conn, "living-room") == 0


def test_latest_ignores_data_older_than_30_days(conn, room):
    put_readings(conn, "living-room", [item(NOW - 30 * 86400 - 1, sht40=(24.0, 50.0))])
    assert latest(conn, "living-room", NOW) is None
    put_readings(conn, "living-room", [item(NOW - 30 * 86400, sht40=(24.0, 50.0))])
    assert latest(conn, "living-room", NOW)["ts"] == NOW - 30 * 86400


def test_history_24h_minute_buckets_average(conn, room):
    base = MINUTE - 600
    put_readings(conn, "living-room", [item(base + i * 10, sht40=(24.0 + i / 10, 50.0)) for i in range(6)])
    assert history(conn, "living-room", "24h", NOW) == {
        "range": "24h",
        "bucket_s": 60,
        "sensors": ["sht40"],
        "points": [[base, 24.25, 50.0]],
    }


def test_history_8h_window(conn, room):
    put_readings(
        conn, "living-room", [item(NOW - 8 * 3600 - 60, sht40=(20.0, 40.0)), item(MINUTE, sht40=(24.0, 50.0))]
    )
    h = history(conn, "living-room", "8h", NOW)
    assert (h["range"], h["bucket_s"], h["points"]) == ("8h", 60, [[MINUTE, 24.0, 50.0]])


def test_history_7d_uses_900s_buckets(conn, room):
    base = QUARTER - 900
    put_readings(conn, "living-room", [item(base, sht40=(20.0, 40.0)), item(base + 600, sht40=(22.0, 44.0))])
    h = history(conn, "living-room", "7d", NOW)
    assert h["bucket_s"] == 900
    assert h["points"] == [[base, 21.0, 42.0]]


def test_history_fills_null_for_sensor_missing_in_some_buckets(conn, room):
    b1, b2 = MINUTE - 120, MINUTE - 60
    put_readings(
        conn,
        "living-room",
        [item(b1, sht40=(24.0, 50.0)), item(b2, sht40=(25.0, 51.0), aht20=(26.0, 52.0))],
    )
    h = history(conn, "living-room", "24h", NOW)
    assert h["sensors"] == ["aht20", "sht40"]
    assert h["points"] == [[b1, None, None, 24.0, 50.0], [b2, 26.0, 52.0, 25.0, 51.0]]


def test_history_excludes_other_rooms_and_outside_window(conn, room, other_room):
    put_readings(conn, "bedroom", [item(MINUTE, bme280=(30.0, 30.0))])
    put_readings(
        conn,
        "living-room",
        [
            item(NOW - 86400 - 60, sht40=(10.0, 10.0)),
            item(NOW + 360, sht40=(11.0, 11.0)),
            item(MINUTE - 60, sht40=(24.0, 50.0)),
        ],
    )
    h = history(conn, "living-room", "24h", NOW)
    assert h["sensors"] == ["sht40"]
    assert h["points"] == [[MINUTE - 60, 24.0, 50.0]]


def test_history_includes_small_future_skew(conn, room):
    put_readings(conn, "living-room", [item(NOW + 120, sht40=(24.0, 50.0))])
    ts = NOW + 120
    assert history(conn, "living-room", "24h", NOW)["points"] == [[ts - ts % 60, 24.0, 50.0]]


def test_history_empty_room(conn, room):
    h = history(conn, "living-room", "24h", NOW)
    assert h == {"range": "24h", "bucket_s": 60, "sensors": [], "points": []}


def test_history_bad_range_raises(conn, room):
    with pytest.raises(ValueError):
        history(conn, "living-room", "1y", NOW)
