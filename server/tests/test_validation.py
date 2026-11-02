import copy

import pytest
from conftest import NOW

from rcm.validation import ValidationError, parse_upload

DEFAULT = {
    "ts": NOW,
    "sensors": {"sht40": {"t": 24.314, "h": 52.1}, "aht20": {"t": 24.55, "h": 50.8}},
    "rssi": -58,
}


def reading(**overrides):
    r = copy.deepcopy(DEFAULT)
    r.update(overrides)
    return r


def body(*readings):
    return {"readings": list(readings)}


def test_valid_reading_keeps_both_sensors_rounded():
    items, rejected = parse_upload(body(reading()), NOW)
    assert rejected == 0
    assert items == [{"ts": NOW, "sensors": {"sht40": (24.31, 52.1), "aht20": (24.55, 50.8)}, "rssi": -58}]


@pytest.mark.parametrize(
    "payload",
    [[], "x", None, {}, {"readings": []}, {"readings": {"ts": 1}}, {"readings": [reading()] * 101}],
)
def test_malformed_body_raises(payload):
    with pytest.raises(ValidationError):
        parse_upload(payload, NOW)


def test_hundred_readings_is_the_limit():
    items, rejected = parse_upload(body(*[reading(ts=NOW - i) for i in range(100)]), NOW)
    assert (len(items), rejected) == (100, 0)


@pytest.mark.parametrize("ts", [NOW - 604801, NOW + 301, "1", 1.0, True, None])
def test_bad_timestamp_rejected(ts):
    items, rejected = parse_upload(body(reading(ts=ts), reading(ts=NOW - 60)), NOW)
    assert rejected == 1
    assert [i["ts"] for i in items] == [NOW - 60]


def test_timestamp_window_edges_accepted():
    items, rejected = parse_upload(body(reading(ts=NOW - 604800), reading(ts=NOW + 300)), NOW)
    assert rejected == 0
    assert [i["ts"] for i in items] == [NOW - 604800, NOW + 300]


@pytest.mark.parametrize("name", ["SHT40", "a-b", "x" * 17, ""])
def test_bad_sensor_name_drops_that_sensor_only(name):
    r = reading(sensors={"sht40": {"t": 24.0, "h": 50.0}, name: {"t": 25.0, "h": 51.0}})
    items, rejected = parse_upload(body(r), NOW)
    assert rejected == 0
    assert items[0]["sensors"] == {"sht40": (24.0, 50.0)}


def test_sensor_name_of_sixteen_chars_accepted():
    name = "a_" + "9" * 14
    items, _ = parse_upload(body(reading(sensors={name: {"t": 20, "h": 40}})), NOW)
    assert items[0]["sensors"] == {name: (20.0, 40.0)}


def test_more_than_four_sensors_rejects_reading():
    sensors = {f"s{i}": {"t": 20.0, "h": 40.0} for i in range(5)}
    items, rejected = parse_upload(body(reading(sensors=sensors)), NOW)
    assert (items, rejected) == ([], 1)


def test_four_sensors_accepted():
    sensors = {f"s{i}": {"t": 20.0, "h": 40.0} for i in range(4)}
    items, rejected = parse_upload(body(reading(sensors=sensors)), NOW)
    assert rejected == 0
    assert len(items[0]["sensors"]) == 4


@pytest.mark.parametrize(
    "value",
    [
        {"t": 85, "h": 50},
        {"t": 24, "h": 100.5},
        {"t": "24", "h": 50},
        {"t": True, "h": 50},
        {"t": float("nan"), "h": 50},
        {"t": 24},
        None,
        [],
    ],
)
def test_unusable_sensor_value_dropped_others_kept(value):
    r = reading(sensors={"sht40": {"t": 24.0, "h": 50.0}, "aht20": value})
    items, rejected = parse_upload(body(r), NOW)
    assert rejected == 0
    assert items[0]["sensors"] == {"sht40": (24.0, 50.0)}


def test_value_range_edges_accepted():
    r = reading(sensors={"a": {"t": -20, "h": 0}, "b": {"t": 60, "h": 100}})
    items, _ = parse_upload(body(r), NOW)
    assert items[0]["sensors"] == {"a": (-20.0, 0.0), "b": (60.0, 100.0)}


@pytest.mark.parametrize("sensors", [{}, {"sht40": {"t": 99, "h": 50}}, [], "x", None])
def test_reading_without_any_usable_sensor_rejected(sensors):
    items, rejected = parse_upload(body(reading(sensors=sensors), reading(ts=NOW - 60)), NOW)
    assert rejected == 1
    assert [i["ts"] for i in items] == [NOW - 60]


@pytest.mark.parametrize("rssi", [5, -128, "x", True, -58.5])
def test_bad_rssi_becomes_none(rssi):
    items, rejected = parse_upload(body(reading(rssi=rssi)), NOW)
    assert rejected == 0
    assert items[0]["rssi"] is None


def test_missing_rssi_is_none():
    r = reading()
    del r["rssi"]
    items, _ = parse_upload(body(r), NOW)
    assert items[0]["rssi"] is None


def test_duplicate_ts_keeps_last_and_sorts():
    first = reading(ts=NOW, sensors={"sht40": {"t": 20.0, "h": 40.0}})
    earlier = reading(ts=NOW - 60)
    last = reading(ts=NOW, sensors={"sht40": {"t": 21.0, "h": 41.0}})
    items, rejected = parse_upload(body(first, earlier, last), NOW)
    assert rejected == 1
    assert [i["ts"] for i in items] == [NOW - 60, NOW]
    assert items[1]["sensors"] == {"sht40": (21.0, 41.0)}


@pytest.mark.parametrize("raw", [1, "x", None, [reading()]])
def test_non_dict_reading_rejected(raw):
    items, rejected = parse_upload(body(raw, reading(ts=NOW - 60)), NOW)
    assert rejected == 1
    assert len(items) == 1
