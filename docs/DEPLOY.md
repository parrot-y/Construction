# Site Safi — Deployment Runbook

Production deployment for the Site Safi monorepo (Turborepo · Fastify 5 · Prisma/PostgreSQL · React 19 PWA).

## 1. Environment

Copy `.env.example` → `.env` (API) and configure:

| Var | Required | Notes |
|---|---|---|
| `NODE_ENV` | yes | `production` — enables secure cookies, secret guards, **blocks seed** |
| `DATABASE_URL` | yes | Runtime role `db_app` (non-superuser, no BYPASSRLS) |
| `MIGRATION_DATABASE_URL` / migrator URL | deploy only | Owner role `db_migrator` — used ONLY for `prisma migrate deploy` |
| `JWT_SECRET`, `COOKIE_SECRET` | yes | ≥32 chars each; missing → API refuses to boot in production |
| `MPESA_WEBHOOK_SECRET` | yes | ≥32 chars; same boot guard |
| `WEB_ORIGIN` | yes | Exact frontend origin for CORS + credentials |
| `UPLOAD_DIR` | yes | Mounted persistent volume (or object-storage driver when provisioned) |
| `UPLOAD_DRIVER` | no | `local` (only implemented driver) |
| `DISABLED_MODULES` | no | Comma list: `plant,survey,tender,steel,asphalt,geofence` → 404 |
| Provider keys | later | `AT_API_KEY`, `WHATSAPP_TOKEN`/`WHATSAPP_PHONE_ID`, `RESEND_API_KEY`, `MPESA_*`, `ETIMS_*` — all optional; unconfigured = honest SIMULATED |

## 2. Database (migrations + RLS)

```bash
# As db_migrator (owner) — applies baseline + RLS policies + refresh_tokens
DATABASE_URL="$MIGRATOR_URL" pnpm --filter @construction/db prisma migrate deploy

# Re-apply RLS enforcement (idempotent — runs after EVERY migration/deploy)
psql "$ADMIN_URL" -f packages/db/prisma/rls.sql

# Grant runtime role access (once per environment)
psql "$ADMIN_URL" -c "
  GRANT USAGE ON SCHEMA public TO db_app;
  GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO db_app;
  GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO db_app;
  ALTER DEFAULT PRIVILEGES FOR ROLE db_migrator IN SCHEMA public
    GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO db_app;
"
```

- `users`/`tenants` are **documented RLS exceptions** (identity resolution precedes tenant context — see `rls.sql` header). Everything else with `tenant_id` is FORCE-RLS'd.
- New tenant-owned tables: add `tenant_id`, then re-run `rls.sql` (the DO block auto-discovers them).

## 3. Build & run

```bash
pnpm install --frozen-lockfile
pnpm turbo run build
pnpm --filter @construction/api start   # serves API
# web: serve apps/web/dist behind your CDN/reverse proxy
```

## 4. Seeding

`prisma:seed` **refuses to run when `NODE_ENV=production`** — demo data is dev/test only. Provision real tenants/users via the app onboarding/invite flow.

## 5. Verify

```bash
./scripts/verify-local.sh   # fresh PG cluster: migrations, RLS, seed, all tests
```

## 6. Session & upload notes

- Access tokens: 15 min. Refresh tokens: 7 d, rotated on use, server-side reuse detection (`refresh_tokens` table) — a replayed token revokes the family.
- `/uploads/*` is authenticated + tenant-scoped; never expose `UPLOAD_DIR` publicly.
- Login is rate-limited (30/min/IP) plus failed-attempt lockout; `/api/public/*` limited to 30/min.
