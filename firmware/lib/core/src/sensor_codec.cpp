#include "sensor_codec.h"

uint8_t sensirion_crc8(const uint8_t *data, int len) {
  uint8_t crc = 0xFF;
  for (int i = 0; i < len; i++) {
    crc ^= data[i];
    for (int bit = 0; bit < 8; bit++) crc = (crc & 0x80) ? (crc << 1) ^ 0x31 : crc << 1;
  }
  return crc;
}

bool sht4x_decode(const uint8_t raw[6], int16_t &t_centi, int16_t &h_centi) {
  if (sensirion_crc8(raw, 2) != raw[2] || sensirion_crc8(raw + 3, 2) != raw[5]) return false;
  uint32_t t_raw = (raw[0] << 8) | raw[1];
  uint32_t rh_raw = (raw[3] << 8) | raw[4];
  // Datasheet: T = -45 + 175 * raw / 65535, RH = -6 + 125 * raw / 65535; integer, rounded.
  t_centi = static_cast<int16_t>(-4500 + static_cast<int32_t>((17500u * t_raw + 32767u) / 65535u));
  int32_t rh = -600 + static_cast<int32_t>((12500u * rh_raw + 32767u) / 65535u);
  h_centi = static_cast<int16_t>(rh < 0 ? 0 : (rh > 10000 ? 10000 : rh));
  return true;
}

bool aht20_decode(const uint8_t raw[7], int16_t &t_centi, int16_t &h_centi) {
  if (aht20_frame_status(raw) != Aht20Frame::Ok) return false;
  uint64_t hum_raw = (static_cast<uint32_t>(raw[1]) << 12) | (raw[2] << 4) | (raw[3] >> 4);
  uint64_t temp_raw = (static_cast<uint32_t>(raw[3] & 0x0F) << 16) | (raw[4] << 8) | raw[5];
  // Datasheet: RH = raw / 2^20 * 100, T = raw / 2^20 * 200 - 50; integer, rounded.
  h_centi = static_cast<int16_t>((hum_raw * 10000 + (1u << 19)) >> 20);
  t_centi = static_cast<int16_t>(static_cast<int32_t>((temp_raw * 20000 + (1u << 19)) >> 20) - 5000);
  return true;
}

Aht20Frame aht20_frame_status(const uint8_t raw[7]) {
  if (raw[0] & 0x80) return Aht20Frame::Busy;  // still measuring
  if (sensirion_crc8(raw, 6) != raw[6]) return Aht20Frame::BadCrc;
  return Aht20Frame::Ok;
}
