#!/usr/bin/env bash
# One command for every check.
# Expects dependencies installed: `uv sync --project server` and `pnpm -C web install`.
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
(
  cd web
  pnpm check:api
  pnpm lint
  pnpm typecheck
  pnpm test
  pnpm test:e2e   # its web server runs `pnpm build` first
)

echo "All checks passed."
