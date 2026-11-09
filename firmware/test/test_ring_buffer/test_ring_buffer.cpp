#include <unity.h>

#include <cstring>

#include "reading.h"
#include "ring_buffer.h"

static RingStore store;

static Reading at(uint32_t ts) {
  Reading r{};
  r.ts = ts;
  r.st = 2431;
  r.sh = 5210;
  r.flags = HAS_SHT40;
  return r;
}

void setUp() {
  memset(&store, 0xA5, sizeof store);
  ring_restore(store);
}

void tearDown() {}

void test_garbage_is_reset_to_empty() {
  memset(&store, 0x5A, sizeof store);
  TEST_ASSERT_FALSE(ring_restore(store));
  TEST_ASSERT_EQUAL(0, ring_count(store));
}

void test_valid_store_survives_restore() {
  ring_push(store, at(100));
  ring_push(store, at(160));
  TEST_ASSERT_TRUE(ring_restore(store));
  TEST_ASSERT_EQUAL(2, ring_count(store));
}

void test_corrupted_item_is_detected() {
  ring_push(store, at(100));
  store.items[0].st ^= 1;
  TEST_ASSERT_FALSE(ring_restore(store));
  TEST_ASSERT_EQUAL(0, ring_count(store));
}

void test_peek_is_oldest_first_and_drop_removes_them() {
  for (uint32_t t = 0; t < 5; t++) ring_push(store, at(t));
  Reading out[3];
  TEST_ASSERT_EQUAL(3, ring_peek(store, out, 3));
  TEST_ASSERT_EQUAL_UINT32(0, out[0].ts);
  TEST_ASSERT_EQUAL_UINT32(2, out[2].ts);
  ring_drop(store, 3);
  TEST_ASSERT_EQUAL(2, ring_count(store));
  TEST_ASSERT_EQUAL(1, ring_peek(store, out, 1));
  TEST_ASSERT_EQUAL_UINT32(3, out[0].ts);
}

void test_full_buffer_overwrites_oldest() {
  for (uint32_t t = 0; t < RING_CAPACITY + 5; t++) ring_push(store, at(t));
  TEST_ASSERT_EQUAL(RING_CAPACITY, ring_count(store));
  Reading out[1];
  ring_peek(store, out, 1);
  TEST_ASSERT_EQUAL_UINT32(5, out[0].ts);
}

void test_wraparound_keeps_order_across_restore() {
  for (uint32_t t = 0; t < RING_CAPACITY + 7; t++) ring_push(store, at(t));
  ring_drop(store, 10);
  TEST_ASSERT_TRUE(ring_restore(store));
  static Reading out[RING_CAPACITY];
  size_t n = ring_peek(store, out, RING_CAPACITY);
  TEST_ASSERT_EQUAL(RING_CAPACITY - 10, n);
  for (size_t i = 0; i < n; i++) TEST_ASSERT_EQUAL_UINT32(17 + i, out[i].ts);
}

void test_drop_more_than_count_empties() {
  ring_push(store, at(1));
  ring_drop(store, 5);
  TEST_ASSERT_EQUAL(0, ring_count(store));
  TEST_ASSERT_TRUE(ring_restore(store));
}

void test_has_sensor_data() {
  Reading r{};
  TEST_ASSERT_FALSE(has_sensor_data(r));
  r.flags = HAS_RSSI;
  TEST_ASSERT_FALSE(has_sensor_data(r));
  r.flags = HAS_AHT20;
  TEST_ASSERT_TRUE(has_sensor_data(r));
  r.flags = HAS_SHT40 | HAS_RSSI;
  TEST_ASSERT_TRUE(has_sensor_data(r));
}

void test_capacity_covers_three_hours_of_10s_samples() {
  TEST_ASSERT_EQUAL(3 * 3600 / 10, RING_CAPACITY);
}

void test_buffer_sealed_by_prototype_firmware_is_reset() {
  // A store left in no-init RAM by the prototype firmware ("NRS2") must not be uploaded again.
  static RingStore s;
  ring_restore(s);
  Reading r{};
  r.ts = 1;
  r.flags = HAS_SHT40;
  ring_push(s, r);
  s.magic = 0x4E525332;  // as if the prototype firmware had left it; passes restore while RING_MAGIC is still "NRS2"
  TEST_ASSERT_FALSE(ring_restore(s));
  TEST_ASSERT_EQUAL(0, ring_count(s));
  TEST_ASSERT_EQUAL_HEX32(0x52434D31, RING_MAGIC);  // "RCM1"
}

int main() {
  UNITY_BEGIN();
  RUN_TEST(test_garbage_is_reset_to_empty);
  RUN_TEST(test_valid_store_survives_restore);
  RUN_TEST(test_corrupted_item_is_detected);
  RUN_TEST(test_peek_is_oldest_first_and_drop_removes_them);
  RUN_TEST(test_full_buffer_overwrites_oldest);
  RUN_TEST(test_wraparound_keeps_order_across_restore);
  RUN_TEST(test_drop_more_than_count_empties);
  RUN_TEST(test_has_sensor_data);
  RUN_TEST(test_capacity_covers_three_hours_of_10s_samples);
  RUN_TEST(test_buffer_sealed_by_prototype_firmware_is_reset);
  return UNITY_END();
}
