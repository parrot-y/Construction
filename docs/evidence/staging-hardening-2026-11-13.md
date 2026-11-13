# Stage-6 staging hardening — evidence

Run date: 2026-11-13 (session). Branch: `devin/contractor-lifecycle`.
Full verification: `scripts/verify-local.sh` with
`UPLOAD_DRIVER=s3 S3_BUCKET=sitesafi-uploads-test S3_ENDPOINT=http://localhost:4566`
against LocalStack 3.8.1 — **COMPLETED SUCCESSFULLY**:

```
@construction/api:test:  Test Files  65 passed (65)
@construction/api:test:       Tests  578 passed (578)
@construction/web:test:       Tests  118 passed (118)
@construction/db:test:        Tests   15 passed (15)
@construction/money:test:     Tests   63 passed (63)
@construction/permissions:    Tests    9 passed (9)
LOCAL CI VERIFICATION COMPLETED SUCCESSFULLY
```

Log: `docs/evidence/verify-56101c6.log` (generated on the working tree that
became this commit — HEAD was still 56101c6 at run time).

## 1. S3 upload driver

- `apps/api/src/lib/storage.ts`: `UPLOAD_DRIVER=s3` → `S3_BUCKET` env,
  `ServerSideEncryption: 'AES256'` on every PutObject, private bucket,
  downloads stay **proxied** through `/uploads/*` so tenant + membership +
  magic-byte checks are unchanged. `UPLOAD_DRIVER` unset → local `UPLOAD_DIR`
  driver for dev.
- Terraform (`infra/main.tf`): `aws_s3_bucket.uploads` +
  `aws_s3_bucket_public_access_block` (all four flags) + SSE-S3 config +
  versioning + lifecycle + task-role `s3:PutObject/GetObject` on
  `${bucket}/*` only; container env `UPLOAD_DRIVER=s3`, `S3_BUCKET`,
  `AWS_REGION`.
- **Observed**: `g5-14-upload-security.test.ts` 4/4 passed under
  `UPLOAD_DRIVER=s3` (magic-byte accept/reject, mime-derived `.png` key,
  auth-gated proxied download, path-traversal + cross-tenant 404/403).
- **Observed**: LocalStack bucket contents after the run — 4 objects with
  tenant/project-scoped keys:

```
objects in bucket: 4
 - 3d9bb572-…/06a82478-…/10226dd7-….png 12B
 - 3d9bb572-…/643051c6-…/8f6921e5-….png 12B
 - 3d9bb572-…/6dccdaa2-…/9b51039d-….png 70B
 - 3d9bb572-…/b08e8761-…/d2ba2db3-….png 12B
```

- Note: `turbo.json` `globalPassThroughEnv` gained `UPLOAD_DRIVER`, `S3_*`,
  `AWS_*`, `EMAIL_*`, `SES_*`, `SENTRY_*`, `VITE_*`, `PRODUCT_NAME` — without
  this turbo strips the vars and the S3 path silently falls back to local
  (caught and fixed during this run; first verify pass proved the trap).

## 2. Monitoring

- `@sentry/node` (api, `lib/sentry.ts`) + `@sentry/react` (web,
  `main.tsx`): DSN-gated (no-op without `SENTRY_DSN`/`VITE_SENTRY_DSN`),
  `release` from `APP_VERSION`/`VITE_APP_VERSION`, `sendDefaultPii` off,
  `beforeSend` strips user email/IP. **Not yet proven against a real DSN —
  needs the staging Sentry project; wiring is code-complete.**
- `/ready` (`index.ts`): `SELECT 1` via Prisma → 200 `{status:'ready'}`,
  503 on DB failure. `/health` stays liveness-only.
  Test: `company-export.test.ts` → `/health` 200 ok, `/ready` 200 ready.
- Uptime alerts: `infra/main.tf` SNS topic → email subscription
  (`var.alert_email`) + optional SMS (`var.alert_phone`), wired to
  CloudWatch 5xx/unhealthy alarms. **Provisions with staging; not yet live.**

## 3. Log redaction

- Fastify `req` serializer (`index.ts`): URL through `redactUrl`
  (`/api/v1/portals/<type>/<token>` → `/api/v1/portals/<type>/[redacted]`,
  `?token=`/`access_token`/`refresh_token`/`pin` → `[redacted]`); headers
  are not serialized at all (stronger than redaction).
- `lib/logRedaction.ts`: `redactHeaders` (cookie/authorization/set-cookie/
  x-api-key → `[redacted]`), `redactDeep` (password/pin/secret/token fields
  recursively). Request bodies are never logged, so password fields cannot
  persist.
- **Observed**: `log-redaction.test.ts` 5/5 — portal path, query tokens,
  headers, deep fields, non-portal passthrough.

## 4. Seed guard

`packages/db/prisma/seed.ts` refuses `NODE_ENV=production`.
**Observed**:

```
$ NODE_ENV=production pnpm --filter @construction/db run prisma:seed
Seeding error: Error: Refusing to seed: NODE_ENV=production. Demo seed
 data is for development/test only. Provision real tenants/users through
the application onboarding flow instead.
```

## 5. Transactional email seam

`apps/api/src/lib/email.ts`: `EMAIL_DRIVER=simulated|resend|ses`
(auto-detects `RESEND_API_KEY`+`EMAIL_FROM` or `SES_FROM`); simulated driver
logs only recipient domain + subject, returns `simulated:true`. Wired into
verify-email + password-reset (`auth.ts`) and invitation emails
(`invitations.ts`); operator activation remains the fallback. SES uses the
task IAM role (no keys). **Simulated path exercised by the suite; Resend/SES
paths are code-complete but unproven until real creds exist.**

## 6. Pagination

- `lib/pagination.ts`: `?page=` (1-based) + `?limit=` — default 50, max 200
  (clamped), `skip/take` helpers, `page` metadata block `{page, limit,
  hasMore, nextPage}`; bare-array legacy endpoints get `X-Page/X-Limit/
  X-Has-More/X-Next-Page` headers instead.
- Applied to ~60 collection endpoints across 20 route files (projects,
  costs, invoices, certificates, diaries, progress, tasks, inventory,
  incidents, documents, drawings, subcontractors, annotations, permits,
  compliance visits, suppliers, POs, commitments, commercial ops,
  RFIs/inspections/cube-tests/snags/DLP, equipment/laborers/muster-rolls/
  safety-audits, eTIMS/TCC/webhook-logs/alerts/releases/bonds, me/invoices,
  inbox, notifications, announcements, quotes, invitations, members,
  company documents, checklists, crews, variations, delay-events,
  tax-certificates, observations, corrective-actions, scheduled reports +
  runs, attendance, correspondence, BOQ items, client project-requests,
  15 platformServices lists, portal links).
- Summary/aggregate fields (totals, counts, compliance rates) are computed
  over the **full** filtered set via parallel aggregate queries — page
  metadata never shrinks totals.
- Bounded exceptions (documented): detail endpoints, exports, dashboard/
  report aggregates, portal token feeds (single scoped resource), tender
  bid evaluation (needs the full bid set for lowest-bid scoring),
  `/me/approvals` (merged inbox capped at `limit` per source).
- Web: `main.tsx` fetch wrapper transparently follows `page.nextPage`
  (max 20 pages) and merges list arrays by the `limit`-sized key — every
  existing list view gets complete data without per-component changes.
- **Observed**: `pagination.test.ts` 4/4 (defaults, clamp, skip, hasMore);
  `company-export.test.ts` asserts `page.limit===200` on `?limit=9999` and
  `page` block on `/projects`.

## 7. Legal pages + company data export

- `/terms` and `/privacy`: `LegalPage.tsx` placeholder pages rendered on
  path routes before app mount (SPA fallback already serves index.html).
  **Placeholder copy — owner to supply final text.**
- `GET /api/v1/company/export`: COMPANY_ADMIN/ADMIN + COMPANY_MANAGE;
  `?format=json` full tenant export (profile, members+users, projects,
  invoices+items+payments, quotes+items, cost entries, diaries, certificates,
  documents); `?format=csv&entity=<projects|members|invoices|quotes|
  cost-entries|site-diaries|payment-certificates|documents>` flat CSV.
  Every export writes `COMPANY_DATA_EXPORTED` audit log.
- Web: "Download company data" button in Team settings (admin roles only).
- **Observed**: `company-export.test.ts` 8/8 — viewer 403, JSON shape,
  CSV header+rows, missing-entity 400, ≥2 audit rows, `/health`+`/ready`,
  pagination clamp.

## Not yet proven (honest gaps)

- Sentry event capture against a real DSN (needs staging project).
- Resend/SES delivery (needs real credentials/sender verification).
- SNS email/SMS alerts fire only after `terraform apply`.
- `/ready` 503 path not exercised (would need a stopped DB mid-test).
- CSV export covers the listed entities; JSON export is the complete
  tenant dump — no per-entity JSON variant.
