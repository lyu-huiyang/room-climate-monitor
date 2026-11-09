#pragma once
#include <cstdint>

// CRC-8 used by both SHT4x and AHT20: polynomial 0x31, init 0xFF.
uint8_t sensirion_crc8(const uint8_t *data, int len);

// SHT4x measurement: T msb, T lsb, CRC, RH msb, RH lsb, CRC. False on CRC mismatch.
// Humidity is clamped to 0..100 %RH as the datasheet recommends.
bool sht4x_decode(const uint8_t raw[6], int16_t &t_centi, int16_t &h_centi);

// AHT20 measurement: status, 20-bit humidity, 20-bit temperature, CRC.
// False while the sensor reports busy (status bit 7) or on CRC mismatch.
bool aht20_decode(const uint8_t raw[7], int16_t &t_centi, int16_t &h_centi);

// Classifies a 7-byte AHT20 frame without decoding it: Busy while status bit 7
// is set, BadCrc when the checksum over the first 6 bytes does not match.
enum class Aht20Frame { Ok, Busy, BadCrc };
Aht20Frame aht20_frame_status(const uint8_t raw[7]);
