#!/usr/bin/env bash
# Phase 3.2 — design-token ratchet.
# Fails when the count of design-system violations in apps/web/src grows past
# the committed baseline (scripts/design-debt-baseline.txt). Violations:
#   - raw hex colours in .tsx outside ui/ (tokens live in index.css)
#   - arbitrary font sizes text-[Npx] outside the 12/14/16/22 scale
#   - gradients / glass / neon (bg-gradient*, backdrop-blur*)
#   - emoji characters used as icons in JSX text
# New code must use the shared theme; the baseline may only go down.
set -euo pipefail
cd "$(dirname "$0")/.."

ROOT="apps/web/src"
count() {
  grep -rEn "$1" "$ROOT" --include='*.tsx' 2>/dev/null \
    | grep -v '/ui/' | grep -v '\.test\.\|\.spec\.\|/dist/\|node_modules' | wc -l
}

hex=$(count '#[0-9a-fA-F]{3,8}\b')
fontsize=$(count 'text-\[[0-9.]+px\]')
gradient=$(count 'bg-gradient|backdrop-blur|bg-clip-text|text-transparent')
emoji=$(grep -rPn '[\x{1F300}-\x{1FAFF}\x{2600}-\x{27BF}]' "$ROOT" --include='*.tsx' 2>/dev/null \
  | grep -v '\.test\.\|\.spec\.\|/dist/\|node_modules' | wc -l)

total=$((hex + fontsize + gradient + emoji))
baseline=$(cat scripts/design-debt-baseline.txt)
echo "design debt: $total (baseline $baseline)  [hex=$hex font-size=$fontsize gradient=$gradient emoji=$emoji]"
if [ "$total" -gt "$baseline" ]; then
  echo "FAIL: design violations increased — use theme tokens/components or lower the baseline deliberately"
  exit 1
fi
echo "OK"
