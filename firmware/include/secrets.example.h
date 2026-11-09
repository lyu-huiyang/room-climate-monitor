#pragma once
// Per-board configuration. Copy this file to secrets.h (one board), or to secrets.<room id>.h for
// each board and build with RCM_ROOM=<room id> (several boards); both are git-ignored.
// Never commit them: they hold your Wi-Fi password and the room's device key.
// Without any of them the firmware still builds with these placeholder values (useful for CI).

// 2.4 GHz Wi-Fi only (ESP32-C3 has no 5 GHz radio).
#define WIFI_SSID "your-2.4GHz-ssid"
#define WIFI_PASS "your-wifi-password"

// Server address: http:// or https://, optional port, trailing slash optional.
#define SERVER_URL "http://192.168.1.10:8080"

// Room id registered on the server ([a-z0-9-]{1,32}) and the key printed once by `rcm room add`.
#define ROOM_ID "living-room"
#define DEVICE_KEY "paste-the-key-printed-by-rcm-room-add"

// Optional: turn off a sensor that is not connected (at least one must stay on).
// #define ENABLE_SHT40 1
// #define ENABLE_AHT20 1

// Optional: lower the transmit power if Wi-Fi will not connect
// (some SuperMini batches have a weak antenna match).
// #define WIFI_TX_POWER WIFI_POWER_8_5dBm
