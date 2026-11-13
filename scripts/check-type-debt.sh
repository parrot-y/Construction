#!/usr/bin/env bash
# C3: type-debt ratchet.
#  - default: total count of explicit-any / ts-ignore markers must not exceed
#    the committed baseline (scripts/type-debt-baseline.txt).
#  - --files <files...>: every listed file must be free of the markers
#    (used for new/changed files — no-explicit-any as error).
set -euo pipefail
cd "$(dirname "$0")/.."
PATTERN=': any|as any|@ts-ignore|@ts-expect-error|@ts-nocheck'
count_file() { grep -rEn "$PATTERN" "$1" --include='*.ts' --include='*.tsx' 2>/dev/null | grep -v '\.test\.\|/dist/\|node_modules' | wc -l; }

if [ "${1:-}" = "--files" ]; then
  shift
  fail=0
  for f in "$@"; do
    [ -f "$f" ] || continue
    hits=$(grep -En "$PATTERN" "$f" | grep -v '\.test\.' || true)
    if [ -n "$hits" ]; then
      echo "FAIL: type debt in changed file $f:"
      echo "$hits" | head -10
      fail=1
    fi
  done
  [ "$fail" -eq 0 ] && echo "OK: no type debt in changed files"
  exit "$fail"
fi

total=0
for d in apps packages; do
  total=$((total + $(count_file "$d")))
done
baseline=$(cat scripts/type-debt-baseline.txt)
echo "type debt: $total (baseline $baseline)"
if [ "$total" -gt "$baseline" ]; then
  echo "FAIL: type-debt count increased — fix the new any/ts-ignore or lower the baseline deliberately"
  exit 1
fi
echo "OK"
