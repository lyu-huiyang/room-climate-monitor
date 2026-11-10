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

echo "==> web: api types, lint, typecheck, unit tests, build, end-to-end, project site"
# Playwright reuses a server already on 8765 (app) or 4180 (project site) locally and
# would then skip the build.
for port in 8765 4180; do
  if command -v lsof >/dev/null && lsof -nP -iTCP:$port -sTCP:LISTEN >/dev/null; then
    echo "port $port is in use; stop that server first so the end-to-end tests run on a fresh build" >&2
    exit 1
  fi
done
(
  cd web
  pnpm check:api
  pnpm lint
  pnpm typecheck
  pnpm test
  pnpm test:e2e   # its web server runs `pnpm build` first
  pnpm test:site  # the project site; its web server runs `pnpm build:site` first
)

echo "==> firmware: native tests, build"
(
  cd firmware
  pio test -e native
  pio run -e supermini
)

echo "All checks passed."
