# tasks/todo.md — active plan

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
