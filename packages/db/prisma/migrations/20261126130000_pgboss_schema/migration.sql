-- P5.8 — pg-boss keeps its own table set in a dedicated schema. The app
-- role needs USAGE+CREATE there so boss.start() can install/maintain its
-- tables; it gets nothing in public beyond existing grants.
CREATE SCHEMA IF NOT EXISTS pgboss;

DO $$
BEGIN
    IF EXISTS (SELECT FROM pg_roles WHERE rolname = 'db_app') THEN
        EXECUTE 'GRANT USAGE, CREATE ON SCHEMA pgboss TO db_app';
    END IF;
END
$$;
