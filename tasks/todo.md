# tasks/todo.md — active plan

## MASTER PLAN — Phase 1 (foundations) — IN PROGRESS

- [x] P1.1 lib/api.ts request layer (typed errors, timeout, retry, refresh) + unit tests — e2b5bb0/25d05ab
- [x] P1.2 shared Toast/InlineError/FormError/useAppDialog; popups eliminated; last raw error <p>s → InlineError (8d218ac)
- [x] P1.3 all fetch( migrated onto api.* via apiTransport; hygiene guard clean (142→143 files)
- [x] P1.4 scripts/check-frontend-hygiene.mjs — clean; violation demo done during migration
- [x] P1.5 unreachable banner + health poll + status dot (4102537)
- [x] P1.6 p1-break-it.spec.ts — 5/5 chromium + 5/5 mobile-390 (found+fixed offline chunk crash 731eea2, ric crash 59d73d8)
- [x] P1.7 30s→~0.5s project create (summary endpoint + optimistic select + prefetch); speed misses documented honestly (c2fa73c)
- [x] P1.8 giant files: all 11 >800-line files hang off dead PmQsDashboard/CompanyAdminDashboard (unreachable); daily sections all <500 lines — documented, no splits needed
- [x] P1.9 full solo suite + verify-local on final commit + report table → STOP — 444/444 clean on 37bf8ea, verify green, evidence df59230

## MASTER PLAN — Phase 2 (admin console end-to-end) — closeout in progress

- [x] 0 deploy groundwork — f381a3b/dd0cd83/dbcbaae
- [x] 2.1 New project wired — 64f5b97/937514b
- [x] 2.2 inventory — docs/evidence/admin-console-inventory.md
- [x] 2.3 per-screen acceptance — a3/a6/a7/l1/l2 specs
- [x] 2.4 day-one journey — l3-admin-first-hour @390px
- [x] 2.5 W1–W10 by clicks — ec00767 (chromium 11/11 + mobile)
- [x] 2.6 permissions on screen — a8-permissions spec
- [x] 2.7 demo data + wording — 0bc6aac
- [x] 2.8 project types end-to-end — 9954343 + a334cbc
      (migration 0025, shared config, 4-step wizard, NCA rules table,
      starters, filters, PDFs; p2 spec 10/10; api tests 10/10)
- [x] Phase 2 closeout — DONE @120506e: solo suite 428/0/0/0 (29.7m),
      verify-local green (api 675 web 146 db 18 money 77 perms 9),
      evidence e2e-2dadc75.md + verify-70153c7.log → awaiting auditor review

## Current: Round H (checklist 14/15 review, 28–32)

Rules: aud-* specs + sha256 immutable; tests first with RED RUN COMMITTED;
one item = one commit `H<n>: <what>`; evidence log named for final sha.

### H1 — one source of truth for retention money
- [ ] Decide: retention release pre-fills/locks `retention_released` on next
      payment certificate OR creates a retention-release invoice/credit line.
      Write choice in docs/decisions-needed.md.
- [ ] Remove the other typed path (or make read-only); ledger must never
      double-count (held already net of cert-level releases vs DLC releases).
- [ ] Test: PC half release → payment certificate → final release; reconcile
      held/released/outstanding to the cent; invoice/cert shows release once.
      Decimal edge values (half-cent splits).

### H2 — subcontractor retention request → paid
- [ ] E2E: PENDING_QS_REVIEW → QS recommends → director approves
      (maker-checker, requester cannot self-approve, admin override needs
      15-char reason) → payout recorded once with reference → portal shows
      PAID → package retention held falls → ledger reconciles → second
      request for same moiety refused.
- [ ] Console screen where QS reviews it, verified at 390px.

### H3 — retention rate + cap per project
- [ ] Project settings: retentionRatePct + retentionCapPct (default 5%),
      editable by admin/PM_QS before first certificate, audit-logged.
- [ ] Remove every hard-coded 5%/50% in retention path (certificates.ts
      preview math too); list each in PR.
- [ ] 10% project through certificate → invoice → release.

### H4 — wording/layout at 390px (auditor visual review)
- [ ] "Welcome,S6 CONSULTANT" missing space.
- [ ] Scope-derived "What you can do here" bullets (consultant: verify snags;
      client: practical completion + snags).
- [ ] Client portal: closeout card first, above empty change-orders.
- [ ] Subcontractor valuation table clipped — stacked cards or scroll shadow.
- [ ] Dead "Back to Project/Dashboard" buttons on link portals — remove or
      point to portal top.
- [ ] Consultant tab bar clips "Snag Verification (1)" — wrap or scroll cue.

### H5 — remaining portal screenshot journeys
- [ ] supplier (accept PO, confirm delivery, submit invoice), compliance
      (permit, visit), field roles (today's work, diary, offline incident +
      sync), owner (approve variation, dashboard), public quote (view,
      accept, deposit invoice).
- [ ] Clean seeded demo tenant, realistic names; chromium + mobile-390;
      docs/evidence/visual/<final-sha>/portal-flows/.

### H6 — PR pointers
- [ ] 1962c01 held-payment resolve screen + 0bf3592 clean-demo capture:
      exact files/tests + what each proves.

### Verify
- [ ] verify-local.sh on final commit; full Playwright matrix; evidence.

## H5 detail plan (2026-11-15)

Product gaps found while mapping journeys — fix inside H5:
- [ ] CompliancePortalView: `statutoryPermits` state never populated (permits
      table permanently empty) — wire `d.permits`; add VALID/EXPIRING_SOON/
      EXPIRED badge cases; add Site visits card (list `d.visits`) + Record
      visit form → POST /portals/compliance/:token/visits.
- [ ] OwnerDashboard: OWNER holds VARIATION_REVIEW+VARIATION_APPROVE but has
      no UI — embed VariationManagementView card (canApprove/canReview).

Spec: e2e/tests/h5-portal-journeys.spec.ts — dedicated demo tenant
(Nyota Construction Ltd, same provisioning pattern as capture-visual.mjs),
fixed realistic identities, fresh per-run fixtures (no timestamped names).
Journeys: supplier PO accept→delivery confirm→invoice; compliance permit +
record visit; field foreman today→diary→offline incident→sync; owner
dashboard→approve CO; public quote view→accept→deposit invoice via client
portal. Screenshots → docs/evidence/visual/<sha>/portal-flows/.

## H5 progress

- [x] CompliancePortalView: permits wired from `d.permits` (was permanently
      empty state), VALID/EXPIRING_SOON/EXPIRED badges, visits card +
      record-visit form → POST /portals/compliance/:token/visits.
- [x] OwnerDashboard: embedded VariationManagementView (canApprove/canReview)
      so OWNER can decide pending change orders — OWNER holds
      VARIATION_REVIEW+APPROVE but had no UI surface.
- [x] FieldDashboard: mounted OfflineSyncBanner (field roles had NO sync
      flush — queued mutations would never replay) AND fixed permission
      check bug: can() compared enum KEYS ('SITE_DIARY_CREATE') instead of
      VALUES ('site.diary_create') — 'Record diary' never rendered for
      FOREMAN/WORKER/SITE_ENGINEER/TRADE_LEAD.
- [x] e2e/tests/h5-portal-journeys.spec.ts — 6 tests × 2 viewports, all
      green (12/12). Dedicated Nyota tenant, fresh fixtures per run.
      Journeys: supplier PO accept→delivery confirm→invoice; compliance
      permits+visit; foreman diary+offline incident→exactly-once sync;
      owner CO approve; public quote accept→deposit invoice.

## H5 result (commit 473341a + spec fix)

- [x] h5-portal-journeys.spec.ts: 6 tests × chromium + mobile-390 = 12/12 green.
      Journeys: supplier PO accept→delivery confirm→invoice; compliance
      permits+record visit; foreman diary+offline incident→exactly-once sync;
      owner dashboard→approve CO; public quote view→accept→deposit invoice.
- [x] Product gaps fixed: CompliancePortalView permits/visits wiring,
      OwnerDashboard VariationManagementView embed, FieldDashboard
      OfflineSyncBanner + permission-value bug (enum key vs value),
      mobile search icon fix carried from H4.
- [x] Evidence: docs/evidence/visual/473341a/portal-flows/ (15 PNGs).
- [x] Regression: b-diary-sync.spec.ts green; web+api typecheck clean.

## H6 — review pointers (checklist 14/15)

### 1962c01 — held provider-payment resolve screen (G1)

Backend (`apps/api/src/routes/payments.ts`):
- L370 `GET /api/v1/payments/charges/review` — NEEDS_REVIEW charges not yet
  resolved; money-approval roles only.
- L407 `POST /api/v1/payments/charges/:id/resolve` — single-use resolve:
  APPLY (row-locked post to another same-tenant invoice + payment
  transaction), REFUNDED (≥15-char note + refund reference), KEEP (flagged).
  Second attempt → 409; cross-tenant → 404 via RLS. All audit-logged.
- Migration: `packages/db/prisma/migrations/0020_provider_charge_resolution/`.

Tests — `apps/api/src/payment-charge-review.test.ts` (6 tests):
1. lists NEEDS_REVIEW charges with invoice no/amount/reference/reason.
2. REFUNDED requires note+reference; resolves once (second → 409).
3. APPLY posts held amount to another invoice exactly once under
   concurrent resolve clicks (row lock).
4. APPLY rejects amount exceeding target invoice balance.
5. KEEP marks reviewed while flagged; second attempt 409s.
6. Cross-tenant charge invisible/unresolvable (404).

Frontend:
- `apps/web/src/components/PaymentReviewPanel.tsx` — APPLY/REFUNDED/KEEP UI.
- `apps/web/src/components/InvoicingView.tsx` L334 — panel mounted.
- `apps/web/src/components/console/AppShell.tsx` L240-262 — Money-rail badge
  counts pending reviews for cost.approve roles.

### 0bf3592 — clean demo-data capture (G2)

- `e2e/capture-visual.mjs` — provisions dedicated tenant
  "Nyota Construction Ltd" via `/api/v1/auth/register-company` +
  invitations + one project (Kileleshwa Residential Villas, KIL-RES-01);
  captures never see API-suite fixture rows.
- `docs/evidence/visual/0bf3592/SEED.txt` — records tenant, project, seed
  method, commit per run. CAPTURE.md + 20 console/portal PNGs (desktop
  1440 + mobile 390).
- Stale `docs/evidence/visual/90ba399/` removed in the same commit.
- UI fixes in the same commit: ClientPortalView Back → real button;
  390px header search → icon that expands the real input (Escape/result
  collapses).

## Round I plan (2026-11-16)

- [x] I1: Playwright suite ALONE on final commit → 0 failed/skipped/flaky;
      fix timeout causes not timeouts; commit e2e-<sha>.md. (RUN LAST — in progress)
- [x] I2: strip /home/, /Users/, C:\Users, hostname from all committed
      evidence logs; CI step failing on violation (show red then green);
      verify-local.sh sanitises its own log output. → 63565f1
- [x] I3: shared responsive table (<640px stacked cards) for compliance
      portal, sub valuations/retention, QS retention console + any other
      sideways-scrolling table; overflow test at 390px; supplier portal
      action-first + collapse completed + invoice button only when due;
      owner/executive variation titles wrap. → b70573a
- [x] I4: remove permission chips from user headers (admin-only "My
      access" page); plain offline wording; offline shows saved data +
      timestamp not "Failed to fetch"; shared date formatter everywhere;
      field Site tab → short job menu; owner approve only in owner-review
      state (UI + API 409 + failing test). → 52e7869
- [x] I5: thousands separators for all money via packages/money helper +
      test; quote deposit single source + terms contradiction warning;
      "•Prepared" missing space; public quote Back link. → b93a59c
- [x] I6: render PDFs outside withTenantTx (short read tx → render →
      short audit tx); pool proof committed: normal request 209ms during
      10-PDF burst (<500ms), all 10 PDFs 200. → 794c0a4
- [x] I7: varied believable seed data (suppliers/POs/variations/
      inspections/snags); portal-journey CO fixture deduped; all 22
      journey screenshots recaptured at 390px under 3749547 — every
      shot differs from ce4a440 set. → 3749547 + 3659107

## Round J plan (2026-11-16)

- [ ] J1: offline read-cache privacy — scope keys by hash(user+tenant) /
      hash(token), 7-day expiry, clear on sign-out/forced-401/portal
      401/403/404/410/revoked-429, no POST caching, no tokens in keys;
      offline-sync queue owner-scoped so user B never flushes user A's
      writes. Tests first (red run committed).
- [ ] J2: status enums → plain words via one shared helper + render test
      scanning retention/cert/invoice/variation/valuation screens; hide
      or explain role-blocked actions (Director Approve for PM) using
      the same permission check as the API; sweep money screens.
- [ ] J3: supplier portal — "Invoice submitted (ref)" state; completed
      orders/deliveries collapse behind a count.
- [ ] J4: safety register + everywhere → shared date helper; unit test
      scanning rendered output for M/D/YYYY patterns.
- [ ] J5: fresh-seed capture — no timestamped names in visible text,
      run each journey once, re-capture under final sha.
- [ ] J6: confirm captures — public quote 390px separators+deposit,
      consultant/client/subcontractor portals post-wording.

## Round J review (checklist 39–43) — complete on 8eff7e1

- J1 offline privacy: read-cache keys hashed per user+company (portal tokens hashed, never stored raw), 7-day TTL, cleared on sign-out / forced-401 / portal auth failures; write queue owner-scoped so a new sign-in cannot replay the previous user's mutations. 8 tests in offline-privacy.test.ts (red run d3e66da).
- J2 plain-words statuses: shared statusLabel() across all console/portal screens; retention actions gated by shared RETENTION_REVIEW/DIRECTOR_ROLES (same source as API). status-labels.test.tsx 11 tests.
- J3 supplier portal: "Invoice submitted" badge with reference; finished orders and confirmed deliveries collapse behind counts.
- J4 dates: formatDate/formatDateTime/formatTime everywhere; source gate + rendered-output test fail on M/D/YYYY.
- J5 fresh-seed capture: fixture names de-timestamped; fresh DB, each journey once — visual/ed3cdac (24 PNGs).
- J6: quote page, consultant, client, subcontractor recaptures in visual/ed3cdac/portal-flows.
- All 6 auditor hashes verified unchanged; evidence hygiene clean.

## Round L review

- L1 (937514b): NewProjectModal shared by console; l1-new-project.spec 6/6 both viewports.
- L2 (0042963): l2-click-sweep.spec walks admin+PM consoles (all sections/tabs) and 4 portal landings at chromium+mobile-390. Findings fixed: missing aria-pressed/aria-current on ~10 filter/tab/nav controls (all had working handlers — sweep now distinguishes active-state no-ops). No genuinely dead handler found beyond L1's button.
- L3 (166a91c): l3-admin-first-hour.spec UI-only journey, 12 shots @390px. FINDING: no UI path to add BoQ items (BoqWorkbookView read-only, BoqImportModal unmounted). Fixed VerifyEmailView StrictMode double-POST.
- L4 (0bc6aac): label:value spacing sweep (Justification + invoice/quote/commitments/takeoff labels).
- Pending: final solo Playwright + verify-local on 0bc6aac, evidence files, push.

## Round A — Admin console (replaces round L scope; items 47-52 + A1-A8 + W1-W10 + speed)

Plan (checkable):
- [ ] A-inv: docs/evidence/admin-console-inventory.md — one row per sidebar tab, honest status
- [ ] A1: New project (done in L: 937514b) — verify against new acceptance gates
- [ ] A2: click sweep exists (l2) — extend skip list w/ reasons; console-error gate
- [ ] A3: first-hour journey — add BoQ type+import, retention/deposit, pending-invite visibility, open project
- [ ] BoQ manual item CRUD: API (BOQ_EDIT) + UI in BoqWorkbookView + mount BoqImportModal in console
- [ ] Project settings UI: edit contract sum, retention rate/cap, NCA, dates (PATCH exists)
- [ ] A4: fresh-seed varied captures (seed already varied; re-capture under final sha)
- [ ] A5: spacing sweep done (0bc6aac) — verify no stragglers
- [ ] A6: Home get-started checklist + attention/money/overdue widgets w/ links
- [ ] A7: mobile project picker + always-visible selector + active states + 44px targets
- [ ] A8: permission-driven gating + no-403 test
- [ ] Speed: skeletons, waterfall fix (ProjectsSection N+1), double-submit guards, throttled-3G spec + admin-speed-<sha>.md
- [ ] W1-W10 click-through workflow specs
- [ ] Final: solo suite 0/0/0 + verify-local + evidence + push

## Phase 3 — redesign gate (3.1–3.3)

Plan:
- [x] 3.1 DESIGN.md exists; Home/Projects/New-project rebuilt to spec blocks
- [x] 3.2 theme ratchet: scripts/check-design-tokens.sh + baseline (CI wired)
- [x] 3.3 nav: 240px labelled collapsible sidebar w/ inline tabs; top bar status chip, no theme toggle; phone bottom bar Home/Projects/Site/Money/More + safe-area; mobile tab row scroll+fade
- [ ] p3-design-gate.spec.ts: UI test + 390/1280 screenshots → docs/evidence/visual/<sha>/design-gate/
- [ ] Run affected specs (a6, a7, l1, p2, w-admin, p1-break-it) on both viewports
- [ ] Commit P3.1/P3.2/P3.3 separately per rules

## Phase 3 review (closeout on da72747)

- P3.1 (2c5c9d7): docs/design/DESIGN.md + Home/Projects/New-project rebuilt; p3-design-gate spec + 390/1280 shots.
- P3.2 (72277ae): check-design-tokens.sh ratchet in CI, light-only theme.
- P3.3 (f9d25ac): labelled collapsible sidebar, inline active tabs, phone bottom bar + More sheet.
- P3.4 (85edeb1): tab roles, URL/back-forward sync fix in ConsoleContext, dead-control fix.
- P3.6 (1aa902c): rt stacked-card tables under 640px (team, roles, BoQ workbook).
- P3.7/P3.8 (68f18e3): banned-pattern review doc + sunlight fixes.
- P3.9 (da72747): nav-contract assertion follows tab role (test fix only).
- Regressions fixed en route: a6-home aggregate attention stats, a7/l1 duplicate-button locators, p1 mobile More-sheet scoping, c1 back-button timing.
- Final: full solo suite on 60c0220 — 452/452 green (e2e-60c0220.md);
  verify-local 6/6 green (verify-60c0220.log). Phase 3 ready for review.

## Phase 4 — speed

- [x] P4.1: GET /api/v1/home/summary — one call replaces Home dashboard fan-outs; shared cash-flow fetch; real snag/incident enums; members moved into ConsoleContext (kills duplicate shell fetches); get-started effect dep fixed (7b30cf1 + earlier P4 commits)
- [x] P4.2: in-flight GET dedupe in lib/api.ts; section chunks warm on idle via warmChunk (AppShell) — hover prefetch unnecessary once idle-warm; charts are inline SVG (no heavy lib to defer); background revalidation NOT added — nav data measured 250–450 ms, far under the 1.5 s budget (honest partial)
- [x] P4.3: loading=lazy on list photos; compressImageClientSide on portal uploads; usePagedList on diaries/invoices/members; immutable cache headers for hashed assets + no-cache sw.js in nginx template (7b30cf1)
- [x] P4.4: CLS via PerformanceObserver + per-section shell/data timing in measure-admin-speed.mjs; wizard driver rewritten as draft-state machine (fixed stale 4-step flow + backdrop-close race + 409 stale-draft submit)
- [x] P4.5 (50cfc92): SW precache deferred 5 s past load (was saturating throttled link); console chunks warmed in parallel with /auth/me; lessons.md pagination entry
- [x] P4.3 fix (c6862c6): explicit `page=` disables transparent auto-pagination (was double-fetching/duplicating rows); server takes first value of duplicated query keys; mutation invalidates in-flight GET dedupe (d8f4976)
- [x] P4.7 (ccb8974): gzip enabled in nginx.conf.template — template had cache headers but no compression; ~660 kB JS/CSS would have shipped raw. Verified via local nginx mirroring the template.
- [x] P4.6 attempted + REVERTED (ab900bb/02d3ffd → e4c4d5c/f32f38e): lazy LoginForm/LandingPortalHub cut entry 327→270 kB but introduced a lazy-boundary race (specs + users see 'Loading…' flash on landing); ~57 kB saving didn't move first-screen reliably. Reverted, not shipped.
- [x] Closeout evidence: ui-speed-ccb8974.md (18/19 budgets; first-screen 3436 ms MISS documented honestly — CPU-bound under 4x throttle, bandwidth fixed), e2e-ccb8974.md (452/452 solo suite on identical tree), verify-ccb8974.log (6/6 turbo tasks green)

## Part A — auditor fixes on 699a61a (stop before Part B)

- [ ] A1: sidebar tabs must render under their OWN section item; only active section expands; DOM-adjacent order test @1280px
- [ ] A2: phone bottom bar text labels under every icon, 56px, active clear; test @390px
- [ ] A3: phone header project selector truncate+ellipsis, status beside it; single nav level on phone
- [ ] A4: clean seed/demo names (no timestamps, no 7 identical projects); "Context:" line shows project name not ID
- [ ] A5: remove Home hero card + big Open projects button; order = Needs you now → Get started → spec blocks; full-page shots 390/1280 with real data
- [ ] A6: extend break-it checks to every admin primary save (BoQ, diary, snag, inspection, safety, PO, invoice, payment, valuation, certificate, subcontractor, upload, announcement); coverage table
- [ ] A7: first-screen <3000ms — route-level console split / defer non-critical; 5-run median on quiet host; honest miss if remains
- [ ] A8: list >800-line files; split daily-use ones, no behaviour change
- [ ] A9: evidence on FINAL commit; report table + counts + A6 table + screenshots; STOP

## A8 review — eight oversized view splits (uncommitted)

Pure code-motion splits; each original file keeps its public exports and
import path, delegating presentational JSX to a sibling `<Name>.parts.tsx`.
State, hooks, API calls, handlers, and currency-guard-sensitive formatting
expressions stayed in the shells; formatted values are passed as props.

| View | Shell lines | Parts lines | Parts file |
|---|---|---|---|
| PlantTelematicsView | 742 | 973 | PlantTelematicsView.parts.tsx |
| TopographicSurveyView | 598 | 885 | TopographicSurveyView.parts.tsx |
| ContractorTenderBoardView | 329 | 917 | ContractorTenderBoardView.parts.tsx |
| ClientDashboard | 428 | 726 | ClientDashboard.parts.tsx |
| LaborMusterRollView | 463 | 719 | LaborMusterRollView.parts.tsx |
| PlantEquipmentView | 444 | 731 | PlantEquipmentView.parts.tsx |
| RmcTransitTrackerView | 495 | 627 | RmcTransitTrackerView.parts.tsx |
| AsphaltPavementView | 440 | 642 | AsphaltPavementView.parts.tsx |

Verification: `pnpm exec tsc --noEmit` in apps/web — clean (0 errors).
`vitest run src/currency-guard.test.ts` — 2/2 pass. No `.parts.tsx` file
contains `KES <amount>` literals, `.toFixed(2)`, or `toLocaleString` money
formatting (guard-safe by construction).

Not touched per instructions: IndependentSiteReportView.tsx,
RetentionAndBondsView.tsx, e2e/tests/aud-*.spec.ts, aud-specs.sha256.
NOTE: IndependentSiteReportView/RetentionAndBondsView and their .parts/.modals
files show pre-existing uncommitted changes from earlier work — not from this
task; left untouched.

## Part A progress (auditor fixes on 699a61a)

- [x] A1 sidebar tab adjacency — pa-auditor-fixes.spec.ts, 7/7 chromium green (`7e7a616`)
- [x] A2 phone bottom bar labels + real-click hit test — green on mobile-390 (`1b56ee5` + layout settled; earlier 463px overflow no longer reproduces — verified innerWidth=390, scrollWidth=390 on all sections)
- [x] A3 phone project picker — truncated name + status chip (`1b56ee5`)
- [x] A4 realistic fixture names — fixtureName() pools across 28 spec files (`0ab9327`, `a2958ea`); aud-*.spec.ts untouched
- [x] A5 Home hero removed, Needs-you-now first, enriched seed (milestones/diaries/photos/invoices/EVM) (`f2618eb`, `43f6ef5`); screenshots `docs/evidence/visual/f8b9c3a/part-a/`
- [~] A6 break-it 13 surfaces — pa-break-it-console.spec.ts; chromium 13/13 green across runs; mobile-390 in progress. Product bugs found+fixed: SiteDiaryModal fake-queue on HTTP errors (`27b8325`), SafetyIncidentLogView silent catch→fake-save (`405d8a0`), SubcontractorManagementView fire-and-forget close (`8866c2e`)
- [~] A7 first screen — entry chunk 327.8→270.3 kB (lazy LoginForm/LandingPortalHub, `f8b9c3a`); 5-run median on CURRENT host ~5.2 s (load avg ~20 — host not quiet; honest miss to report)
- [x] A8 ten >800-line views split shell+parts (`ff08d06`); 3 parts files remain >800 (single presentational tables)
- [ ] A9 final-commit suite + verify-local + report — pending

## Part A — auditor fixes on 699a61a — IN PROGRESS (awaiting review)

- [x] A1 sidebar tabs under own item — 7e7a616 (+ pa-auditor-fixes spec)
- [x] A2 bottom-bar labels 56px — 6c3abc6/1b56ee5
- [x] A3 phone header picker truncate+status — 1b56ee5/0a83daa
- [x] A4 realistic fixture names + clean seed — a2958ea/0ab9327/43f6ef5/a486643/343594e
- [x] A5 Home hero removed, Needs-you-now first — f2618eb/74f08fb
- [x] A6 break-it all 13 admin saves — pa-break-it-console.spec.ts (87a2038, green both viewports)
- [x] A7 lazy landing-only views — f8b9c3a
- [x] A8 split >800-line daily views — 8866c2e/ff08d06/405d8a0
- [x] Suite fixes: tab race 53f400e, i-stage1 locator 11c11a2, aria-pressed f659ced, picker race e3fd29a, chip status a4536b6, App.test prerender 2047df6
- [ ] A9 evidence + report — suite on e3fd29a (246+240 green, 1 spec-bug fail fixed+reverified), verify-local on 2047df6 running

## Part B — Phase 5 (location, evidence, comms, queue) — IN PROGRESS

Gap survey complete (subagent). Plan, one item = one commit, tests first:

- [x] P5.1 Real GPS capture: enable geolocation in Permissions-Policy (vite+nginx), shared useGeolocation hook w/ accuracy, gps_accuracy_meters on SitePhoto/SnagPhoto/IndependentInspectionPhoto (+migration), replace hardcoded Nairobi coords (SiteDiaryModal, CreateSnagModal, GeofencedClockInView, PhotoEvidenceGallery, reports.ts, IndependentSiteReportView) — 882fa82, 026bfd5
- [x] P5.2 Photos time+location: device timestamp + accuracy captured at shutter; display accuracy in gallery — covered by P5.1 fields + diary/snag/clock-in geolocation
- [x] P5.3 Project map: map lib (react-leaflet+OSM), project pin picker in onboarding, map view showing project + geofences + photo pins — 56e9620
- [x] P5.4 Camera link: FIELD portal_type on PortalAccessLink, token-gated mobile photo-capture page (capture=environment, GPS, daily photo), admin "copy link" UI — e071f14 (API), 0d10453 (UI+e2e)
  - API: PortalTypeEnum+='FIELD'; GET /api/v1/portals/field/:token (project+stakeholder+today diary/photos); POST .../uploads (verified multipart); POST .../photos (find-or-create today EAT diary, weather/siteStatus required only when creating); GET .../files/* (token-scoped serve — /uploads/* needs session)
  - Web: FieldPortalView (camera capture input, GPS via useGeolocation, weather/status chips when first photo of day), App.tsx 'field' case, PortalAccessLinkManager FIELD option
  - Tests: field-portal.test.ts (API) + e2e p5-field-camera.spec.ts
- [x] P5.5 Live notifications: SSE endpoint /api/v1/events (auth'd, tenant-scoped), web EventSource → toast + inbox refetch; pg_notify inside tx (commit-safe); web-push behind VAPID config NOT built — honest gap — 4c175f5
- [x] P5.6 Comments/mentions: polymorphic EntityComment (diary, invoice, RFI, observation...), @mention → InboxMessage notify — 401027e (+6c1a7d2 hygiene fix)
  - Model EntityComment (tenant, entity_type/id, project_id, author, body, mentions[]) + migration; CreateEntityCommentSchema
  - GET/POST /api/v1/comments?entityType=&entityId= — whitelist resolver (SITE_DIARY, SNAG_ITEM, INVOICE, RFI, SITE_OBSERVATION, VARIATION_ORDER, QUOTE); mention tokens → member match (email/prefix/full name) → direct InboxMessage + publishInboxEvent
  - Web: EntityComments.tsx mounted on invoice detail expand + snag cards; e2e p5-entity-comments.spec.ts (4/4 both viewports); API entity-comments.test.ts (4/4)
  - Note: legacy snagComment (portal review notes) is a separate store — kept
- [x] P5.7 Messaging delivery status: MessageDelivery model+migration, recordMessageDelivery wired into all dispatchNotification call sites (integrations test-send, platformServices inspection alerts, enterpriseOperations site alerts, scheduledReports), admin-only GET /api/v1/message-deliveries, delivery log UI under Files & reports → Integrations (COMPANY_ADMIN/ADMIN) — bdfea7a (red d15c23a); note: IntegrationsView was previously unreachable (only CompanyAdminDashboard referenced it) — now mounted in console FilesSection
- [x] P5.8 pg-boss queue: pg-boss@12.38.2 (schema `pgboss`), startJobs after listen (queue outage can't block API), sweep */5min runs due ACTIVE scheduled reports via shared lib/scheduledReportRunner (route refactored to same runner), daily 06:00 UTC invoice-reminders (client email→SMS fallback, 72h dedupe via message_deliveries) — 33d22ee (red 4fd068e); jobs.test.ts 2/2, g5-9+deliveries regression 8/8
- [x] P5.9 Meetings + .ics: Meeting model+migration, CRUD /api/v1/meetings (PROJECT_VIEW/EDIT), GET /:id/ics RFC5545 folded escaped text/calendar, Site→Meetings tab (schedule form, .ics link, cancel) — f116f49 (red 11847fe); p5-meetings e2e 2/2, meetings.test 3/3; P5.8 boot fixes 10734cd (pgboss schema migration + pre-listen onClose)
- [x] P5.10 Slow work off request path: ExportJob model+migrations (PENDING default + claim_export_job SECURITY DEFINER in rls.sql), lib/reportWorkbooks.ts shared builders (sync *.xlsx endpoints unchanged for auditor specs), routes/exportJobs.ts (POST …/reports/{financials,cost}/export → 202, GET status, GET download via storage driver), pg-boss QUEUE_EXPORT + QUEUE_REPORT_DELIVERY workers + enqueue fallbacks + stale-PENDING reaper in sweep, /run route defers delivery (deliveriesStatus DONE|QUEUED), console FilesSection+MoneySection Excel buttons → queued flow — export-jobs.test.ts 3/3 (red 38edb17)
- [x] P5.11 Closeout: solo suite 509/0/9 on 603726b (docs/evidence/e2e-603726b.md); verify-local 6/6 on cca2c88 (703 api tests, docs/evidence/verify-cca2c88.log); regressions fixed: route-guard allowlists 2489fd2, DB-default restore migration, document_counters fixture bypass cca2c88

## Competitor backlog (from Assistant QS suite — docs/research/assistant-qs-suite-notes.md)
Proposed post-Phase-5 items, priority order:
- [ ] CB1 Indent depth: store+floor/unit+work-order targeting, service/material category, delivery schedule batches, lead-time benchmark, amend-material, print, audit trail, 4-way fulfilment buckets
- [ ] CB2 Rate master: shared rate library (geo + item typing), bulk upload/edit, prefill BoQ/PO rates
- [ ] CB3 Gate pass: material-exit authorization register
- [ ] CB4 GRN/PO register view: supplier+store+value columns, dedicated register screen
- [ ] CB5 Contractor master: unified firm register (KRA PIN, work categories, approval status)
- [ ] CB6 BOQ floor/unit mapping for takeoff
- [ ] CB7 Print views: indent/PO/GRN site paperwork
