# tasks/todo.md — active plan

## Current: Stage 6 — completion/closeout portal loop — ALL DONE pending final verify (7959ca7)

Auditor spec `aud-stage6-completion-closeout.spec.ts` locked (S6.0, hash verified).
S6.1 engine done (snag counting, ledger retention, cert permission, DLP derivation,
CLOSED gates, write-off). Now the portal loop + e2e + decisions + report.

### S6.2 API — externalPortals.ts
- [x] Consultant GET: add `snags` (non-private, project-scoped) + counts; scope 'SNAGS'
- [x] Consultant POST `/snags/:snagId/review` {action VERIFY|REJECT, reason?, photoStorageKey?}
      VERIFY: READY_FOR_REVIEW|RECTIFIED_BY_CONTRACTOR -> VERIFIED_CLOSED (verified_by=stakeholder)
      REJECT: reason >=15 non-space chars + photoStorageKey prefix-validated -> REJECTED
      + SnagComment(author=stakeholder) + SnagPhoto; audit SNAG_REVIEWED_VIA_PORTAL; notifyTeam
- [x] lifecycle.ts: allow REJECTED -> IN_PROGRESS (rework path, dead-end fix)
- [x] Client GET: add `closeout` {pcCert, snagCounts, snags(no cost), dlpExpiry, retention pos, acknowledged}
- [x] Client POST `/closeout/acknowledge` {typedName} — once per project (unique), audit
- [x] Schema+migration 0022: PracticalCompletionAcknowledgement (tenant_id -> RLS auto)
- [x] Subcontractor GET: add `retentionReleases` array for bound package
- [x] Subcontractor POST `/retention-release` — pkg snags all VERIFIED_CLOSED, held>0,
      no pending release; FIRST_MOIETY 50% or SECOND only at DEFECTS_EXPIRED/CLOSED;
      release_no seq; audit + notifyTeam

### S6.2 Web portal views
- [x] ConsultantPortalView: snags awaiting verification + verify/reject (reason+photo via uploads endpoint)
- [x] ClientPortalView: closeout card (PC status, snag counts, DLP expiry, retention) + acknowledge form
- [x] SubcontractorPortalView: retention releases list + request-release button

### S6.2 Tests + evidence
- [x] API vitest: portal-closeout.test.ts (consultant verify/reject auth+validation, client ack once/409, sub release gating, cross-tenant)
- [x] Playwright s6-portal-closeout.spec.ts: link->action journeys chromium+mobile-390, screenshots -> docs/evidence/visual/<sha>/portal-flows/
- [x] Supplier + compliance portal e2e: token still valid after HANDED_OVER

### S6.3
- [x] docs/decisions-needed.md: client ack binding?; consultant reject -> REJECTED status choice
- [x] 10% retention project test (retention_rate_pct configurable per package)
- [x] Report table + partial/decisions/missed

### Verify
- [~] verify-local.sh on final commit; evidence log named for sha (running on 7959ca7)


## Review — Stage 6 closeout (S6.0–S6.3 + fixes)

- S6.0 `04fdc52`: auditor spec locked verbatim, sha256 appended, CI spec-count bumped to 6.
- S6.1 `01e74c5`: snag-aware closeout gates (only VERIFIED_CLOSED counts as closed),
  ledger-driven retention via `retentionPosition()` (latest CERTIFIED/PAID IPC
  `retention_held` minus issued DLC releases), one PC cert per project (409),
  DLP expiry derived + justified future-only override, `CERTIFICATE_CLOSEOUT`
  permission, CLOSED gates on snags/invoices/pending certs/retention with
  audited >=15-char admin write-off, PC no longer flips project COMPLETED.
- S6.2 `836d283` (+`c0fae5b` typecheck fix): consultant portal snag
  verify/reject (reason+photo, audit as stakeholder, team notified), client
  closeout view + one-time typed-name PC acknowledgement, subcontractor
  package-bound retention release requests gated on package snag closure.
  Playwright journeys chromium+mobile-390 green; screenshots in
  `docs/evidence/visual/836d283/portal-flows/`.
- S6.3 `62dcb49`: decisions logged (client ack binding semantics etc.),
  10% package retention-rate API test.
- Post-verify fix `7959ca7`: pre-existing vitest suites still asserted the
  OLD contract — hard-coded 5%x50% release guess, COMPLETED side-effect,
  terminal REJECTED, and un-allowlisted portal routes. Aligned fixtures to
  the new contract (seeded CERTIFIED IPC rows so ledger retention exists);
  no product weakening — the ledger values now prove the same moieties.
- Regression: portal-closeout 5/5, lifecycle-extensions 33/33,
  e2e-live-site-simulation 24/24, s6-snag-depth 5/5, route-guard 8/8,
  portal regression 16/16, aud+portal Playwright 20/20 (chromium),
  s6-portal-closeout 5/5 chromium + 5/5 mobile-390.
