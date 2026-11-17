# Backup/restore drill — 293a758

Date: 2026-11-17
Source: construction_e2e (PostgreSQL 18, local)
Method: pg_dump -Fc → pg_restore into scratch DB → per-table row-count compare (scripts/backup-restore-drill.sh)

```
dump: 2.2M /tmp/sitesafi-drill-20261117T100047Z.dump
PASS: 128 tables compared, 0 mismatches
```

Full table listing: 128 public tables compared.
