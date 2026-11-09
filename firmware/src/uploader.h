#pragma once
#include <cstddef>

// Builds the upload URL from SERVER_URL and ROOM_ID and prints it; call once in setup().
void uploader_begin();

// POSTs body to SERVER_URL/api/rooms/ROOM_ID/readings with the device key. Returns the HTTP status,
// or a negative HTTPClient error on connection/TLS/timeout failure.
int upload_batch(const char *body, size_t len);
