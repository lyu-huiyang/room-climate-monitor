#pragma once
#include <cstdint>

enum : uint8_t { HAS_SHT40 = 1, HAS_AHT20 = 2, HAS_RSSI = 4 };

// One 10-second sample. Temperatures and humidities are hundredths
// (24.31 °C -> 2431) so a reading packs into 16 bytes and RING_CAPACITY of them fit in RingStore.
struct Reading {
  uint32_t ts;     // UTC unix seconds
  int16_t st, sh;  // SHT40 temperature (c°C), humidity (c%RH)
  int16_t at, ah;  // AHT20 temperature, humidity
  int8_t rssi;     // Wi-Fi RSSI, dBm
  uint8_t flags;   // HAS_SHT40 | HAS_AHT20 | HAS_RSSI
  uint8_t reserved[2];  // explicit padding so the checksum covers defined bytes
};
static_assert(sizeof(Reading) == 16, "Reading layout is part of the RingStore format; bump RING_MAGIC if it changes");

// A reading with neither sensor is useless: the server rejects it (docs/design/server-web.md §4.1).
inline bool has_sensor_data(const Reading &r) { return r.flags & (HAS_SHT40 | HAS_AHT20); }
