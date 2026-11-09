#pragma once
#include <cstddef>
#include <cstdint>

#include "reading.h"

constexpr size_t RING_CAPACITY = 1080;  // 3 h at one reading every 10 s (docs/design/firmware.md §5)

// Identifies a RingStore written by this firmware. "RCM1" differs from the prototype firmware's "NRS2",
// so a board switched over from it starts with an empty buffer. Bump it if RingStore's layout changes.
constexpr uint32_t RING_MAGIC = 0x52434D31;

// Lives in no-init RAM on the device (too big for RTC memory), so it survives soft and watchdog
// resets; magic + checksum tell a surviving buffer from power-on garbage.
struct RingStore {
  uint32_t magic;
  uint16_t head;   // index of the oldest reading
  uint16_t count;
  Reading items[RING_CAPACITY];
  uint32_t checksum;
};

bool ring_restore(RingStore &s);                                  // true if kept, false if reset
void ring_push(RingStore &s, const Reading &r);                   // overwrites the oldest when full
size_t ring_peek(const RingStore &s, Reading *out, size_t max);   // oldest first
void ring_drop(RingStore &s, size_t n);                           // removes the n oldest
inline size_t ring_count(const RingStore &s) { return s.count; }
