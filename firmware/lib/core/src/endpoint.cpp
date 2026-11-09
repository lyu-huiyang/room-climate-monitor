#include "endpoint.h"

#include <cstdio>
#include <cstring>

bool build_upload_url(const char *server_url, const char *room_id, char *out, size_t cap) {
  if (cap == 0) return false;
  size_t len = strlen(server_url);
  while (len > 0 && server_url[len - 1] == '/') len--;
  int n = snprintf(out, cap, "%.*s/api/rooms/%s/readings", static_cast<int>(len), server_url, room_id);
  return n >= 0 && static_cast<size_t>(n) < cap;
}
