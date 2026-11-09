# Auditor Punch List — Evidence (2026-11-09)

Branch: devin/portal-hardening. Every item verified with real command output.

## 1. Landing page
- `apps/web/src/components/LandingPortalHub.tsx` inspected: no gradient hero,
  no emoji, no invented stats ("100%", "0 Seat Tax" absent — grep clean).
- Real console screenshots wired: `/screenshots/console-desktop.png` +
  `console-mobile.png` exist in `apps/web/public/screenshots/` (captured
  from the running console, 1440x900 / 390x844).
- Fresh evidence shots: `docs/evidence/shots/landing-{1440,390}.png`.

## 2. Portal UI wording + empty states
- grep `zero seat|seat tax|verified token|uppercase|tracking-` across
  `apps/web/src/components/portals/` + `PortalAccessLinkManager.tsx`:
  only legitimate domain uses remain (NCA verification, QS-verified statuses).
- "ZERO SEAT TAX" user-facing copy removed from LoginForm +
  SubscriptionBillingView; code comments/test names scrubbed repo-wide.
- Every (0) tab now has an empty state that says what happens next
  (RFIs, cube tests, inspections, snags, deliveries, milestones, COs,
  permits, progress updates).
- Fixed fabricated badges: CompliancePortalView "NCA Cap 499A Verified" +
  unconditional "Registered Site" pill → now conditional on stored
  `ncaSiteRegistration`, else "Not recorded".
- Fixed fabricated math: SubcontractorPortalView milestone table computed
  retention as `amount*0.05`/net `*0.95` on netPayable → now renders real
  `grossWorkCertifiedKes`/`retentionDeductedKes`/`netPayableKes` from the
  API DTO; retention header uses actual package rate; pct = gross/package sum.

## 3. Fabricated defaults sweep
- `sampleBudget`/`45000000`: only an input `placeholder="e.g. 45000000"`
  remains (format hint, not a default value).
- All `initialX || [fixtures]` fallback arrays gated behind
  `import.meta.env.DEV` — production builds can never render fabricated
  records: PlantTelematicsView (devices+pings+alerts), GeofencedClockInView,
  PlantEquipmentView, SafetyAuditScorecardView, RetentionAndBondsView,
  WhatsAppSiteWebhookView, LaborMusterRollView, MaterialWastageVarianceCard,
  MaterialRequisitionView, ETimsTaxComplianceView,
  GeotechnicalSoilView/AsphaltPavementView (DEFAULT_* params).
- Removed simulated-success fallbacks that fabricated records on network
  failure: CreateVariationModal (`sim-vo-*`), CostCaptureModal (`sim-*`),
  IndependentSiteReportView (fake Clerk-of-Works booking with invented
  inspector/coords/reportRef) — all now surface real errors.
- Removed fake IDs: `project-rcp-2026` defaults → `''` in
  CompanyAdminDashboard, PmQsDashboard, ConcreteCubeTestModal;
  `dummy-equip-id` → real equipment lookup with error if none;
  LaborMusterRollView fake attendance rows DEV-gated, random payroll/
  disbursement refs → empty, hardcoded week-ending → today.
- Web suite: `vitest run` → 118/118 passed; `tsc --noEmit` clean.

## 4. ci.yml — migrate deploy + RLS
`.github/workflows/ci.yml` already: fresh postgres service → creates
`db_migrator`/`db_app` → `prisma migrate deploy` (NOT db push) as migrator →
grants → `psql -f packages/db/prisma/rls.sql` as postgres → seed → tests
run as `db_app` (RLS enforced). `packages/db` suite includes
`src/isolation.test.ts` (RLS/tenant isolation). Verified by reading the
workflow; identical steps replicated locally by verify-local.sh.

## 5. route-guard reconciliation
`docs/evidence/route-authz-matrix.md` regenerated from the live route scan
(same logic as route-guard.test.ts):
- 279 routes total: 112 ROUTE_PERMISSIONS map + 118 inline requirePermission
  + 9 self-service + 16 in-handler-guarded = 255 authenticated routes, ALL
  with a permission guard; 24 public allowlisted; **0 unguarded**.
- `route-guard.test.ts` enforces both C-01 (authenticate-or-allowlist) and
  C-01b (permission coverage) — the "authenticate-only" violation class no
  longer exists.

## 6. Wording scrub
- `tasks/todo.md`, `docs/PROJECT_STATUS.md`: no "parity"/"reference console"
  wording (verified by grep).
- `docs/research/console-audit/SUMMARY.md`: "Reference console" column →
  "Benchmark console".
- PORTAL_PARITY_MAP.md already deleted (commit 7618590); remaining "parity"
  hits are false positives ("Disparity" status labels, Simpson's-rule parity
  fallback) or historical docs carrying superseded-by banners.

## 7. font-mono counts
- `grep -ro 'font-mono' apps/web/src --include='*.tsx' | wc -l`
  → **472** (unchanged vs branch base 7b521cc: 472).
- Prior pass already removed 13 decorative misuses; remaining usages are
  codes/numbers/currency per audit; `currency-guard.test.ts` enforces no
  literal "KES <amount>" strings and bounds legacy-format growth.

## 8. Fresh screenshots
- Re-captured against a real seeded stack (ephemeral PG + migrate deploy +
  rls.sql + seed + real API :4199 + vite :5180), portal links created via
  the real API, console login through the real UI form:
  `docs/evidence/shots/{landing,admin-console,supervisor-view,portal-client,
  portal-consultant,portal-subcontractor,portal-supplier,portal-compliance}-{1440,390}.png`
  — 16 files, all unique (md5-verified; first attempt produced identical
  frames because the SPA has no session-restore — fixed by UI login).

## Verification
- `apps/web` tsc clean, vitest 118/118.
- Full `scripts/verify-local.sh` re-run recorded in verify log (see commit).

## Round 2 (2026-11-09, commit pending) — auditor re-review items

### 1. Landing console screenshots replaced
- `apps/web/public/screenshots/console-desktop.png` + `console-mobile.png`
  replaced with fresh captures of the REAL admin console (post-login DOM
  verified: "Evening, MWANGI", RCP-2026 Riverside Commercial Plaza).
- Stale unused `landing.png` (byte-identical to old gradient) deleted.
- Landing DOM verified live: only `/screenshots/console-*.png` imgs, plain
  Kenya-first copy, no stats/emoji/gradient.

### 2. font-mono restricted — before/after
- Before: 472 occurrences. After: 458.
- Removed from prose/labels/statuses/units/free-text: "BORAQS Closeout",
  "BORAQS Standard", "hrs"/"L" unit labels, WhatsApp processedStatus +
  recipientRole badges + message textarea, "No Active DTCs", telematics
  machine/severity line, onboarding budget/closeout line, retention-cap
  prose suffix, bond-type words, compliance permit+status mix, geofence
  selfie-URL input, fabricated SHA-256 seal block (also removed fake
  "BDS VERIFIED" badge — invented forensic claim).
- Remaining 458: money/percent/qty via formatKes/toCurrencyString, dates &
  times in tables, coordinates/GPS, project/cert/invoice/RFI/snag/delivery/
  payroll/bond/tender/document reference numbers, PINs/KRA/eTIMS numbers,
  phone numbers (numeric identifiers), numeric input fields, chart tick
  labels. Enforced by review + currency-guard.test.ts.

### 3. Portal headers — light layout + capabilities + zero tiles
- All 5 portals verified live via Playwright DOM: `header.bg-slate-900`
  absent on every portal; "What you can do here" card present on all 5.
- Dark slate-900 header bands replaced with white cards matching console
  style; action buttons restyled light; redundant in-header mini-stats
  dropped (KPI tiles carry the numbers).
- Subcontractor: "5% Retention Held" hardcoded label → actual
  `retentionRatePct`; tiles hidden while all-zero (open/rectified/closed/
  contract sum/retention each conditional).
- Supplier: whole summary grid hidden when no deliveries; per-tile
  zero-hiding for confirmed/awaiting/disputed.
- Consultant/Compliance/Client: status cards show honest "Not recorded"/
  "Not tracked"/"No tests yet" states (not zeros) — kept.

### 4. Fixture names
- Repo-wide grep for "Shot SUBCONTRACTOR"/"Screenshot Stakeholder" and
  `\bshot\b|\bscreenshot\b` in source: zero hits outside dist bundles.
  E2E fixtures use "E2E <TYPE>" names only; live DB portal links verified
  clean (CONSULTANT Partner etc.).

### 5. parity/reference-console wording
- grep -ni "parity|reference console" tasks/todo.md docs/PROJECT_STATUS.md
  → zero hits.

### 6. Fresh screenshots
- docs/evidence/shots/portal-{consultant,subcontractor,supplier,compliance,
  client}-{1440,390}.png re-captured post-change (10 files, md5-distinct);
  admin-console-{1440,390}.png + landing-{1440,390}.png fresh;
  console-desktop/mobile.png in public/ updated.

### Bonus honesty fixes found during audit
- SubscriptionBillingView "Safaricom Daraja Verified" → "M-Pesa payment
  record — simulated until Daraja is configured".
- ETimsTaxComplianceView receipt modal: SIMULATED banner added (was
  presenting mock QR/signature as a verifiable KRA receipt).
- IndependentSiteReportView: removed fabricated SHA-256 forensic seal.
