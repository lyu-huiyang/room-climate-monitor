#!/usr/bin/env bash
# Fail when openapi.json or src/api/schema.d.ts is out of date with the backend.
set -euo pipefail
cd "$(dirname "$0")/.."
tmp=$(mktemp -d)
trap 'rm -rf "$tmp"' EXIT
uv run --project ../server rcm openapi > "$tmp/openapi.json"
pnpm exec openapi-typescript "$tmp/openapi.json" -o "$tmp/schema.d.ts" >/dev/null
if ! diff -q openapi.json "$tmp/openapi.json" >/dev/null || ! diff -q src/api/schema.d.ts "$tmp/schema.d.ts" >/dev/null; then
  echo "API types are stale: run 'pnpm gen:api' and commit the result." >&2
  exit 1
fi
echo "API types are up to date."
