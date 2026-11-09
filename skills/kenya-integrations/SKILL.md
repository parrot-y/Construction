# Skill: kenya-integrations

## When to use
Any integration touching money, messaging, tax or identity in Kenya: M-Pesa Daraja, SMS (Africa's Talking etc.), WhatsApp Business API, KRA eTIMS, bank/PesaLink, local accounting.

## Rules
1. **Sandbox first, always.** No live credentials in dev/staging. Live mode is a separate, owner-approved milestone.
2. **Idempotency is mandatory** for anything financial: dedupe on provider reference (e.g. M-Pesa TransID), store callback payload hash, reconcile asynchronously.
3. **Never trust client-supplied tenant/org identifiers** in callbacks — resolve tenant from the provider reference via DB lookup.
4. **Callback authenticity**: verify signature/shared-secret with constant-time comparison; reject unsigned requests.
5. **Reconciliation**: every payment must be matchable to an invoice/subscription; unmatched funds go to a visible "unallocated" state, never silently dropped.
6. **eTIMS/VSCU**: real tax invoices require certified integration — never simulate signatures or QR codes in production output (this was audit finding C2; see REMEDIATION_PLAN R-022).

## Procedure
1. Identify trigger → data flow → user-visible result → failure path for each integration.
2. Design: request signing, callback endpoint, retry + dead-letter handling, reconciliation job, admin visibility of failures.
3. Test plan: duplicate callback, out-of-order callback, callback for unknown reference, timeout mid-flow, sandbox happy path.

## Checklist
- [ ] Idempotency key / provider ref dedupe implemented and tested
- [ ] Tenant resolved server-side from provider data
- [ ] Signature/secret verification constant-time
- [ ] Dead-letter + alerting for failed callbacks
- [ ] Reconciliation report exists
- [ ] Sandbox-tested before any live credential request

## Common mistakes
- Treating callbacks as guaranteed-once.
- Logging full phone numbers / credentials.
- Building eTIMS "compatibility" that fakes certification — legally risky, audit failure.
