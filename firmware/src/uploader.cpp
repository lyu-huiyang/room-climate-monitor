#include "uploader.h"

#include <HTTPClient.h>
#include <WiFiClient.h>
#include <WiFiClientSecure.h>

#include "config.h"
#include "endpoint.h"

// ESP-IDF's root certificate bundle, compiled into the Arduino-ESP32 framework.
extern const uint8_t x509_crt_bundle_start[] asm("_binary_x509_crt_bundle_start");

namespace {

constexpr uint32_t TIMEOUT_MS = 10000;
char upload_url[UPLOAD_URL_CAP];
bool url_ok = false;

int post(WiFiClient &client, const char *body, size_t len) {
  HTTPClient http;
  http.setConnectTimeout(TIMEOUT_MS);
  http.setTimeout(TIMEOUT_MS);
  if (!http.begin(client, upload_url)) return HTTPC_ERROR_CONNECTION_REFUSED;
  http.addHeader("Content-Type", "application/json");
  http.addHeader("X-Device-Key", DEVICE_KEY);
  int status = http.POST(reinterpret_cast<uint8_t *>(const_cast<char *>(body)), len);
  http.end();
  return status;
}

}  // namespace

void uploader_begin() {
  url_ok = build_upload_url(SERVER_URL, ROOM_ID, upload_url, sizeof upload_url);
  if (url_ok) {
    Serial.printf("upload: %s\n", upload_url);
  } else {
    Serial.println("upload: SERVER_URL is too long, uploads disabled");
  }
}

int upload_batch(const char *body, size_t len) {
  if (!url_ok) return HTTPC_ERROR_CONNECTION_REFUSED;
  if (is_https(SERVER_URL)) {
    WiFiClientSecure client;
    client.setCACertBundle(x509_crt_bundle_start);
    client.setHandshakeTimeout(10);  // seconds; the 120 s default equals the task watchdog
    return post(client, body, len);
  }
  WiFiClient client;
  return post(client, body, len);
}
