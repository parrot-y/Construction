# Skill: security-and-compliance

## When to use
Security review of any milestone, and all work touching auth, tenancy, files, payments, personal data.

## Procedure
1. **Tenant isolation**: every tenant-scoped table has RLS (FORCE) or equivalent; isolation tests run as the non-superuser app role, not the owner. Test: tenant A cannot read/write tenant B's rows even with guessed IDs.
2. **RBAC at API level**: every route checks permission server-side; UI hiding is not security. Test 403s, not just 200s for allowed roles.
3. **Secrets**: never in repo/logs/screenshots; `.env.example` sanitized; CI secret scan; separate creds per environment.
4. **OWASP Top 10 pass**: injection (parameterized queries/ORM), broken auth (rate limits, secure sessions), sensitive data exposure (TLS, no PII in logs), XXE, broken access control, misconfiguration, XSS, insecure deserialization, known-vuln deps (`pnpm audit`), insufficient logging.
5. **KDPA 2019**: lawful basis, purpose limitation, data minimisation, retention limits, data-subject rights, breach notification to ODPC, privacy notice. Property photos of persons = personal data.
6. **Audit logging**: append-only for financial/approval/security events; immutable at DB level where possible (no UPDATE/DELETE grants).
7. **Backups**: encrypted, access-controlled, restore-tested on a schedule.

## Checklist
- [ ] Isolation tests exist and run as app role
- [ ] Permission check on every new/changed route
- [ ] No secrets in diff; audit clean
- [ ] Financial records immutable (no update/delete path)
- [ ] Uploads validated (type, size, scanning if feasible), served safely
- [ ] Rate limiting on auth and expensive endpoints
- [ ] Audit log entries for every sensitive action

## Common mistakes
- Testing isolation as superuser (RLS silently bypassed — this happened here, see R-014).
- "Admin can do anything" shortcuts that skip permission checks.
- Retention policies that keep personal data forever.
