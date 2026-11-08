#!/usr/bin/env bash
# Seed a throwaway database and serve the built web app plus the API on port 8765.
set -euo pipefail
cd "$(dirname "$0")/.."
TMP=$(mktemp -d)
trap 'rm -rf "$TMP"' EXIT
uv run --project ../server python ../server/scripts/seed_demo.py --db "$TMP/e2e.sqlite3" --hours 24
RCM_DB_PATH="$TMP/e2e.sqlite3" RCM_STATIC_DIR="$PWD/dist" \
  uv run --project ../server rcm serve --host 127.0.0.1 --port 8765
