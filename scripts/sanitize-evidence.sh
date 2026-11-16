#!/usr/bin/env bash
# Rewrites committed evidence files in place, replacing machine-specific
# paths and the workstation host name with stable placeholders.
#
#   <repo>   — the repository root on this machine
#   <home>   — any other POSIX/macOS/Windows home directory
#   <host>   — the pino "hostname" value / bare hostname mentions
#
# Usage: scripts/sanitize-evidence.sh [path ...]   (default: docs/evidence)
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
TARGETS=("$@")
if [ "${#TARGETS[@]}" -eq 0 ]; then
  TARGETS=("${REPO_ROOT}/docs/evidence")
fi

# sed -i differs between GNU and BSD; detect once.
if sed --version >/dev/null 2>&1; then
  SED_INPLACE=(sed -i)
else
  SED_INPLACE=(sed -i '')
fi

changed=0
while IFS= read -r -d '' file; do
  "${SED_INPLACE[@]}" -E \
    -e "s#${REPO_ROOT}#<repo>#g" \
    -e 's#/home/[A-Za-z0-9_.-]+#<home>#g' \
    -e 's#/Users/[^/[:space:]"'"'"']+#<home>#g' \
    -e 's#C:\\Users\\[^\\"'"'"'[:space:]]+#<home>#g' \
    -e 's#"hostname":"[^"]*"#"hostname":"<host>"#g' \
    -e 's#\bkali\b#<host>#g' \
    "${file}"
  changed=$((changed + 1))
done < <(grep -rlZ -E '/home/|/Users/|C:\\Users|\bkali\b|"hostname":"' "${TARGETS[@]}" 2>/dev/null || true)

echo "sanitize-evidence: rewrote ${changed} file(s) under: ${TARGETS[*]}"
