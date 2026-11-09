# Skill: system-design-review

## When to use
Before any code (design gate) and at each milestone review. Produces C4 diagrams and the pass/fail checklist.

## Procedure
1. C4 context diagram: users, our system, external systems (M-Pesa Daraja, SMS/WhatsApp providers, KRA eTIMS, maps, storage, email).
2. C4 container diagram: web app, API, DB, cache/queue, object storage, workers.
3. C4 component diagram for the API: auth, tenancy/RLS, modules, jobs, integrations.
4. Scalability & failure modes: what breaks at 10 / 100 / 1,000 tenants; payment callback retries; offline sync conflicts.
5. Cost estimate at each scale (managed services preferred).
6. Run the DESIGN PASS/FAIL CHECKLIST — the critic must answer each explicitly.

## Pass/fail checklist (all must be YES or justified)
- Tenant isolation proven by tests?
- Payments idempotent (callbacks, retries, duplicates)?
- Every action permission-checked server-side?
- Audit trail complete for financial/approval actions?
- Works on weak networks (offline PWA path)?
- Backups restorable (tested, not just configured)?
- Can one person operate it (runbooks, alerts, on-call burden)?
- Simplest thing that works — anything over-engineered flagged?

## Output template
`SYSTEM_DESIGN.md` sections per the Gate 3 brief + `CRITIC_REVIEW_DESIGN.md` with per-item verdicts.

## Common mistakes
- Designing for scale we don't have (microservices for a solo founder).
- "We'll add audit later" — audit is structural, retrofit is painful.
- Ignoring the failure mode of the payment callback (duplicate STK confirmations are normal, not exceptional).
