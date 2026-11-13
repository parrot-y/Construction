#!/usr/bin/env bash
# A1: production bundle must not contain demo credentials. Builds the web
# app with VITE_DEMO_MODE unset (production default) and greps dist/.
set -euo pipefail
cd "$(dirname "$0")/.."
if [ ! -d apps/web/dist ]; then
  (cd apps/web && pnpm build >/dev/null)
fi
if grep -rlE 'Password123|apexbuilders' apps/web/dist 2>/dev/null; then
  echo "FAIL: demo credentials found in production bundle"
  exit 1
fi
echo "demo-bundle check OK"
