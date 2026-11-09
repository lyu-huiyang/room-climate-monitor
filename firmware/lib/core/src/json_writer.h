#pragma once
#include <cstdarg>
#include <cstddef>
#include <cstdio>

// Appends printf-style fragments into a fixed buffer; finish() returns the
// length, or 0 if anything overflowed.
class JsonWriter {
 public:
  JsonWriter(char *out, size_t cap) : out_(out), cap_(cap) {}

  __attribute__((format(printf, 2, 3))) void add(const char *fmt, ...) {
    if (!ok_) return;
    va_list args;
    va_start(args, fmt);
    int n = vsnprintf(out_ + len_, cap_ - len_, fmt, args);
    va_end(args);
    if (n < 0 || static_cast<size_t>(n) >= cap_ - len_) {
      ok_ = false;
      return;
    }
    len_ += static_cast<size_t>(n);
  }

  // Hundredths as a decimal with exactly two places: -5 -> "-0.05".
  void centi(int v) {
    unsigned a = static_cast<unsigned>(v < 0 ? -v : v);
    add("%s%u.%02u", v < 0 ? "-" : "", a / 100, a % 100);
  }

  size_t finish() const { return ok_ ? len_ : 0; }

 private:
  char *out_;
  size_t cap_;
  size_t len_ = 0;
  bool ok_ = true;
};
