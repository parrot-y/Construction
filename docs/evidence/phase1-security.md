# Phase 1 — Security & Data Safety — Evidence

Branch: devin/audit-remediation. Prior session implemented the bulk; this phase adds the required evidence + closes remaining gaps.

## 1.1 Authorization
- `docs/evidence/route-authz-matrix.md` — all **273 routes** enumerated with guard source. Unguarded: **0**.
- Command: `node /tmp/genmatrix.mjs` → `routes: 273 unguarded: 0`
- Central enforcement: `apps/api/src/plugins/routeAuthorization.ts` maps every authenticated route to a permission (or explicit self-service/in-handler justification) and enforces **project membership** via onRoute hook. Tenant-wide roles exempt; nonexistent projects fall through to handler 404.
- b2c-disburse: `ROUTE_PERMISSIONS['POST .../b2c-disburse'] = COST_APPROVE` + maker-checker in handler (`initiated_by !== approver`, PENDING_APPROVAL state, approve/reject routes also COST_APPROVE, audit-logged).
- Retention release review: `COST_APPROVE` in map + role check in-handler.
- certificates.ts `/payment-certificates/:certId/action` and variations.ts `/variations/:id/review`: added `requireAnyPermission` baseline preHandler (new shared helper in plugins/rbac.ts); handler keeps per-action permission (CERTIFICATE_MANAGE vs COST_APPROVE; VARIATION_APPROVE/REVIEW/REQUEST per ADR-010).
- route-guard.test.ts: 8/8 pass — fails build on any authenticated route lacking authenticate+permission guard unless allowlisted.

## 1.2 Route-guard test
- `pnpm vitest run src/route-guard.test.ts` → `Tests 8 passed (8)`
- Scanner now recognises `requireAnyPermission` as a permission guard.

## 1.3 Uploads
- `apps/api/src/lib/uploadSecurity.ts` — magic-byte + MIME allowlist; extension derived from verified type, never filename; 15MB cap (multipart).
- `apps/api/src/lib/storage.ts` — storage driver seam (local volume `UPLOAD_DIR`, object-storage slot).
- `GET /uploads/*` authenticated + tenant-scoped + project-membership checked, `Content-Disposition`, `X-Content-Type-Options: nosniff`, traversal-safe.
- `src/g5-14-upload-security.test.ts` → 4/4: unauthenticated 401, cross-tenant 404, MIME-spoofed .html rejected, download headers present.

## 1.4 Migrations
- `packages/db/prisma/migrations/0001_baseline`, `0002_rls_policies`, `0003_refresh_tokens` committed.
- `scripts/verify-local.sh` runs `prisma migrate deploy` on a fresh empty cluster then re-applies `rls.sql` every run; RLS verified `relrowsecurity=t, relforcerowsecurity=t` (107+ tables incl. refresh_tokens).
- `prisma db push` no longer used in verify path. users/tenants RLS exception documented in rls.sql header (identity resolution precedes tenant context).

## 1.5 Sessions
- 15m access + 7d refresh (`typ` claim); `/auth/refresh` rotates; `refresh_tokens` table (jti) gives server-side revocation + reuse detection (replay → family revoked).
- `authenticate` checks `is_active` + live membership on EVERY request.
- `@fastify/rate-limit`: login 30/min, refresh 30/min, `/api/public/quotes` 30/min; login also has failed-attempt lockout.
- `GET/DELETE /api/v1/auth/sessions` + SessionsModal UI (per-device revoke, sign-out-others).
- `src/g5-15-session-security.test.ts` → 6/6.

## 1.6 M-Pesa — CHOSEN: SIMULATED labels
- API returns `simulated: true` on STK push + B2C initiation; B2C uses maker-checker (PENDING_APPROVAL → approve/reject by different COST_APPROVE user).
- UI shows SIMULATED chips and honest pending/callback language; billing UI no longer fabricates SUCCESS receipts.
- Real Daraja sandbox calls NOT implemented — requires credentials; documented in docs/DEPLOY.md.

## Verification
- `scripts/verify-local.sh` on head: **714/714 tests** (API 510, web 117, money 63, db 15, permissions 9), lint/typecheck/build clean. Evidence: docs/evidence/verify-8517045.log.
