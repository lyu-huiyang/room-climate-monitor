#!/usr/bin/env bash
# One command for every check; CI runs exactly this.
# Expects dependencies installed: `uv sync --project server`, `pnpm -C web install`
# and PlatformIO Core 6.2.0 (`uv tool install --python 3.12.16 platformio==6.2.0`).
set -euo pipefail
cd "$(dirname "$0")/.."

echo "==> server: ruff, pytest"
(
  cd server
  uv run --locked ruff check .
  uv run --locked ruff format --check .
  uv run --locked pytest -q
)

echo "==> web: api types, lint, typecheck, unit tests, build, end-to-end"
# Playwright reuses a server already on 8765 locally and would then skip `pnpm build`.
if command -v lsof >/dev/null && lsof -nP -iTCP:8765 -sTCP:LISTEN >/dev/null; then
  echo "port 8765 is in use; stop that server first so the end-to-end tests run on a fresh build" >&2
  exit 1
fi
(
  cd web
  pnpm check:api
  pnpm lint
  pnpm typecheck
  pnpm test
  pnpm test:e2e   # its web server runs `pnpm build` first
)

echo "==> firmware: native tests, build"
(
  cd firmware
  pio test -e native
  pio run -e supermini
)

echo "All checks passed."
