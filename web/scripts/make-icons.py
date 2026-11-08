"""Rasterize the app icons (white thermometer on blue) with only the stdlib.

Usage: python3 scripts/make-icons.py public/icons
"""
import struct, sys, zlib
from pathlib import Path

BLUE = (0x2A, 0x78, 0xD6)
WHITE = (0xFF, 0xFF, 0xFF)
SS = 3  # supersampling per axis


def inside_round_rect(x, y, x0, y0, x1, y1, r):
    if not (x0 <= x <= x1 and y0 <= y <= y1):
        return False
    cx = min(max(x, x0 + r), x1 - r)
    cy = min(max(y, y0 + r), y1 - r)
    return (x - cx) ** 2 + (y - cy) ** 2 <= r * r


def color_at(x, y, maskable):
    # Coordinates in [0, 1]. Maskable icons are full-bleed and keep content in the inner 80 %.
    if not maskable and not inside_round_rect(x, y, 0, 0, 1, 1, 0.22):
        return None
    s = 0.8 if maskable else 1.0
    u, v = 0.5 + (x - 0.5) / s, 0.5 + (y - 0.5) / s
    tube = inside_round_rect(u, v, 0.42, 0.16, 0.58, 0.70, 0.08)
    bulb = (u - 0.5) ** 2 + (v - 0.72) ** 2 <= 0.15 ** 2
    if tube or bulb:
        mercury = inside_round_rect(u, v, 0.47, 0.40, 0.53, 0.72, 0.03) or (u - 0.5) ** 2 + (v - 0.72) ** 2 <= 0.09 ** 2
        return BLUE if mercury else WHITE
    return BLUE


def render(size, maskable):
    rows = []
    for py in range(size):
        row = bytearray([0])
        for px in range(size):
            acc = [0, 0, 0, 0]
            for sy in range(SS):
                for sx in range(SS):
                    c = color_at((px + (sx + 0.5) / SS) / size, (py + (sy + 0.5) / SS) / size, maskable)
                    if c:
                        acc[0] += c[0]; acc[1] += c[1]; acc[2] += c[2]; acc[3] += 255
            n = SS * SS
            a = acc[3] // n
            if a:
                cover = acc[3] / 255
                row += bytes([round(acc[0] / cover), round(acc[1] / cover), round(acc[2] / cover), a])
            else:
                row += b"\0\0\0\0"
        rows.append(bytes(row))
    raw = b"".join(rows)

    def chunk(tag, data):
        return struct.pack(">I", len(data)) + tag + data + struct.pack(">I", zlib.crc32(tag + data) & 0xFFFFFFFF)

    ihdr = struct.pack(">IIBBBBB", size, size, 8, 6, 0, 0, 0)
    return b"\x89PNG\r\n\x1a\n" + chunk(b"IHDR", ihdr) + chunk(b"IDAT", zlib.compress(raw, 9)) + chunk(b"IEND", b"")


out = Path(sys.argv[1])
for name, size, maskable in [("icon-192.png", 192, False), ("icon-512.png", 512, False), ("icon-maskable-512.png", 512, True)]:
    (out / name).write_bytes(render(size, maskable))
    print(name, (out / name).stat().st_size)
