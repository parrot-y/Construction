#!/usr/bin/env bash
# Evidence hygiene gate — committed files under docs/evidence must not
# contain local absolute paths or the dev host name. Logs are evidence for
# reviewers on other machines; machine-specific paths are noise and can
# leak usernames.
#
# Forbidden patterns:
#   /home/…            POSIX home paths
#   /Users/…           macOS home paths
#   C:\Users\…         Windows home paths
#   \bkali\b           this workstation's host name (pino "hostname" field)
#
# Exit 1 and print every offending file:line when a violation exists.
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
EVIDENCE_DIR="${REPO_ROOT}/docs/evidence"

if [ ! -d "${EVIDENCE_DIR}" ]; then
  echo "check-evidence-hygiene: ${EVIDENCE_DIR} not found" >&2
  exit 1
fi

# -I skips binary files (PNG/JPEG evidence is fine — paths can't hide in
# pixels, and grep would only report "binary file matches" noise).
violations="$(grep -rInE '/home/|/Users/|C:\\Users|\bkali\b' "${EVIDENCE_DIR}" --exclude-dir=.git || true)"

if [ -n "${violations}" ]; then
  echo "FAIL: docs/evidence contains machine-specific paths or host name:" >&2
  # sed -n consumes all input so printf never dies on SIGPIPE under pipefail.
  printf '%s\n' "${violations}" | sed -n '1,50p' >&2
  count="$(printf '%s\n' "${violations}" | wc -l)"
  if [ "${count}" -gt 50 ]; then
    echo "... (${count} total lines)" >&2
  fi
  echo "Sanitise with: scripts/sanitize-evidence.sh" >&2
  exit 1
fi

echo "check-evidence-hygiene: docs/evidence clean ($(find "${EVIDENCE_DIR}" -type f | wc -l) files scanned)"
