"""The firmware's upload body must pass the server's validation unchanged.

FIRMWARE_PAYLOAD is copied verbatim from test_single_full_reading in
firmware/test/test_payload/test_payload.cpp; keep the two in sync.
"""

import json

from rcm.validation import parse_upload

FIRMWARE_PAYLOAD = (
    '{"readings":[{"ts":1792308900,"sensors":{"sht40":{"t":24.31,"h":52.10},'
    '"aht20":{"t":24.55,"h":50.80}},"rssi":-58}]}'
)


def test_server_accepts_the_firmware_payload():
    items, rejected = parse_upload(json.loads(FIRMWARE_PAYLOAD), 1_792_308_900)
    assert rejected == 0
    assert items == [
        {"ts": 1_792_308_900, "sensors": {"sht40": (24.31, 52.1), "aht20": (24.55, 50.8)}, "rssi": -58}
    ]
