"""Validation of device upload payloads (docs/design/server-web.md §4.1)."""

import re
from typing import TypedDict

MAX_READINGS = 100
MAX_SENSORS = 4
PAST_LIMIT_S = 7 * 24 * 3600
FUTURE_LIMIT_S = 5 * 60
TEMP_RANGE = (-20, 60)
HUMIDITY_RANGE = (0, 100)
RSSI_RANGE = (-127, 0)
SENSOR_NAME_RE = re.compile(r"[a-z0-9_]{1,16}")

type SensorValue = tuple[float, float]


class Reading(TypedDict):
    ts: int
    sensors: dict[str, SensorValue]
    rssi: int | None


class ValidationError(ValueError):
    """The body as a whole is unusable; maps to HTTP 400."""


def _is_int(value: object) -> bool:
    return isinstance(value, int) and not isinstance(value, bool)


def _is_number(value: object) -> bool:
    return isinstance(value, int | float) and not isinstance(value, bool)


def _sensor(raw: object) -> SensorValue | None:
    if not isinstance(raw, dict):
        return None
    t, h = raw.get("t"), raw.get("h")
    if not (_is_number(t) and _is_number(h)):
        return None
    # NaN fails every comparison, so it is rejected here too.
    if not (TEMP_RANGE[0] <= t <= TEMP_RANGE[1] and HUMIDITY_RANGE[0] <= h <= HUMIDITY_RANGE[1]):
        return None
    return round(float(t), 2), round(float(h), 2)


def _reading(raw: object, now: int) -> Reading | None:
    if not isinstance(raw, dict):
        return None
    ts = raw.get("ts")
    if not _is_int(ts) or not (now - PAST_LIMIT_S <= ts <= now + FUTURE_LIMIT_S):
        return None
    raw_sensors = raw.get("sensors")
    if not isinstance(raw_sensors, dict) or len(raw_sensors) > MAX_SENSORS:
        return None
    sensors: dict[str, SensorValue] = {}
    for name, value in raw_sensors.items():
        if not (isinstance(name, str) and SENSOR_NAME_RE.fullmatch(name)):
            continue
        parsed = _sensor(value)
        if parsed is not None:
            sensors[name] = parsed
    if not sensors:
        return None
    rssi = raw.get("rssi")
    if not (_is_int(rssi) and RSSI_RANGE[0] <= rssi <= RSSI_RANGE[1]):
        rssi = None
    return {"ts": ts, "sensors": sensors, "rssi": rssi}


def parse_upload(payload: object, now: int) -> tuple[list[Reading], int]:
    """Validate an upload body.

    Returns the readings sorted by timestamp and unique per timestamp (the last
    one wins), plus the number of readings that were dropped. Raises
    ValidationError when the body itself is malformed.
    """
    if not isinstance(payload, dict):
        raise ValidationError("body must be a JSON object")
    readings = payload.get("readings")
    if not isinstance(readings, list) or not 1 <= len(readings) <= MAX_READINGS:
        raise ValidationError(f"readings must be an array of 1 to {MAX_READINGS} items")
    by_ts: dict[int, Reading] = {}
    rejected = 0
    for raw in readings:
        item = _reading(raw, now)
        if item is None:
            rejected += 1
            continue
        if item["ts"] in by_ts:
            rejected += 1
        by_ts[item["ts"]] = item
    return [by_ts[ts] for ts in sorted(by_ts)], rejected
