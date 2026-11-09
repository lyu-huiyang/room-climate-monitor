#include <unity.h>

#include "policy.h"

void setUp() {}
void tearDown() {}

void test_classify_upload() {
  TEST_ASSERT_TRUE(classify_upload(404) == UploadOutcome::Retry);  // room not registered yet: keep the data
  TEST_ASSERT_TRUE(classify_upload(401) == UploadOutcome::Drop);
  TEST_ASSERT_TRUE(classify_upload(503) == UploadOutcome::Retry);
  TEST_ASSERT_TRUE(classify_upload(200) == UploadOutcome::Sent);
  TEST_ASSERT_TRUE(classify_upload(204) == UploadOutcome::Sent);
  TEST_ASSERT_TRUE(classify_upload(400) == UploadOutcome::Drop);
  TEST_ASSERT_TRUE(classify_upload(401) == UploadOutcome::Drop);
  TEST_ASSERT_TRUE(classify_upload(413) == UploadOutcome::Drop);
  TEST_ASSERT_TRUE(classify_upload(429) == UploadOutcome::Retry);
  TEST_ASSERT_TRUE(classify_upload(500) == UploadOutcome::Retry);
  TEST_ASSERT_TRUE(classify_upload(502) == UploadOutcome::Retry);
  TEST_ASSERT_TRUE(classify_upload(503) == UploadOutcome::Retry);
  TEST_ASSERT_TRUE(classify_upload(403) == UploadOutcome::Retry);  // e.g. URL permissions: keep data
  TEST_ASSERT_TRUE(classify_upload(-1) == UploadOutcome::Retry);   // connection refused / TLS
  TEST_ASSERT_TRUE(classify_upload(-11) == UploadOutcome::Retry);  // read timeout
}

void test_seconds_to_next_sample() {
  TEST_ASSERT_EQUAL_UINT32(10, SAMPLE_PERIOD_S);
  TEST_ASSERT_EQUAL_UINT32(10, seconds_to_next_sample(1760184000));  // exactly on a 10 s boundary
  TEST_ASSERT_EQUAL_UINT32(7, seconds_to_next_sample(1760184003));
  TEST_ASSERT_EQUAL_UINT32(1, seconds_to_next_sample(1760184059));
}

void test_upload_only_in_the_first_sample_slot_of_each_minute() {
  TEST_ASSERT_TRUE(is_upload_slot(1760184000));   // :00
  TEST_ASSERT_TRUE(is_upload_slot(1760184009));   // a late :00 sample still uploads
  TEST_ASSERT_FALSE(is_upload_slot(1760184010));  // :10
  TEST_ASSERT_FALSE(is_upload_slot(1760184050));  // :50
}

void test_wifi_reset_after_five_minutes() {
  TEST_ASSERT_FALSE(should_reset_wifi(1000 + WIFI_RESET_AFTER_MS - 1, 1000));
  TEST_ASSERT_TRUE(should_reset_wifi(1000 + WIFI_RESET_AFTER_MS, 1000));
}

void test_reboot_after_thirty_minutes() {
  TEST_ASSERT_FALSE(should_reboot(5000 + REBOOT_AFTER_MS - 1, 5000));
  TEST_ASSERT_TRUE(should_reboot(5000 + REBOOT_AFTER_MS, 5000));
}

void test_timers_survive_millis_wraparound() {
  uint32_t before_wrap = 0xFFFFFF00u;
  TEST_ASSERT_FALSE(should_reset_wifi(100, before_wrap));   // only 356 ms elapsed
  TEST_ASSERT_FALSE(should_reboot(100, before_wrap));
  TEST_ASSERT_TRUE(should_reboot(before_wrap + REBOOT_AFTER_MS, before_wrap));  // wraps past 0
}

void test_clock_is_set_only_after_2025() {
  TEST_ASSERT_FALSE(clock_is_set(0));
  TEST_ASSERT_FALSE(clock_is_set(86400));  // 1970-01-02, an unsynced RTC
  TEST_ASSERT_FALSE(clock_is_set(MIN_VALID_EPOCH - 1));
  TEST_ASSERT_TRUE(clock_is_set(MIN_VALID_EPOCH));
  TEST_ASSERT_TRUE(clock_is_set(1791727200));
}

void test_clock_is_trusted_only_after_a_sync_this_boot() {
  // After a soft or watchdog reset the clock is restored from the drifting RTC
  // slow clock: a plausible year is not enough, SNTP must have synced this boot.
  TEST_ASSERT_FALSE(clock_is_trusted(1791727200, false));
  TEST_ASSERT_FALSE(clock_is_trusted(86400, true));
  TEST_ASSERT_TRUE(clock_is_trusted(1791727200, true));
}

void test_wait_is_over_at_target_or_when_clock_steps_back() {
  uint32_t target = 1791727260;
  TEST_ASSERT_FALSE(wait_is_over(target - 30, target));
  TEST_ASSERT_FALSE(wait_is_over(target - 60, target));
  TEST_ASSERT_TRUE(wait_is_over(target, target));
  TEST_ASSERT_TRUE(wait_is_over(target + 5, target));
  // SNTP stepped a fast clock back 40 min: the old target is stale, stop waiting.
  TEST_ASSERT_TRUE(wait_is_over(target - 40 * 60, target));
}

void test_ntp_is_kicked_when_wifi_comes_up_before_a_sync() {
  // SNTP's first request can go out before Wi-Fi is up; lwIP then backs off
  // for minutes, and sampling waits for a sync. Kick it on the connect edge.
  TEST_ASSERT_TRUE(should_kick_ntp(true, false, false));    // just connected, not synced
  TEST_ASSERT_FALSE(should_kick_ntp(true, true, false));    // already connected last check
  TEST_ASSERT_FALSE(should_kick_ntp(true, false, true));    // already synced this boot
  TEST_ASSERT_FALSE(should_kick_ntp(false, false, false));  // still offline
}

int main() {
  UNITY_BEGIN();
  RUN_TEST(test_classify_upload);
  RUN_TEST(test_seconds_to_next_sample);
  RUN_TEST(test_upload_only_in_the_first_sample_slot_of_each_minute);
  RUN_TEST(test_wifi_reset_after_five_minutes);
  RUN_TEST(test_reboot_after_thirty_minutes);
  RUN_TEST(test_timers_survive_millis_wraparound);
  RUN_TEST(test_clock_is_set_only_after_2025);
  RUN_TEST(test_ntp_is_kicked_when_wifi_comes_up_before_a_sync);
  RUN_TEST(test_clock_is_trusted_only_after_a_sync_this_boot);
  RUN_TEST(test_wait_is_over_at_target_or_when_clock_steps_back);
  return UNITY_END();
}
