#include "payload.h"

#include "json_writer.h"

namespace {

void add_sensor(JsonWriter &w, bool first, const char *name, int16_t t, int16_t h) {
  w.add("%s\"%s\":{\"t\":", first ? "" : ",", name);
  w.centi(t);
  w.add(",\"h\":");
  w.centi(h);
  w.add("}");
}

}  // namespace

size_t build_payload(const Reading *items, size_t n, char *out, size_t cap) {
  if (cap == 0) return 0;
  JsonWriter w(out, cap);
  w.add("{\"readings\":[");
  for (size_t i = 0; i < n; i++) {
    const Reading &r = items[i];
    w.add("%s{\"ts\":%lu,\"sensors\":{", i ? "," : "", static_cast<unsigned long>(r.ts));
    bool first = true;
    if (r.flags & HAS_SHT40) {
      add_sensor(w, first, "sht40", r.st, r.sh);
      first = false;
    }
    if (r.flags & HAS_AHT20) add_sensor(w, first, "aht20", r.at, r.ah);
    w.add("}");
    if (r.flags & HAS_RSSI) w.add(",\"rssi\":%d", r.rssi);
    w.add("}");
  }
  w.add("]}");
  return w.finish();
}
