#pragma once
#include <cstddef>

// Upload URL and config checks. The validators are C++11 constexpr (single return, recursion) because
// the Arduino-ESP32 2.x toolchain builds the device code as gnu++11; config.h static_asserts with them.

namespace endpoint_detail {
constexpr bool room_char(char c) { return (c >= 'a' && c <= 'z') || (c >= '0' && c <= '9') || c == '-'; }
constexpr bool room_id_from(const char *s, size_t n) {
  return *s == '\0' ? (n >= 1 && n <= 32) : (n < 32 && room_char(*s) && room_id_from(s + 1, n + 1));
}
constexpr bool starts_with(const char *s, const char *prefix) {
  return *prefix == '\0' || (*s == *prefix && starts_with(s + 1, prefix + 1));
}
constexpr size_t length(const char *s) { return *s == '\0' ? 0 : 1 + length(s + 1); }
constexpr size_t without_trailing_slashes(const char *s, size_t n) {
  return n > 0 && s[n - 1] == '/' ? without_trailing_slashes(s, n - 1) : n;
}
}  // namespace endpoint_detail

// Same rule as the server: [a-z0-9-]{1,32}.
constexpr bool is_valid_room_id(const char *id) { return endpoint_detail::room_id_from(id, 0); }

constexpr bool is_https(const char *url) { return endpoint_detail::starts_with(url, "https://"); }

// http:// or https:// followed by at least one character.
constexpr bool has_http_scheme(const char *url) {
  return (endpoint_detail::starts_with(url, "http://") && url[7] != '\0') ||
         (endpoint_detail::starts_with(url, "https://") && url[8] != '\0');
}

constexpr bool same_string(const char *a, const char *b) { return *a == *b && (*a == '\0' || same_string(a + 1, b + 1)); }

constexpr size_t UPLOAD_URL_CAP = 256;

// Whether build_upload_url(server_url, room_id, ..., cap) succeeds, decided at compile time.
constexpr bool upload_url_fits(const char *server_url, const char *room_id, size_t cap = UPLOAD_URL_CAP) {
  return endpoint_detail::without_trailing_slashes(server_url, endpoint_detail::length(server_url)) +
             endpoint_detail::length("/api/rooms/") + endpoint_detail::length(room_id) +
             endpoint_detail::length("/readings") <
         cap;
}

// "<server_url without trailing slashes>/api/rooms/<room_id>/readings". False if it does not fit in cap.
bool build_upload_url(const char *server_url, const char *room_id, char *out, size_t cap);
