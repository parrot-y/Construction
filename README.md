# SiteSafi

Kenya-first construction-management SaaS. Multi-tenant workspaces for
contractors, quantity surveyors and clients — BOQs, site diaries, attendance,
variations, payment certificates, invoices, retention and stakeholder portals,
KES-first with KRA e-TIMS / M-Pesa surfaces (integrations labelled SIMULATED
until real providers are approved).

## Stack

Turborepo + pnpm · Fastify 5 API · Prisma + PostgreSQL (RLS tenant isolation)
· React 19 + Vite PWA console · Playwright + Vitest · AWS (ECS/RDS/S3/SES/SNS)
via Terraform.

## Quick start

```bash
pnpm install
# local Postgres (any instance), then:
DATABASE_URL=postgresql://... pnpm --filter @construction/db exec prisma migrate deploy
psql "$DATABASE_URL" -f packages/db/prisma/rls.sql
pnpm --filter @construction/db exec tsx prisma/seed.ts   # dev seed only
pnpm dev        # api :4000-ish + web :5173 via turbo
```

Seed credentials exist only in non-production (`NODE_ENV !== 'production'`
refuses to seed). See `docs/PILOT_SCOPE.md` for the pilot module surface.

## Test & verify

```bash
pnpm test          # turbo: api/web/db/money/permissions vitest suites
pnpm typecheck     # tsc --noEmit everywhere
pnpm build         # production build (bundle budget enforced in CI)
bash scripts/verify-local.sh   # full local gate: fresh PG cluster → migrate
                               # → rls → seed → lint/typecheck/test/build;
                               # writes docs/evidence/verify-<sha>.log
cd e2e && pnpm exec playwright test   # needs E2E_*_DATABASE_URL env (see
                                     # e2e/global-setup.ts header)
```

Notable gates: `scripts/check-brand.sh` (no legacy names),
`scripts/check-demo-bundle.sh` (no demo creds in prod bundle),
`scripts/check-bundle-size.sh` (initial JS ≤450KB/140KB gzip),
`scripts/check-type-debt.sh` (any/ts-ignore ratchet).

## Environment variables

API: `DATABASE_URL`, `JWT_SECRET` (≥32 chars), `WEB_ORIGIN`, `PORT`,
`TRUSTED_PROXY_CIDRS`, `OPERATOR_KEY`, `LOGIN_THROTTLE_*`,
`LOGIN_RATE_LIMIT_MAX`, `DISABLED_MODULES`, `UPLOAD_DIR`, `S3_*`,
`SES_*`/email driver, `SENTRY_DSN`. Web build: `VITE_DEMO_MODE` (dev only),
`VITE_ENABLE_PERIPHERAL_MODULES`, `VITE_API_TARGET`. See
`apps/api/src/index.ts` and `apps/web/vite.config.ts` for defaults.

## Deploy

Terraform stack in `infra/` (ECS + ALB + RDS + S3 + Secrets Manager +
CloudWatch/SNS). `terraform plan` output is committed under
`docs/evidence/`; apply only after auditor approval. Migrations run as
`db_migrator` (`prisma migrate deploy`) then `psql -f rls.sql` — never
`db push` on shared/prod DBs. Ops detail: `docs/DEPLOY.md`.

## Docs

- `docs/PRD.md`, `docs/MVP_SCOPE.md`, `docs/PILOT_SCOPE.md`
- `docs/adr/` — architecture decision records (incl. ADR-013 scale step)
- `docs/evidence/` — verification logs pinned to commit SHAs
- `docs/decisions-needed.md` — open owner decisions
- `AGENTS.md` — repo operating rules (auditor spec immutability etc.)
