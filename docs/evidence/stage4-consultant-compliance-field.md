# Stage-4 Consultant, Compliance & Field — Acceptance Spec Evidence

Spec: `e2e/tests/k-stage4-consultant-compliance-field.spec.ts` (authored from
the stage-4 requirements — the auditor spec file was not delivered; contract
block maps to real routes, asserted behaviour unchanged).
Auditor fixes on `4c5c8b5`: (A) platform-operator first-admin activation;
(B) font-mono restriction to codes/numbers/tabular figures.
Environment: real Fastify API + PostgreSQL (RLS, `db_app` non-superuser) +
Playwright API assertions. E2E DB: `construction_e2e` on disposable cluster
localhost:54329; API :4199.

## Result — OBSERVED
- `k-stage4-consultant-compliance-field.spec.ts`: **8/8 passed on chromium,
  8/8 on mobile-390** (16/16 total, ~21s per project).
- `operator-activation.test.ts`: **3/3** — unverified production-style signup
  cannot log in; `POST /api/v1/operator/admin-account` (x-operator-key)
  activates the earliest COMPANY_ADMIN, login then returns 200; reset-password
  mode rotates the password; endpoint 503s when `OPERATOR_KEY` is unset.

## Per-requirement coverage (all OBSERVED)

### Auditor A — operator activation
- `apps/api/src/routes/operator.ts`: `POST /api/v1/operator/admin-account`,
  guarded by `x-operator-key` vs `OPERATOR_KEY` (timing-safe compare; 503 when
  unset, 401 on mismatch). Modes: `activate` (clears pending verification,
  sets `email_verified_at`/`phone_verified_at`) and `reset-password`
  (rotates hash). Both write `OPERATOR_ADMIN_ACTIVATED` /
  `OPERATOR_ADMIN_PASSWORD_RESET` audit rows. Documented in `docs/DEPLOY.md`
  §7 + env table.

### Auditor B — font-mono
- Before: 458 occurrences (auditor baseline 450 at review of `4c5c8b5`).
- Removed: `font-mono` on whole `<tbody>` wrappers in `CostManagementView`
  and `TopographicSurveyView` (mixed prose+numeric cells), and on Dashboard
  permission chips (labels, not data).
- After: **455**. Remaining usages verified as approved categories only:
  project/certificate/invoice/PO/RFI/SNG/OBS/NCR/CAPA codes, KES amounts and
  other tabular figures, KRA PINs, NCA/NEMA registration numbers, GPS
  coordinates, dates, worker/equipment/IMEI codes, phone numbers, payment
  references, storage keys, URLs, and unit labels.

### 1. Consultant portal
- `portal_access_links.scope` (migration `0014`): ALL | RFI | INSPECTIONS |
  CERTIFICATES. Scoped GET `/api/v1/portals/consultant/:token` returns only
  the sections the scope permits — unfetched sections are absent from the
  payload entirely (spec asserts `inspections`/`certificates`/`drawings` keys
  missing on an RFI-scoped link).
- Reply endpoint rejects actions outside scope (RFI replies require RFI in
  scope).
- Verified uploads: `POST .../uploads` runs the same magic-byte
  `sniffMime`/`verifyUpload` path as site uploads; storage keys are
  tenant-scoped.
- Reply attachments: `attachmentStorageKeys` must reference files uploaded
  through the consultant upload route (bound to the link).
- Drawings register: `issuedDate` on project documents; per-link
  acknowledgement (`drawing_acknowledgements`), `isOverdue` derived from
  issued date + ack state; contractor sees acks via documents GET; consultant
  acknowledges via `POST .../drawings/:documentId/acknowledge`.
- **Bug found & fixed**: `lookup_portal_link_by_hash` (rls.sql) did not
  project `scope`, so scoped links silently resolved as ALL. Column added to
  the SECURITY DEFINER function; rls.sql re-applied to test + e2e DBs.

### 2. Compliance portal
- Derived indicators removed from the compliance payload:
  `statutoryLevyPaid`, `certifiedSiteSupervisorPresent`,
  `ncaSiteRegistration` — only real permit/visit/action records remain.
- Permits register (`project_permits`): type NCA_REGISTRATION |
  NEMA_LICENSE | COUNTY_APPROVAL | OTHER; number, issuer, issued/expiry
  dates; status derived server-side: VALID | EXPIRING_30D | EXPIRED.
- Inspector visits (`compliance_visits` + `compliance_actions`): date,
  outcome, notes, required actions with due dates. `POST
  /api/v1/portals/compliance/:token/visits` notifies the contractor team
  (inbox) and `GET /api/v1/projects/:id/compliance-visits` exposes visits +
  actions to staff.

### 3. Field roles
- Phone+PIN invitations (field roles only: FOREMAN, WORKER, SITE_ENGINEER,
  TRADE_LEAD, SUPERVISOR-class roles per `PIN_FIELD_ROLES`); `isWeakPin`
  rejects repeated/sequential/blocked 6-digit patterns; PIN stored hashed.
- **Bug found & fixed**: `lookup_invitation_by_token` (rls.sql) did not
  project `pin_hash`, so PIN accepts fell through to the password-required
  path. Column added; rls.sql re-applied.
- `POST /api/v1/auth/field-login`: phone+PIN → session; failed attempts
  increment `pin_failed_attempts`, `pin_locked_until` locks after threshold
  (15 min), reset on success.
- WORKER diary privacy: `GET /projects/:id/site-diaries` returns only the
  caller's own entries for WORKER (server-side, verified by spec).
- `FieldDashboard` wired in `Dashboard.tsx` for FOREMAN / WORKER /
  SITE_ENGINEER / TRADE_LEAD — mobile-first surface: own diary entries +
  SiteDiaryModal, attendance, checklists, project inbox, drawings, RFIs,
  observations, correspondence, safety incidents, snagging; sections filtered
  by effective permissions. Console nav already filters by role
  (`navConfig`/`usePermissions`).
- Offline queue: safety incidents submit to the real API and fall back to
  `queueOfflineMutation` (idempotency key) on network failure; snag creation
  supports `photoBase64` (magic-byte verified server-side) and queues the
  same way. `POST /projects/:id/snags` and `POST .../snags/:id/photos` are
  `Idempotency-Key` cached — replay returns the cached response.

### 4. Product-name purge
- `PRODUCT_NAME` env (`PRODUCT_NAME` API, `VITE_PRODUCT_NAME` web; default
  `BuildSasa`) in `apps/api/src/lib/product.ts` + `apps/web/src/lib/product.ts`;
  `GET /api/v1/product` returns it.
- Every `Site Safi`/`Mjengo` literal removed from API strings, PDFs, Excel
  creators, notification sender names, web UI, PWA manifest (`vite.config`),
  index.html title, webhook-secret dev defaults, and docs. Offline-storage
  keys renamed to `buildsasa_*` with `sitesafi_*`/`mjengo_*` read-migration
  retained for existing installs.
- Spec samples portal/inbox/fx-rates/product payloads and asserts no
  `safi|mjengo` match (stale pre-purge inbox rows in the local e2e DB were
  deleted; CI seeds fresh).

### 5. Carry-overs (status)
- Client diary/photo privacy: DONE (stage 2, `i-stage2` spec green).
- Hard-coded 10% retention + FX: DONE — tenant `retention_terms`,
  `GET /api/v1/fx-rates` (asOf+source).
- TCC enforcement: DONE (stage 3, `j-stage3` spec green).
- Subcontractor package summary: DONE (portal payload).
- Purchase orders + supplier scoping: DONE (API + match view; portal/PO UI
  screens still missing — listed unfinished).
- One subcontract payment model: DONE — ADR-011.

## Bugs found by this stage's coverage
1. `lookup_portal_link_by_hash` missing `scope` column → scoped consultant
   links silently behaved as ALL (fixed in rls.sql).
2. `lookup_invitation_by_token` missing `pin_hash` → PIN accepts required a
   password (fixed in rls.sql).
3. `site_diaries` create schema `weather` enum mismatch in spec payload
   (SUNNY → SUNNY_CLEAR) — spec aligned.
4. Safety-incident create requires `investigatedBy`; spec payload aligned.
5. Snag-photo base64 minimum (32 chars) vs tiny test PNG — spec uses a real
   1×1 PNG.
6. `font-mono` on whole `<tbody>` wrappers swept mixed prose into monospace —
   removed (font-mono audit).

## Verification commands
```
# API unit/integration
cd apps/api && pnpm exec vitest run            # full suite (see verify log)
cd apps/api && pnpm exec vitest run src/operator-activation.test.ts  # 3/3

# E2E (disposable PG cluster :54329)
cd e2e && E2E_DATABASE_URL=... E2E_MIGRATOR_DATABASE_URL=... \
  E2E_ADMIN_DATABASE_URL=... \
  pnpm exec playwright test tests/k-stage4-consultant-compliance-field.spec.ts \
  --project=chromium --project=mobile-390   # 16/16
```

## Honestly not finished
- Field-role **UI click coverage** is API-level only; FieldDashboard renders
  for the four roles but no Playwright click spec exercises it yet.
- Consultant/compliance **portal pages** exist (`ConsultantPortalView`,
  `CompliancePortalView`) but drawings-ack + scoped-section UI is API-first;
  no dedicated click spec for the new controls.
- PO match view + supplier/subcontractor portal pages remain API-only
  (carried from stage 3).
- `PRODUCT_NAME` is env-configured; no tenant-level override UI yet.
- Full `scripts/verify-local.sh` run on the final tree pending at time of
  writing (API vitest suite result recorded in verify log when complete).
