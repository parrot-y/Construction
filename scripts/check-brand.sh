#!/usr/bin/env bash
# A1: forbidden-brand gate. Fails if legacy/competitor brand strings appear
# in shipped source. Allow-list (documented, minimal):
#   - apps/web/src/services/offline-sync.ts — the single legacy offline-queue
#     migration file; it must reference old storage keys to migrate them.
#   - e2e/tests/aud-stage4-*.spec.ts, e2e/tests/k-stage4-*.spec.ts — test
#     contracts whose brand-ban regexes must name the forbidden strings.
set -euo pipefail
cd "$(dirname "$0")/.."
PATTERN='buildsasa|\bsasa\b|mjengo|site safi'
EXCLUDES='--exclude-dir=node_modules --exclude-dir=dist --exclude-dir=.turbo --exclude-dir=coverage --exclude-dir=.git'
rc=0
hits=$(grep -rniIE "$PATTERN" $EXCLUDES apps packages infra scripts .github 2>/dev/null \
  | grep -v 'apps/web/src/services/offline-sync.ts' | grep -v 'scripts/check-brand.sh' || true)
if [ -n "$hits" ]; then
  echo "FAIL: forbidden brand strings in shipped source:"
  echo "$hits"; rc=1
fi
ehits=$(grep -rniIE "$PATTERN" $EXCLUDES e2e 2>/dev/null \
  | grep -vE 'e2e/tests/(aud|k)-stage4-[^/]*\.spec\.ts' || true)
if [ -n "$ehits" ]; then
  echo "FAIL: forbidden brand strings in e2e sources outside allow-list:"
  echo "$ehits"; rc=1
fi
[ "$rc" -eq 0 ] && echo "brand check OK"
exit "$rc"
