#include <unity.h>

#include <cstring>

#include "payload.h"

static char out[PAYLOAD_CAP];

void setUp() { memset(out, 0, sizeof out); }
void tearDown() {}

static Reading full(uint32_t ts) {
  Reading r{};
  r.ts = ts;
  r.st = 2431;
  r.sh = 5210;
  r.at = 2455;
  r.ah = 5080;
  r.rssi = -58;
  r.flags = HAS_SHT40 | HAS_AHT20 | HAS_RSSI;
  return r;
}

// server/tests/test_firmware_payload.py checks that the server accepts exactly this string.
void test_single_full_reading() {
  Reading r = full(1792308900);
  size_t len = build_payload(&r, 1, out, sizeof out);
  const char *expected =
      "{\"readings\":[{\"ts\":1792308900,\"sensors\":{\"sht40\":{\"t\":24.31,\"h\":52.10},"
      "\"aht20\":{\"t\":24.55,\"h\":50.80}},\"rssi\":-58}]}";
  TEST_ASSERT_EQUAL_STRING(expected, out);
  TEST_ASSERT_EQUAL(strlen(expected), len);
}

void test_missing_sensor_and_rssi_are_omitted() {
  Reading r = full(1792308900);
  r.flags = HAS_SHT40;
  build_payload(&r, 1, out, sizeof out);
  TEST_ASSERT_EQUAL_STRING(
      "{\"readings\":[{\"ts\":1792308900,\"sensors\":{\"sht40\":{\"t\":24.31,\"h\":52.10}}}]}", out);
}

void test_only_aht20_has_no_leading_comma() {
  Reading r = full(60);
  r.flags = HAS_AHT20 | HAS_RSSI;
  build_payload(&r, 1, out, sizeof out);
  TEST_ASSERT_EQUAL_STRING("{\"readings\":[{\"ts\":60,\"sensors\":{\"aht20\":{\"t\":24.55,\"h\":50.80}},\"rssi\":-58}]}",
                           out);
}

void test_negative_and_small_values_keep_two_decimals() {
  Reading r{};
  r.ts = 1;
  r.flags = HAS_SHT40 | HAS_AHT20;
  r.st = -5;
  r.sh = 7;
  r.at = -1230;
  r.ah = 10000;
  build_payload(&r, 1, out, sizeof out);
  TEST_ASSERT_EQUAL_STRING(
      "{\"readings\":[{\"ts\":1,\"sensors\":{\"sht40\":{\"t\":-0.05,\"h\":0.07},"
      "\"aht20\":{\"t\":-12.30,\"h\":100.00}}}]}",
      out);
}

void test_readings_are_comma_separated() {
  Reading rs[2] = {full(60), full(120)};
  rs[0].flags = HAS_AHT20;
  rs[1].flags = HAS_RSSI | HAS_SHT40;
  build_payload(rs, 2, out, sizeof out);
  TEST_ASSERT_EQUAL_STRING(
      "{\"readings\":[{\"ts\":60,\"sensors\":{\"aht20\":{\"t\":24.55,\"h\":50.80}}},"
      "{\"ts\":120,\"sensors\":{\"sht40\":{\"t\":24.31,\"h\":52.10}},\"rssi\":-58}]}",
      out);
}

void test_zero_readings_is_an_empty_array() {
  TEST_ASSERT_EQUAL(15, build_payload(nullptr, 0, out, sizeof out));
  TEST_ASSERT_EQUAL_STRING("{\"readings\":[]}", out);
}

void test_too_small_buffer_returns_zero() {
  Reading r = full(1792308900);
  TEST_ASSERT_EQUAL(0, build_payload(&r, 1, out, 20));
}

void test_worst_case_batch_fits() {
  static Reading rs[MAX_BATCH];
  for (auto &r : rs) {
    r = full(4294967295u);
    r.st = r.at = -4500;
    r.sh = r.ah = 10000;
    r.rssi = -127;
  }
  size_t len = build_payload(rs, MAX_BATCH, out, sizeof out);
  TEST_ASSERT_GREATER_THAN(0, len);
  TEST_ASSERT_LESS_THAN(PAYLOAD_CAP, len);
  TEST_ASSERT_EQUAL_STRING("]}", out + len - 2);
}

int main() {
  UNITY_BEGIN();
  RUN_TEST(test_single_full_reading);
  RUN_TEST(test_missing_sensor_and_rssi_are_omitted);
  RUN_TEST(test_only_aht20_has_no_leading_comma);
  RUN_TEST(test_negative_and_small_values_keep_two_decimals);
  RUN_TEST(test_readings_are_comma_separated);
  RUN_TEST(test_zero_readings_is_an_empty_array);
  RUN_TEST(test_too_small_buffer_returns_zero);
  RUN_TEST(test_worst_case_batch_fits);
  return UNITY_END();
}
