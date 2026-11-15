# tasks/todo.md — active plan

## Current: Stage 6 — completion/closeout portal loop (S6.2 + S6.3)

Auditor spec `aud-stage6-completion-closeout.spec.ts` locked (S6.0, hash verified).
S6.1 engine done (snag counting, ledger retention, cert permission, DLP derivation,
CLOSED gates, write-off). Now the portal loop + e2e + decisions + report.

### S6.2 API — externalPortals.ts
- [ ] Consultant GET: add `snags` (non-private, project-scoped) + counts; scope 'SNAGS'
- [ ] Consultant POST `/snags/:snagId/review` {action VERIFY|REJECT, reason?, photoStorageKey?}
      VERIFY: READY_FOR_REVIEW|RECTIFIED_BY_CONTRACTOR -> VERIFIED_CLOSED (verified_by=stakeholder)
      REJECT: reason >=15 non-space chars + photoStorageKey prefix-validated -> REJECTED
      + SnagComment(author=stakeholder) + SnagPhoto; audit SNAG_REVIEWED_VIA_PORTAL; notifyTeam
- [ ] lifecycle.ts: allow REJECTED -> IN_PROGRESS (rework path, dead-end fix)
- [ ] Client GET: add `closeout` {pcCert, snagCounts, snags(no cost), dlpExpiry, retention pos, acknowledged}
- [ ] Client POST `/closeout/acknowledge` {typedName} — once per project (unique), audit
- [ ] Schema+migration 0022: PracticalCompletionAcknowledgement (tenant_id -> RLS auto)
- [ ] Subcontractor GET: add `retentionReleases` array for bound package
- [ ] Subcontractor POST `/retention-release` — pkg snags all VERIFIED_CLOSED, held>0,
      no pending release; FIRST_MOIETY 50% or SECOND only at DEFECTS_EXPIRED/CLOSED;
      release_no seq; audit + notifyTeam

### S6.2 Web portal views
- [ ] ConsultantPortalView: snags awaiting verification + verify/reject (reason+photo via uploads endpoint)
- [ ] ClientPortalView: closeout card (PC status, snag counts, DLP expiry, retention) + acknowledge form
- [ ] SubcontractorPortalView: retention releases list + request-release button

### S6.2 Tests + evidence
- [ ] API vitest: portal-closeout.test.ts (consultant verify/reject auth+validation, client ack once/409, sub release gating, cross-tenant)
- [ ] Playwright s6-portal-closeout.spec.ts: link->action journeys chromium+mobile-390, screenshots -> docs/evidence/visual/<sha>/portal-flows/
- [ ] Supplier + compliance portal e2e: token still valid after HANDED_OVER

### S6.3
- [ ] docs/decisions-needed.md: client ack binding?; consultant reject -> REJECTED status choice
- [ ] 10% retention project test (retention_rate_pct configurable per package)
- [ ] Report table + partial/decisions/missed

### Verify
- [ ] verify-local.sh on final commit; evidence log named for sha

