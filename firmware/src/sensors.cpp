#include "sensors.h"

#include <Arduino.h>
#include <Wire.h>

#include "config.h"
#include "sensor_codec.h"

namespace {

constexpr int SDA_PIN = 6;
constexpr int SCL_PIN = 7;
#if ENABLE_SHT40
uint8_t sht_addr = 0;  // 0 = not found yet; probed on every read until it answers
#endif
#if ENABLE_AHT20
constexpr uint8_t AHT20_ADDR = 0x38;
bool aht_ready = false;
#endif

bool present(uint8_t addr) {
  Wire.beginTransmission(addr);
  return Wire.endTransmission() == 0;
}

bool read_bytes(uint8_t addr, uint8_t *buf, uint8_t n) {
  if (Wire.requestFrom(addr, n) != n) return false;
  for (uint8_t i = 0; i < n; i++) buf[i] = Wire.read();
  return true;
}

#if ENABLE_SHT40
bool read_sht4x(int16_t &t, int16_t &h) {
  if (!sht_addr) {
    for (uint8_t a = 0x44; a <= 0x46 && !sht_addr; a++) {
      if (present(a)) sht_addr = a;
    }
  }
  if (!sht_addr) return false;
  Wire.beginTransmission(sht_addr);
  Wire.write(0xFD);  // T + RH, high precision, heater off
  uint8_t raw[6];
  if (Wire.endTransmission() != 0) {
    sht_addr = 0;
    return false;
  }
  delay(10);
  if (!read_bytes(sht_addr, raw, 6) || !sht4x_decode(raw, t, h)) {
    sht_addr = 0;
    return false;
  }
  return true;
}

#endif

#if ENABLE_AHT20
bool init_aht20() {
  uint8_t status;
  if (!present(AHT20_ADDR) || !read_bytes(AHT20_ADDR, &status, 1)) return false;
  if (!(status & 0x08)) {  // not calibrated yet: send the init command
    Wire.beginTransmission(AHT20_ADDR);
    Wire.write(0xBE);
    Wire.write(0x08);
    Wire.write(0x00);
    if (Wire.endTransmission() != 0) return false;
    delay(10);
  }
  return true;
}

bool read_aht20(int16_t &t, int16_t &h) {
  if (!aht_ready) aht_ready = init_aht20();
  if (!aht_ready) return false;
  Wire.beginTransmission(AHT20_ADDR);
  Wire.write(0xAC);  // trigger measurement
  Wire.write(0x33);
  Wire.write(0x00);
  uint8_t raw[7];
  if (Wire.endTransmission() != 0) {
    aht_ready = false;
    return false;
  }
  delay(80);
  if (!read_bytes(AHT20_ADDR, raw, 7) || !aht20_decode(raw, t, h)) {
    aht_ready = false;
    return false;
  }
  return true;
}

#endif

}  // namespace

void sensors_begin() {
  Wire.begin(SDA_PIN, SCL_PIN, 100000);
  delay(40);  // AHT20 needs 40 ms after power-on
}

void sensors_read(Reading &r) {
#if ENABLE_SHT40
  if (read_sht4x(r.st, r.sh)) r.flags |= HAS_SHT40;
#endif
#if ENABLE_AHT20
  if (read_aht20(r.at, r.ah)) r.flags |= HAS_AHT20;
#endif
}
