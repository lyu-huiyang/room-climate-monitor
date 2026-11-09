#pragma once
#include <cstdint>

// What to do with a batch after POST /api/rooms/{room_id}/readings (docs/design/firmware.md §5.1): Sent removes it,
// Drop discards it (the server will never accept it), Retry keeps it for next minute.
enum class UploadOutcome { Sent, Drop, Retry };
UploadOutcome classify_upload(int http_status);  // negative = transport/TLS/timeout error

// Sample every 10 s (aligned to :00, :10, ...); upload once a minute, in the
// first sample slot of each minute: batches of up to 100 buffered readings,
// back to back, until the buffer is empty or a batch fails.
constexpr uint32_t SAMPLE_PERIOD_S = 10;
uint32_t seconds_to_next_sample(uint32_t now_s);  // 1..SAMPLE_PERIOD_S
inline bool is_upload_slot(uint32_t sample_ts) { return sample_ts % 60 < SAMPLE_PERIOD_S; }

// Self-healing timers (docs/design/firmware.md §5). Times are millis(); unsigned subtraction
// stays correct when millis() wraps after ~49.7 days.
constexpr uint32_t WIFI_RESET_AFTER_MS = 5u * 60u * 1000u;
constexpr uint32_t REBOOT_AFTER_MS = 30u * 60u * 1000u;
bool should_reset_wifi(uint32_t now_ms, uint32_t last_connected_ms);
bool should_reboot(uint32_t now_ms, uint32_t last_upload_ok_ms);

// The clock is trustworthy once NTP has moved it past 2025-01-01 UTC.
constexpr uint32_t MIN_VALID_EPOCH = 1735689600u;
inline bool clock_is_set(uint32_t now_s) { return now_s >= MIN_VALID_EPOCH; }

// After a soft or watchdog reset the clock is restored from the RTC slow clock,
// which drifts with uptime; only an SNTP sync during this boot makes it trustworthy.
inline bool clock_is_trusted(uint32_t now_s, bool synced_this_boot) {
  return synced_this_boot && clock_is_set(now_s);
}

// True once now_s reaches target_s, or when the clock was stepped back by more
// than a minute (SNTP correcting a fast clock) so that target_s is stale.
bool wait_is_over(uint32_t now_s, uint32_t target_s);

// SNTP's first request can go out before Wi-Fi is associated; lwIP then retries
// with growing back-off (minutes) while sampling waits for a sync. Restart SNTP
// on the edge where Wi-Fi comes up if this boot has not synced yet.
inline bool should_kick_ntp(bool wifi_connected, bool was_connected, bool synced_this_boot) {
  return wifi_connected && !was_connected && !synced_this_boot;
}
