#include "policy.h"

UploadOutcome classify_upload(int http_status) {
  if (http_status >= 200 && http_status < 300) return UploadOutcome::Sent;
  if (http_status == 400 || http_status == 401 || http_status == 413) return UploadOutcome::Drop;
  return UploadOutcome::Retry;
}

uint32_t seconds_to_next_sample(uint32_t now_s) { return SAMPLE_PERIOD_S - now_s % SAMPLE_PERIOD_S; }

bool should_reset_wifi(uint32_t now_ms, uint32_t last_connected_ms) {
  return now_ms - last_connected_ms >= WIFI_RESET_AFTER_MS;
}

bool should_reboot(uint32_t now_ms, uint32_t last_upload_ok_ms) {
  return now_ms - last_upload_ok_ms >= REBOOT_AFTER_MS;
}

bool wait_is_over(uint32_t now_s, uint32_t target_s) {
  return now_s >= target_s || target_s - now_s > 60;
}
