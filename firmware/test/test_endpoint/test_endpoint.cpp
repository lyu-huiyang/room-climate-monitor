#include <unity.h>

#include <cstring>

#include "endpoint.h"

static char out[UPLOAD_URL_CAP];

void setUp() { memset(out, 0, sizeof out); }
void tearDown() {}

// config.h relies on these being usable in static_assert.
static_assert(is_valid_room_id("living-room") && has_http_scheme("http://x") && !is_https("http://x") &&
                  upload_url_fits("http://x", "a") && same_string("a", "a"),
              "the validators must be usable at compile time");

void test_url_without_trailing_slash() {
  TEST_ASSERT_TRUE(build_upload_url("http://192.168.1.10:8080", "living-room", out, sizeof out));
  TEST_ASSERT_EQUAL_STRING("http://192.168.1.10:8080/api/rooms/living-room/readings", out);
}

void test_trailing_slashes_are_dropped() {
  TEST_ASSERT_TRUE(build_upload_url("https://climate.example.com//", "bedroom", out, sizeof out));
  TEST_ASSERT_EQUAL_STRING("https://climate.example.com/api/rooms/bedroom/readings", out);
}

void test_url_that_does_not_fit_returns_false() {
  TEST_ASSERT_FALSE(build_upload_url("http://192.168.1.10:8080", "living-room", out, 20));
}

void test_scheme_detection() {
  TEST_ASSERT_TRUE(is_https("https://a"));
  TEST_ASSERT_FALSE(is_https("http://a"));
  TEST_ASSERT_TRUE(has_http_scheme("http://a"));
  TEST_ASSERT_TRUE(has_http_scheme("https://a"));
  TEST_ASSERT_FALSE(has_http_scheme("ftp://a"));
  TEST_ASSERT_FALSE(has_http_scheme("192.168.1.10:8080"));
  TEST_ASSERT_FALSE(has_http_scheme("http://"));
  TEST_ASSERT_FALSE(has_http_scheme("https://"));
}

void test_room_id_rules_match_the_server() {
  TEST_ASSERT_TRUE(is_valid_room_id("living-room"));
  TEST_ASSERT_TRUE(is_valid_room_id("a"));
  TEST_ASSERT_TRUE(is_valid_room_id("abcdefghijklmnopqrstuvwxyz012345"));    // 32
  TEST_ASSERT_FALSE(is_valid_room_id("abcdefghijklmnopqrstuvwxyz0123456"));  // 33
  TEST_ASSERT_FALSE(is_valid_room_id(""));
  TEST_ASSERT_FALSE(is_valid_room_id("Living Room"));
  TEST_ASSERT_FALSE(is_valid_room_id("a_b"));
}

void test_compile_time_fit_check_matches_build_upload_url() {
  // "http://h/api/rooms/r/readings" is 29 characters: it needs a buffer of 30.
  const char *urls[] = {"http://h", "http://h/", "http://h///"};
  for (const char *url : urls) {
    for (size_t cap = 25; cap <= 35; cap++) {
      TEST_ASSERT_EQUAL(build_upload_url(url, "r", out, cap), upload_url_fits(url, "r", cap));
    }
    TEST_ASSERT_FALSE(upload_url_fits(url, "r", 29));
    TEST_ASSERT_TRUE(upload_url_fits(url, "r", 30));
  }
}

void test_same_string() {
  TEST_ASSERT_TRUE(same_string("living-room", "living-room"));
  TEST_ASSERT_TRUE(same_string("", ""));
  TEST_ASSERT_FALSE(same_string("living-room", "living-room-2"));
  TEST_ASSERT_FALSE(same_string("bedroom", "living-room"));
}

int main() {
  UNITY_BEGIN();
  RUN_TEST(test_url_without_trailing_slash);
  RUN_TEST(test_trailing_slashes_are_dropped);
  RUN_TEST(test_url_that_does_not_fit_returns_false);
  RUN_TEST(test_scheme_detection);
  RUN_TEST(test_room_id_rules_match_the_server);
  RUN_TEST(test_compile_time_fit_check_matches_build_upload_url);
  RUN_TEST(test_same_string);
  return UNITY_END();
}
