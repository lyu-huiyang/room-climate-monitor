#include <unity.h>

#include "sensor_codec.h"

void setUp() {}
void tearDown() {}

// Builds an SHT4x frame with correct CRCs (sensirion_crc8 is pinned by the datasheet test).
static void sht_frame(uint16_t t_raw, uint16_t rh_raw, uint8_t out[6]) {
  out[0] = t_raw >> 8;
  out[1] = t_raw & 0xFF;
  out[2] = sensirion_crc8(out, 2);
  out[3] = rh_raw >> 8;
  out[4] = rh_raw & 0xFF;
  out[5] = sensirion_crc8(out + 3, 2);
}

// Builds an AHT20 frame: status byte, 20-bit humidity and temperature, CRC over the first 6 bytes.
static void aht_frame(uint8_t status, uint32_t hum_raw, uint32_t temp_raw, uint8_t out[7]) {
  out[0] = status;
  out[1] = (hum_raw >> 12) & 0xFF;
  out[2] = (hum_raw >> 4) & 0xFF;
  out[3] = ((hum_raw & 0x0F) << 4) | ((temp_raw >> 16) & 0x0F);
  out[4] = (temp_raw >> 8) & 0xFF;
  out[5] = temp_raw & 0xFF;
  out[6] = sensirion_crc8(out, 6);
}

void test_crc8_matches_datasheet_example() {
  const uint8_t data[] = {0xBE, 0xEF};
  TEST_ASSERT_EQUAL_HEX8(0x92, sensirion_crc8(data, 2));
}

void test_sht4x_decodes_temperature_and_humidity() {
  uint8_t raw[6];
  sht_frame(0x6666, 0x8000, raw);  // 25.00 °C, 56.50 %RH
  int16_t t = 0, h = 0;
  TEST_ASSERT_TRUE(sht4x_decode(raw, t, h));
  TEST_ASSERT_EQUAL_INT16(2500, t);
  TEST_ASSERT_EQUAL_INT16(5650, h);
}

void test_sht4x_negative_temperature_and_clamped_humidity() {
  uint8_t raw[6];
  int16_t t = 0, h = 0;
  sht_frame(0x0000, 0xFFFF, raw);
  TEST_ASSERT_TRUE(sht4x_decode(raw, t, h));
  TEST_ASSERT_EQUAL_INT16(-4500, t);
  TEST_ASSERT_EQUAL_INT16(10000, h);
  sht_frame(0x0000, 0x0000, raw);
  TEST_ASSERT_TRUE(sht4x_decode(raw, t, h));
  TEST_ASSERT_EQUAL_INT16(0, h);
}

void test_sht4x_rejects_bad_crc() {
  uint8_t raw[6];
  sht_frame(0x6666, 0x8000, raw);
  raw[5] ^= 0x01;
  int16_t t = 0, h = 0;
  TEST_ASSERT_FALSE(sht4x_decode(raw, t, h));
}

void test_aht20_decodes_temperature_and_humidity() {
  uint8_t raw[7];
  aht_frame(0x1C, 0x80000, 0x60000, raw);  // 50.00 %RH, 25.00 °C
  int16_t t = 0, h = 0;
  TEST_ASSERT_TRUE(aht20_decode(raw, t, h));
  TEST_ASSERT_EQUAL_INT16(2500, t);
  TEST_ASSERT_EQUAL_INT16(5000, h);
}

void test_aht20_rejects_busy_and_bad_crc() {
  uint8_t raw[7];
  int16_t t = 0, h = 0;
  aht_frame(0x9C, 0x80000, 0x60000, raw);  // busy bit set
  TEST_ASSERT_FALSE(aht20_decode(raw, t, h));
  aht_frame(0x1C, 0x80000, 0x60000, raw);
  raw[6] ^= 0x01;
  TEST_ASSERT_FALSE(aht20_decode(raw, t, h));
}

void test_aht20_frame_status() {
  uint8_t raw[7];
  aht_frame(0x1C, 0x80000, 0x60000, raw);
  TEST_ASSERT_TRUE(aht20_frame_status(raw) == Aht20Frame::Ok);
  aht_frame(0x9C, 0x80000, 0x60000, raw);
  TEST_ASSERT_TRUE(aht20_frame_status(raw) == Aht20Frame::Busy);
  aht_frame(0x1C, 0x80000, 0x60000, raw);
  raw[6] ^= 0x01;
  TEST_ASSERT_TRUE(aht20_frame_status(raw) == Aht20Frame::BadCrc);
}

int main() {
  UNITY_BEGIN();
  RUN_TEST(test_crc8_matches_datasheet_example);
  RUN_TEST(test_sht4x_decodes_temperature_and_humidity);
  RUN_TEST(test_sht4x_negative_temperature_and_clamped_humidity);
  RUN_TEST(test_sht4x_rejects_bad_crc);
  RUN_TEST(test_aht20_decodes_temperature_and_humidity);
  RUN_TEST(test_aht20_rejects_busy_and_bad_crc);
  RUN_TEST(test_aht20_frame_status);
  return UNITY_END();
}
