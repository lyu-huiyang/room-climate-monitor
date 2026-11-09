// room-climate-monitor firmware: sample SHT40/AHT20 every 10 s, buffer in no-init RAM, and upload
// batches once a minute to POST {SERVER_URL}/api/rooms/{ROOM_ID}/readings.
#include <Arduino.h>
#include <WiFi.h>
#include <esp_sntp.h>
#include <esp_task_wdt.h>
#include <time.h>

#include "payload.h"
#include "policy.h"
#include "ring_buffer.h"
#include "config.h"
#include "sensors.h"
#include "uploader.h"

namespace {

constexpr int LED_PIN = 8;  // active low; kept off so it never lights up a bedroom at night
constexpr uint32_t WDT_TIMEOUT_S = 120;

__NOINIT_ATTR RingStore ring;  // ~17 KB, too big for RTC memory; survives soft and watchdog resets
Reading batch[MAX_BATCH];
char body[PAYLOAD_CAP];

uint32_t last_wifi_ok_ms = 0;
bool wifi_was_connected = false;
volatile bool time_synced = false;  // set by SNTP; the RTC-restored clock is not trusted
uint32_t last_upload_ok_ms = 0;

uint32_t now_s() { return static_cast<uint32_t>(time(nullptr)); }

void on_time_sync(struct timeval *) { time_synced = true; }

void connect_wifi() {
  WiFi.begin(WIFI_SSID, WIFI_PASS);
#ifdef WIFI_TX_POWER
  WiFi.setTxPower(WIFI_TX_POWER);
#endif
}

void start_ntp() { configTime(0, 0, "ntp.aliyun.com", "pool.ntp.org"); }

void keep_wifi_alive() {
  uint32_t now_ms = millis();
  bool connected = WiFi.status() == WL_CONNECTED;
  if (should_kick_ntp(connected, wifi_was_connected, time_synced)) {
    Serial.println("wifi: connected, restarting SNTP");
    start_ntp();
  }
  wifi_was_connected = connected;
  if (connected) {
    last_wifi_ok_ms = now_ms;
  } else if (should_reset_wifi(now_ms, last_wifi_ok_ms)) {
    Serial.println("wifi: down for 5 min, reconnecting");
    WiFi.disconnect();
    connect_wifi();
    last_wifi_ok_ms = now_ms;  // give the new attempt a full window
  }
}

void handle_serial() {
  while (Serial.available()) {
    if (Serial.read() == 'R') {
      Serial.println("serial: restart requested");
      Serial.flush();
      esp_restart();
    }
  }
}

const char *sensor_state(bool enabled, bool read_ok) { return !enabled ? "disabled" : read_ok ? "ok" : "missing"; }

uint32_t sample() {
  Reading r{};
  r.ts = now_s();
  sensors_read(r);
  if (WiFi.status() == WL_CONNECTED) {
    r.rssi = static_cast<int8_t>(WiFi.RSSI());
    r.flags |= HAS_RSSI;
  }
  if (has_sensor_data(r)) ring_push(ring, r);
  Serial.printf("sample %lu: sht40=%s aht20=%s rssi=%d buffered=%u\n", static_cast<unsigned long>(r.ts),
                sensor_state(ENABLE_SHT40, r.flags & HAS_SHT40), sensor_state(ENABLE_AHT20, r.flags & HAS_AHT20),
                r.rssi, static_cast<unsigned>(ring_count(ring)));
  return r.ts;
}

void flush_buffer() {
  while (ring_count(ring) > 0 && WiFi.status() == WL_CONNECTED) {
    size_t n = ring_peek(ring, batch, MAX_BATCH);
    size_t len = build_payload(batch, n, body, sizeof body);
    int status = len ? upload_batch(body, len) : 413;  // an oversize body would be rejected anyway
    esp_task_wdt_reset();
    switch (classify_upload(status)) {
      case UploadOutcome::Sent:
        ring_drop(ring, n);
        last_upload_ok_ms = millis();
        Serial.printf("upload: sent %u, %u left\n", static_cast<unsigned>(n),
                      static_cast<unsigned>(ring_count(ring)));
        break;
      case UploadOutcome::Drop:
        ring_drop(ring, n);
        Serial.printf("upload: HTTP %d, dropped %u readings\n", status, static_cast<unsigned>(n));
        return;
      case UploadOutcome::Retry:
        Serial.printf("upload: HTTP %d, will retry\n", status);
        return;
    }
  }
}

void wait_for_next_sample() {
  uint32_t target = now_s() + seconds_to_next_sample(now_s());
  while (!wait_is_over(now_s(), target)) {  // also ends when SNTP steps the clock either way
    keep_wifi_alive();
    handle_serial();
    esp_task_wdt_reset();
    delay(500);
  }
}

}  // namespace

void setup() {
  pinMode(LED_PIN, OUTPUT);
  digitalWrite(LED_PIN, HIGH);  // off
  Serial.begin(115200);
  Serial.setTxTimeoutMs(0);  // never stall the loop when only a charger is attached
  setCpuFrequencyMhz(80);
  esp_task_wdt_init(WDT_TIMEOUT_S, true);
  esp_task_wdt_add(nullptr);
  bool restored = ring_restore(ring);
  Serial.printf("boot: reset reason %d, buffer %s with %u readings\n", static_cast<int>(esp_reset_reason()),
                restored ? "restored" : "reset", static_cast<unsigned>(ring_count(ring)));
  sensors_begin();
  uploader_begin();
  WiFi.mode(WIFI_STA);
  WiFi.setSleep(true);  // modem sleep: less self-heating near the sensors
  WiFi.setAutoReconnect(true);
  connect_wifi();
  sntp_set_time_sync_notification_cb(on_time_sync);
  start_ntp();
  last_wifi_ok_ms = last_upload_ok_ms = millis();
}

void loop() {
  keep_wifi_alive();
  handle_serial();
  if (clock_is_trusted(now_s(), time_synced)) {
    if (is_upload_slot(sample())) flush_buffer();  // sample every 10 s, upload once a minute
    if (ring_count(ring) == 0) last_upload_ok_ms = millis();  // nothing pending counts as healthy
  }
  if (should_reboot(millis(), last_upload_ok_ms)) {
    Serial.println("upload failing for 30 min, restarting");
    Serial.flush();
    esp_restart();
  }
  wait_for_next_sample();
}
