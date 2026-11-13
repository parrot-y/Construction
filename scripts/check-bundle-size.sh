#!/usr/bin/env bash
# C2: initial JS budget — entry chunks (index-*.js) must stay ≤450KB raw / ≤140KB gzip.
set -euo pipefail
cd "$(dirname "$0")/.."
RAW_LIMIT=450000
GZIP_LIMIT=140000
raw=0; gz=0
for f in apps/web/dist/assets/index-*.js; do
  [ -e "$f" ] || continue
  r=$(wc -c < "$f")
  g=$(gzip -9 -c "$f" | wc -c)
  raw=$((raw + r)); gz=$((gz + g))
done
echo "initial JS: ${raw} bytes raw, ${gz} bytes gzip (limits ${RAW_LIMIT}/${GZIP_LIMIT})"
[ "$raw" -le "$RAW_LIMIT" ] || { echo "FAIL: initial JS exceeds ${RAW_LIMIT}B raw"; exit 1; }
[ "$gz" -le "$GZIP_LIMIT" ] || { echo "FAIL: initial JS exceeds ${GZIP_LIMIT}B gzip"; exit 1; }
echo "OK"
