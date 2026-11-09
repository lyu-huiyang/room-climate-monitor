#pragma once
#include <cstddef>

#include "reading.h"

constexpr size_t MAX_BATCH = 100;          // server limit: at most 100 readings per request
constexpr size_t PAYLOAD_CAP = 12 * 1024;  // a worst-case 100-reading body is under 11 KB

// Builds the body of POST /api/rooms/{room_id}/readings:
//   {"readings":[{"ts":…,"sensors":{"sht40":{"t":…,"h":…},"aht20":{…}},"rssi":…}]}
// A missing sensor or RSSI omits its key. Returns the JSON length, or 0 if it does not fit in cap.
size_t build_payload(const Reading *items, size_t n, char *out, size_t cap);
