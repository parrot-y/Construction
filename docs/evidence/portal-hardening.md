# Portal Hardening Evidence

Branch: `devin/portal-hardening` (from `devin/audit-remediation`)
Date: 2026-11-09

Test-first per auditor items 1–11. Commands run against a real PostgreSQL
cluster with `prisma migrate deploy` + `rls.sql` applied; all assertions are
live HTTP responses from `buildServer()` — no mocks.

## Schema changes (migration `0005_portal_hardening`)

- `portal_access_links`: `+subcontractor_package_id UUID`, `+last_used_at`, `+use_count`
- `rfi_responses`: `responder_id` nullable `ON DELETE SET NULL`, `+external_responder_name`, `+external_link_id`
- `material_deliveries`: `+dispute_reason VARCHAR(500)`
- `lookup_portal_link_by_hash()` SECURITY DEFINER fn returns `subcontractor_package_id`
- New permission `portal.manage` granted to ADMIN, COMPANY_ADMIN, PM_QS only

## Item 1 — Package-scoped subcontractor links

Fix: `POST /portals/links` requires `subcontractorPackageId` for SUBCONTRACTOR
(400 without it; 404 if package not on project). `GET /portals/subcontractor/:token`
resolves exactly one package by id — no `contains` matching, no all-packages
fallback; a link without a binding sees `packages: []` and `snags: []`.
Snags scoped by exact (case-insensitive) `trade_category`/`assigned_trade_firm`
equality against the bound package. Valuations only for the bound package.

Test output (`portal-hardening.test.ts`):

```
✓ 1a: SUBCONTRACTOR link creation without packageId is rejected
✓ 1b: subcontractor A sees only package A — never package B
✓ 1c: subcontractor B is equally isolated
✓ 1d: valuation against another package is forbidden
```

## Item 2 — Allow-list link management

Fix: create + list now `requirePermission(Permissions.PORTAL_MANAGE)`
(new `portal.manage` permission; ADMIN/COMPANY_ADMIN/PM_QS only). The
SITE_SUPERVISOR/CLIENT deny-list is gone — everything not on the allow-list
is denied by the permission layer.

```
✓ 2: every non-admin/PM_QS role is denied link creation and listing
  (supervisor create=403 list=403, executive create=403 list=403;
   admin list=200, pm list=200)
```

## Item 3 — Rate limits + identical 404s

Fix: `config.rateLimit { max: 60, timeWindow: '1 minute' }` on all 11 public
`/api/v1/portals/*` routes (30/min on regenerate/revoke). `resolvePortalLink`
returns null for invalid, expired and wrong-type tokens → identical
`404 { error: 'Not Found' }` envelope on every portal route.

```
✓ 3: invalid, expired and wrong-type tokens all return identical 404 shape
```

## Item 4 — Explicit DTOs

Fix: consultant, compliance, subcontractor and supplier payloads map to
explicit camelCase DTOs — no `tenant_id`, `created_by_id`, Prisma internals.
The two unused queries in the consultant route (levy count, supervisor count)
were removed (they remain in compliance where they are used).

```
✓ 1b asserts packages[0] has no tenant_id / created_by_id
```

## Item 5 — Verified portal upload + rectify

Fix: new `POST /api/v1/portals/subcontractor/:token/snags/:snagId/upload`
(multipart, `verifyUpload` magic-byte allowlist — same as site uploads),
writes `{tenantId}/{projectId}/{uuid}.{ext}` via the storage driver.
`rectify` rejects any `photoStorageKey` not prefixed with this link's
tenant+project or containing `..`.

```
✓ 5a: rectify rejects a foreign storage key            (400)
✓ 5b: portal upload rejects non-allowlisted content    (415, text/html)
✓ 5c: portal upload accepts a verified PNG             (201, scoped key)
```

## Item 6 — Consultant reply rules

Fix: `ConsultantRfiReplySchema` (Zod, officialAnswer 3–5000, missing → 400);
RFI status ANSWERED/CLOSED → 409; `responder_id: null` +
`external_responder_name` + `external_link_id` persisted.

```
✓ 6a: reply with missing/short body returns 400
      valid reply → responder_id null, external_responder_name set
      second reply on ANSWERED RFI → 409
```

## Item 7 — Decimal valuation math

Fix: `toDecimal` from `@construction/money`; certified-to-date and
previous-payments computed from existing valuations; gross capped at
`subcontract_sum`; WHT rate from `PORTAL_WHT_RATE_PCT` env (default 3.00);
link must be package-bound and `packageId` (if sent) must equal it.

```
✓ 7: valuation uses Decimal, caps at package sum, requires bound package
      gross 9,999,999 > package sum → 400
      gross 1,000,000 → retention 50,000 / WHT 30,000 / net 920,000 (Decimal-exact)
      gross ≤ certified-to-date → 400; cumulative 1,500,000 → 201
```

## Item 8 — Supplier confirm/dispute

Fix: `SupplierDeliveryActionSchema`; DISPUTE requires note ≥3 chars;
invoiceRef accepted on CONFIRM; CONFIRMED/DISPUTED are final → 409.
Bug caught by test: action enum stored raw 'CONFIRM' — now mapped to
'CONFIRMED'/'DISPUTED'.

```
✓ 8: dispute requires note; final states block further actions
      DISPUTE w/o note → 400; with note → 200 + dispute_reason stored;
      CONFIRM after DISPUTED → 409
```

## Item 9 — Honest compliance summary

Fix: `ncaSiteRegistration: null` (was invented `NCA/PRJ/...`); pass rate is
`null` when zero breaks recorded → UI renders "No tests yet".

```
✓ 9: compliance summary reports honest nulls, not invented values
```

## Item 10 — Link lifecycle (API)

Fix: canonical `linkUrl = /?portal=<type>&token=<token>`; POST
`/links/:linkId/regenerate` (new token, old `is_active=false`, same expiry
and package scope); DELETE `/links/:linkId` revoke; list returns
`lastUsedAt`, `useCount`, `expiresAt`, `isActive`.

```
✓ 10: regenerate revokes old token; revoke kills access; listing shows usage
      old token → 404, new token → 200, linkUrl canonical, revoked row isActive=false
```

## Full suite output

```
$ vitest run src/portal-hardening.test.ts src/external-portals.test.ts
 ✓ src/portal-hardening.test.ts (14 tests)
 ✓ src/external-portals.test.ts (13 tests)
 Test Files  2 passed (2)
      Tests  27 passed (27)
```

(Earlier isolated run: `portal-hardening.test.ts` 14/14, `external-portals.test.ts` 13/13 —
existing suite updated for package-scoped links, DTO field names, verified upload.)

## Items 11–13 (frontend)

- `PortalAccessLinkManager` rewritten: no mock seeds, no offline fallback,
  real API errors, canonical linkUrl copy (token shown once at creation),
  Regenerate/Revoke buttons, last-used/use-count/expiry columns,
  subcontractor package picker.
- `portals/PortalErrorState.tsx`: shared `PortalLinkNotice` (expired /
  revoked / error) + `PortalExpiryBanner`; wired into all 5 portal views;
  API returns `linkExpiresAt` on every portal payload.
- Supplier portal: invoice-ref + dispute-reason inputs; backend enforces.
- Subcontractor claim modal: package value / certified-to-date / remaining
  computed live before submit.
- Client portal: new `GET /portals/client/:token` (client_visible photos,
  payment certificates, invoices, progress records) rendered read-only.
- Compliance portal: "Not recorded" for missing NCA registration,
  "No tests yet" for zero breaks.

## E2E coverage added (`e2e/tests/e-portals.spec.ts`)

- two-subcontractor package isolation + cross-package valuation 403
- role-restricted link creation/listing (supervisor 403)
- revoke → 404, regenerate → old 404/new 200 + canonical linkUrl
- expired link (expires_at forced past via SQL) → 404
- rectification: real PNG upload via portal endpoint (201, scoped key)
  + foreign storage key rejected (400)

## Full verification

```
$ scripts/verify-local.sh   (fresh ephemeral PostgreSQL cluster, migrate deploy + rls.sql + seed)
@construction/api:test:       Tests  525 passed (525)
@construction/web:test:       Tests  118 passed (118)
@construction/money:test:     Tests   63 passed (63)
@construction/db:test:        Tests   15 passed (15)
@construction/permissions:test: Tests  9 passed (9)
Tasks: 6 successful, 6 total — LOCAL CI VERIFICATION COMPLETED SUCCESSFULLY
Log: docs/evidence/verify-portal-hardening-final.log
```

## Playwright portal E2E (real API + real DB, no route stubs)

```
$ playwright test e-portals.spec.ts   (chromium + mobile-390 projects)
  ✓ consultant portal: valid/invalid/expired + RFI reply
  ✓ supplier portal: valid token + delivery confirm action
  ✓ subcontractor + compliance portals respond honestly
  ✓ subcontractor links are package-scoped — two subs cannot see each other
  ✓ portal link lifecycle: role restriction, revoke, regenerate, expiry
  ✓ rectification accepts a real uploaded photo, rejects foreign keys
  12 passed (1.6m)
```

Infra fixes required to make this run honest:
- `e2e/global-setup.ts`: rls.sql + grants now run via `E2E_ADMIN_DATABASE_URL`
  (superuser) — SECURITY DEFINER lookup functions owned by db_migrator were
  themselves RLS-filtered and returned zero rows (login 403). Functions are
  re-owned to the admin role after rls.sql (CREATE OR REPLACE preserves owner).
- `.github/workflows/e2e.yml`: passes `E2E_ADMIN_DATABASE_URL` (postgres).
- Spec: expired-link fixture UPDATE runs as superuser (app/migrator roles are
  RLS-filtered to 0 rows without tenant context); psql URI `schema` param stripped.
