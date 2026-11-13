# ADR-013: Next scale step — job queue on Postgres, shared state in DB

Status: proposed (pilot → first growth step)
Date: 2026-11-15

## Context

SiteSafi runs as ECS Fargate tasks behind an ALB. Today the API is a
single-digit number of tasks; all coordination state that must survive
restarts or be shared between tasks already lives in PostgreSQL (RLS-scoped
rows, `idempotency_keys`, `login_throttles`, `document_counters`). The known
pressure points for the next step are:

- **PDF/report generation** — CPU-bound, now capped at 2 concurrent renders
  per process with a 30 s timeout (`renderPdfToBufferLimited`). Under
  multi-task scale each task still renders independently; a queue would let
  one worker pool absorb bursts.
- **Transactional email, webhooks, scheduled reports** — already asynchronous
  in shape but invoked inline; retries are manual.
- **Any remaining per-process state** — none is permitted for security
  decisions (login throttling moved to `login_throttles` in Stage-7); the
  rule going forward: *no per-process memory may gate, count, or decide
  anything security- or money-relevant*.

## Decision

Adopt **pg-boss** (Postgres-backed job queue) as the job runner for the next
scale step, with these constraints:

1. **Queue tables live in the same database**, schema-owned by the migrator
   role; workers connect as `db_app` and are subject to the same RLS rules —
   a job payload must carry `tenant_id` and every handler re-enters
   `withTenantTx`.
2. **Shared state stays in the DB.** Sessions, throttles, counters,
   idempotency records, feature flags — all Postgres. No Redis requirement;
   Redis may be added later only for cache, never for correctness.
3. **Job types (first wave):** `email.send`, `pdf.render`,
   `report.schedule`, `webhook.deliver`, `mpesa.reconcile` (simulated).
4. **Concurrency:** per-queue `teamSize`/`localConcurrency` tuned so PDF
   renders stay ≤ the CPU budget measured in Stage-7 (event-loop p99 < 2 s
   under a 10-request burst).
5. **No new infrastructure vendor.** pg-boss needs only the existing RDS
   instance; it adds two tables and a polling loop inside the API process
   (or a dedicated worker service reusing the same image).

## Alternatives considered

- **BullMQ + Redis** — faster, richer UX, but adds a stateful service,
  another failure domain, and splits "source of truth" across two stores.
  Rejected for pilot scale; revisit if queue depth demands it.
- **AWS SQS + Lambda/ECS worker** — more moving parts, cross-cloud IAM
  surface, and still needs Postgres for job state dedup. Rejected.
- **Stay inline** — fine at current scale; the PDF limiter already prevents
  event-loop starvation. This ADR triggers when report/email volume or task
  count makes inline execution the bottleneck.

## Consequences

- Workers must be idempotent (jobs may retry); handlers reuse the existing
  `withTenantTx` + audit-log patterns.
- Migrations must create pg-boss schema tables via `prisma migrate deploy`
  (raw SQL migration, not `db push`).
- The "no per-process security state" rule is now architectural: any future
  limiter/cache that affects auth, money, or tenancy must be DB-backed.
