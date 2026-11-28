# API contract conventions (D4)

Base: `/api/v1` · Auth: HttpOnly `access_token` cookie (+ `refresh_token`
rotation via `POST /auth/refresh`) · Errors: `{ statusCode, error, message,
code? }` with proper HTTP status.

## Response envelope

Endpoints historically mix three shapes. **Convention for new/changed
endpoints: `{ data: ... }`** (single resource or `{ items, page }` for
lists). The typed web client (`apps/web/src/lib/apiClient.ts`) returns the
parsed body as-is — callers type the shape they consume.

Known exceptions (legacy, unchanged):
- `GET /invoices` → `{ invoices, page }`
- `GET /quotes` → `{ quotes }`
- `GET /projects/:id/subcontractor-valuations` → `{ valuations }`
- `GET /projects/:id/subcontractor-retention-releases` → `{ releases }`
- `GET /projects/:id/contractor-bonds` → `{ bonds }`
- `POST /invoices/:id/payments` → `{ payment, invoice }`
- Auth responses → `{ user, permissions, ... }` (no `data` wrapper)

## Idempotency

Money mutations require `Idempotency-Key` (UUID). Replays return the
original result; reusing a key for a different payload → 409.
`POST /invoices/:id/payments` additionally enforces a unique
`(tenant_id, reference)` on non-null references → 409
`DUPLICATE_PAYMENT_REFERENCE`.

## OpenAPI

`@fastify/swagger` + `swagger-ui` are registered in non-production (or with
`OPENAPI_ENABLED=1`). Spec JSON: `GET /docs/json`, UI: `/docs`.
Route `schema` blocks exist for the core money surface (auth me/login,
projects list, invoices CRUD/send/void/payments, payment certificates
list/preview/create/patch/action/create-invoice, closeout). Remaining
routes are undocumented — extend `schema` blocks as they are touched.
