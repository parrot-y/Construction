#!/usr/bin/env bash
# Creates the split DB roles required for RLS enforcement in production-like
# environments. Run ONCE as the RDS master user against the staging DB.
#
# Required env:
#   PGHOST PGUSER PGPASSWORD        — RDS master credentials
#   MIGRATOR_DB_PASSWORD            — password for db_migrator (generated, store in Secrets Manager)
#   APP_DB_PASSWORD                 — password for db_app (generated, store in Secrets Manager)
# Optional: PGDATABASE (default: construction)
set -euo pipefail
: "${PGHOST:?}" "${PGUSER:?}" "${PGPASSWORD:?}" "${MIGRATOR_DB_PASSWORD:?}" "${APP_DB_PASSWORD:?}"
export PGDATABASE="${PGDATABASE:-construction}"

psql -v ON_ERROR_STOP=1 \
  -v migrator_pw="$MIGRATOR_DB_PASSWORD" \
  -v app_pw="$APP_DB_PASSWORD" <<'SQL'
DO $$ BEGIN
  IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname='db_migrator') THEN
    CREATE ROLE db_migrator WITH LOGIN CREATEDB;
  END IF;
  IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname='db_app') THEN
    CREATE ROLE db_app WITH LOGIN;
  END IF;
END $$;
ALTER ROLE db_migrator WITH PASSWORD :'migrator_pw';
ALTER ROLE db_app WITH PASSWORD :'app_pw';
GRANT CONNECT ON DATABASE construction TO db_migrator, db_app;
SQL
