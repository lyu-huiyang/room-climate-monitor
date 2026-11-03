#!/usr/bin/env bash
# One command for every check.
# Expects dependencies installed: `uv sync --project server`.
set -euo pipefail
cd "$(dirname "$0")/.."

echo "==> server: ruff, pytest"
(
  cd server
  uv run --locked ruff check .
  uv run --locked ruff format --check .
  uv run --locked pytest -q
)

echo "All checks passed."
