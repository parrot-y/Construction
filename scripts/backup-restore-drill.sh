#!/usr/bin/env bash
# Backup/restore drill (Phase 0.3): pg_dump → restore into a scratch DB →
# compare row counts per table. Prints a markdown table for evidence.
#
# Usage: DATABASE_URL="postgresql://postgres@host:port/dbname" \
#        [ADMIN_URL="postgresql://postgres@host:port/postgres"] \
#        bash scripts/backup-restore-drill.sh
set -euo pipefail

DB_URL="${DATABASE_URL:?DATABASE_URL required}"
ADMIN_URL="${ADMIN_URL:-${DATABASE_URL%/*}/postgres}"
SCRATCH="sitesafi_drill_$$"
TS="$(date -u +%Y%m%dT%H%M%SZ)"
DUMP="/tmp/sitesafi-drill-$TS.dump"

row_counts() {
  psql "$1" -At -c "
    SELECT string_agg(format('%s=%s', tablename, cnt), ' ' ORDER BY tablename)
    FROM (SELECT tablename, (xpath('/row/cnt/text()', query_to_xml(format('SELECT count(*) AS cnt FROM %I', tablename), false, true, '')))[1]::text::int AS cnt
          FROM pg_tables WHERE schemaname='public') t;" 2>/dev/null || true
}

echo "== backup =="
pg_dump "$DB_URL" -Fc -f "$DUMP"
ls -lh "$DUMP" | awk '{print "dump:", $5, $9}'

echo "== scratch db =="
psql "$ADMIN_URL" -c "DROP DATABASE IF EXISTS $SCRATCH;" -c "CREATE DATABASE $SCRATCH;"
SCRATCH_URL="${DB_URL%/*}/$SCRATCH"

echo "== restore =="
pg_restore -d "$SCRATCH_URL" --no-owner --no-privileges "$DUMP" || true

echo "== row counts (source vs restored) =="
python3 - "$DB_URL" "$SCRATCH_URL" <<'PY'
import subprocess, sys
def counts(url):
    out = subprocess.run(['psql', url, '-At', '-c',
        "SELECT tablename||'|'||(xpath('/row/cnt/text()', query_to_xml(format('SELECT count(*) AS cnt FROM %I', tablename), false, true, '')))[1]::text::int "
        "FROM pg_tables WHERE schemaname='public' ORDER BY tablename"],
        capture_output=True, text=True).stdout
    return dict(l.split('|') for l in out.strip().splitlines() if '|' in l)
a, b = counts(sys.argv[1]), counts(sys.argv[2])
print('| table | source | restored |')
print('|---|---|---|')
bad = 0
for t in sorted(set(a) | set(b)):
    mark = '' if a.get(t) == b.get(t) else '  <-- MISMATCH'
    if mark: bad += 1
    print(f'| {t} | {a.get(t,"-")} | {b.get(t,"-")} |{mark}')
print(f'\n{"PASS" if bad == 0 else "FAIL"}: {len(a)} tables compared, {bad} mismatches')
sys.exit(1 if bad else 0)
PY

psql "$ADMIN_URL" -c "DROP DATABASE $SCRATCH;"
rm -f "$DUMP"
echo "drill complete"
