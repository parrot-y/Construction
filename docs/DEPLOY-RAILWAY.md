# Deploying SiteSafi on Railway (pilot)

Three Railway services in one project: **api**, **web**, **Postgres** (managed).
The SPA calls same-origin `/api/*`; nginx in the web container proxies those
to the API over Railway's private network — one public origin, HTTPS included.

## 1. Create the project (owner, ~10 min)

1. railway.app → New Project → Deploy from GitHub repo `parrot-y/construction`,
   branch `devin/contractor-lifecycle`.
2. Railway will detect Dockerfiles. Add services manually:
   - **api**: Root Directory `apps/api`, Dockerfile `apps/api/Dockerfile`,
     `railway.json` already present.
   - **web**: Root Directory `apps/web`, Dockerfile `apps/web/Dockerfile`,
     `railway.json` already present.
   - **Postgres**: Railway → + New → Database → PostgreSQL.

## 2. Environment variables

### api service
| Var | Value |
|---|---|
| `NODE_ENV` | `production` |
| `PORT` | `3001` |
| `DATABASE_URL` | `${{Postgres.DATABASE_URL}}` — runtime role URL (see §3) |
| `JWT_SECRET` | random ≥32 chars (`openssl rand -hex 32`) |
| `COOKIE_SECRET` | random ≥32 chars |
| `MPESA_WEBHOOK_SECRET` | random ≥32 chars (boot guard in production) |
| `WEB_ORIGIN` | `https://<web-service-domain>` (exact, no trailing slash) |
| `UPLOAD_DIR` | `/data/uploads` on a mounted volume |
| `OPERATOR_KEY` | random ≥32 chars — guards `/api/v1/operator/*` |
| `RAILWAY_*` | leave unset |

Optional provider keys (all degrade to honest SIMULATED labels when unset):
`AT_API_KEY`, `WHATSAPP_TOKEN`, `WHATSAPP_PHONE_ID`, `RESEND_API_KEY`,
`MPESA_*`, `ETIMS_*`, `MAP_TILE_KEY`, `PRODUCT_NAME=SiteSafi`,
`VITE_PRODUCT_NAME=SiteSafi` (web build arg — set at build time).

### web service
| Var | Value |
|---|---|
| `API_UPSTREAM` | `http://${{api.RAILWAY_PRIVATE_DOMAIN}}:3001` — Railway private networking |

### Postgres service
Railway provides `DATABASE_URL`, `DATABASE_PUBLIC_URL`. Create the runtime
and migrator roles once (§3) and reference them via Railway variables
(`DB_APP_URL`, `DB_MIGRATOR_URL`) shared to api.

## 3. Database roles, migrations, RLS

Railway's managed Postgres gives you a superuser. Create the two app roles
once (psql as the default user):

```sql
CREATE ROLE db_migrator LOGIN PASSWORD '<random>';
CREATE ROLE db_app LOGIN PASSWORD '<random>';
GRANT CONNECT ON DATABASE railway TO db_migrator, db_app;
```

Then, from a one-off `railway run` shell or locally against the public URL:

```bash
# 1. Migrations as db_migrator
DATABASE_URL="postgresql://db_migrator:<pw>@<host>:<port>/railway" \
  pnpm --filter @construction/db prisma migrate deploy

# 2. Re-apply RLS enforcement (idempotent — run after EVERY deploy)
psql "postgresql://postgres:<pw>@<host>:<port>/railway" \
  -f packages/db/prisma/rls.sql

# 3. Grants for the runtime role (once per environment)
psql "..." -c "
  GRANT USAGE ON SCHEMA public TO db_app;
  GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO db_app;
  GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO db_app;
  ALTER DEFAULT PRIVILEGES FOR ROLE db_migrator IN SCHEMA public
    GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO db_app;
  ALTER DEFAULT PRIVILEGES FOR ROLE db_migrator IN SCHEMA public
    GRANT USAGE, SELECT ON SEQUENCES TO db_app;"
```

Set `DATABASE_URL` on the api service to the **db_app** URL (never the
superuser — RLS depends on it).

## 4. First boot

1. Deploy api → check `https://<api-domain>/health` → `{"status":"ok"}`.
2. Deploy web → open `https://<web-domain>` → landing page loads.
3. Sign up a company (self-serve registration is tenant-isolated by RLS).
4. Operator activation (first admin) uses `OPERATOR_KEY` — see `docs/DEPLOY.md` §7.

## 5. Migrations on every deploy

Add a Railway **pre-deploy command** on the api service (Settings → Deploy):

```
pnpm --filter @construction/db prisma migrate deploy
```

with `DATABASE_URL` pointed at the migrator URL for that step, then re-run
`psql -f packages/db/prisma/rls.sql`. (Railway runs pre-deploy in the same
image; alternatively keep a `scripts/deploy-migrate.sh` you run manually —
see `scripts/`.)

## 6. Backups

Railway managed Postgres takes automated backups (volume snapshots on the
Pro plan; verify plan tier). For the pilot also run the drill script:

```bash
DATABASE_URL="<admin url>" bash scripts/backup-restore-drill.sh
```

which dumps, restores to a scratch DB and prints row-count parity.

## 7. Going live checklist

- [ ] `NODE_ENV=production` on api (secure cookies, boot guards on).
- [ ] `WEB_ORIGIN` = exact web domain (CORS + credentials).
- [ ] Health endpoint green; `/api/v1/auth/login` reachable through web origin.
- [ ] Run the five locked aud specs against the deployed URL:
      `E2E_BASE_URL=https://<web-domain> pnpm --filter e2e exec playwright test tests/aud-*.spec.ts`
- [ ] Uptime monitor on `/health` + error tracking (see docs/DEPLOY.md).
- [ ] `docs/evidence/backup-restore-<sha>.md` committed from the drill.

## 8. Uptime alert + error tracking (0.6)

- **Uptime**: Railway has built-in healthchecks (configured in both
  `railway.json` files — `/health` on api, `/` on web). For an external
  alert reaching the owner's phone, point a free monitor (e.g. UptimeRobot,
  Better Stack) at `https://<api-domain>/health` and `https://<web-domain>/`
  with a 5-minute interval and SMS/push notification to the owner.
- **Error tracking**: the API logs structured errors to stdout (Railway
  captures them per service). For grouped alerting, set `SENTRY_DSN` on the
  api service when a Sentry project exists; until then Railway's own
  deployment-failure notifications email the workspace owner.
