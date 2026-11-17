#!/usr/bin/env bash
# Phase 0.2 — CI deploy check: the web build must reach the API via the
# same-origin /api proxy contract. Fails if the built bundle hardcodes a
# dev/absolute API URL (which would bypass the nginx proxy in production).
set -euo pipefail

echo "== building web =="
pnpm --filter @construction/web run build

echo "== scanning dist for absolute/dev API URLs =="
HITS=$(grep -rEo 'https?://(localhost|127\.0\.0\.1|0\.0\.0\.0)(:[0-9]+)?' apps/web/dist --include='*.js' --include='*.html' | grep -v 'fonts.g' || true)
if [ -n "$HITS" ]; then
  echo "FAIL: built bundle contains absolute dev URLs:"; echo "$HITS" | head -20; exit 1
fi

# Every API call must be same-origin relative (/api/v1 or /api/...).
ABS_API=$(grep -rEo '"https?://[^"]*/api/v1' apps/web/dist --include='*.js' | head -5 || true)
if [ -n "$ABS_API" ]; then
  echo "FAIL: built bundle calls an absolute API origin:"; echo "$ABS_API"; exit 1
fi

echo "PASS: web build uses same-origin /api (nginx proxy contract holds)"
