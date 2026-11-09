#include "ring_buffer.h"

#include <cstddef>
#include <cstring>

namespace {

uint32_t checksum_of(const RingStore &s) {
  // FNV-1a over every byte before the checksum field.
  const auto *p = reinterpret_cast<const uint8_t *>(&s);
  uint32_t h = 2166136261u;
  for (size_t i = 0; i < offsetof(RingStore, checksum); i++) {
    h ^= p[i];
    h *= 16777619u;
  }
  return h;
}

void seal(RingStore &s) { s.checksum = checksum_of(s); }

}  // namespace

bool ring_restore(RingStore &s) {
  if (s.magic == RING_MAGIC && s.head < RING_CAPACITY && s.count <= RING_CAPACITY &&
      s.checksum == checksum_of(s)) {
    return true;
  }
  memset(&s, 0, sizeof s);
  s.magic = RING_MAGIC;
  seal(s);
  return false;
}

void ring_push(RingStore &s, const Reading &r) {
  s.items[(s.head + s.count) % RING_CAPACITY] = r;
  if (s.count < RING_CAPACITY) {
    s.count++;
  } else {
    s.head = (s.head + 1) % RING_CAPACITY;  // the slot just written was the oldest
  }
  seal(s);
}

size_t ring_peek(const RingStore &s, Reading *out, size_t max) {
  size_t n = s.count < max ? s.count : max;
  for (size_t i = 0; i < n; i++) out[i] = s.items[(s.head + i) % RING_CAPACITY];
  return n;
}

void ring_drop(RingStore &s, size_t n) {
  if (n > s.count) n = s.count;
  s.head = (s.head + n) % RING_CAPACITY;
  s.count -= n;
  seal(s);
}
