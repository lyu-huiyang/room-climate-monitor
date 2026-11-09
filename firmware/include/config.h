#pragma once
// The one place that pulls in the per-board configuration. src/ includes this, never secrets*.h.
#if __has_include(<rcm_selected_secrets.h>)
// Written by select_secrets.py on every device build: secrets.<RCM_ROOM>.h, secrets.h or the example.
#include <rcm_selected_secrets.h>
#elif __has_include("secrets.h")
// Outside a PlatformIO build (e.g. an editor's code model).
#define RCM_REAL_SECRETS 1
#include "secrets.h"
#else
#include "secrets.example.h"
#endif

#include "endpoint.h"

#ifndef ENABLE_SHT40
#define ENABLE_SHT40 1
#endif
#ifndef ENABLE_AHT20
#define ENABLE_AHT20 1
#endif

static_assert(ENABLE_SHT40 || ENABLE_AHT20, "enable at least one sensor in secrets.h");
static_assert(is_valid_room_id(ROOM_ID), "ROOM_ID must match [a-z0-9-]{1,32}");
static_assert(has_http_scheme(SERVER_URL), "SERVER_URL must start with http:// or https://");
// Very long addresses (over ~500 characters) hit the compiler's constexpr depth limit instead of this message.
static_assert(upload_url_fits(SERVER_URL, ROOM_ID), "SERVER_URL is too long for the upload URL buffer");
#ifdef RCM_ROOM
static_assert(same_string(ROOM_ID, RCM_ROOM), "ROOM_ID in secrets.<room>.h differs from RCM_ROOM");
#endif
#ifdef RCM_REAL_SECRETS
// The placeholders from secrets.example.h only make sense for CI builds.
static_assert(!same_string(WIFI_SSID, "your-2.4GHz-ssid"), "fill in WIFI_SSID");
static_assert(!same_string(DEVICE_KEY, "paste-the-key-printed-by-rcm-room-add"), "fill in DEVICE_KEY");
#endif
