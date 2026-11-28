-- Stage-7 audit hardening:
--  1. document_counters — atomic per-scope numbering (invoice_no per tenant,
--     certificate_no per project). Backfilled from existing maxima.
--  2. login_throttles — DB-backed failed-login counters keyed by IP and by
--     normalised account (replaces per-process memory).
--  3. invoice_payments — partial unique index on (tenant_id, reference) so a
--     duplicate payment reference can never double-post (maps to 409).

CREATE TABLE IF NOT EXISTS "document_counters" (
  "tenant_id"  UUID         NOT NULL,
  "scope"      VARCHAR(120) NOT NULL,
  "last_value" BIGINT       NOT NULL DEFAULT 0,
  "updated_at" TIMESTAMPTZ  NOT NULL DEFAULT now(),
  CONSTRAINT "document_counters_pkey" PRIMARY KEY ("tenant_id", "scope")
);

CREATE TABLE IF NOT EXISTS "login_throttles" (
  "id"           UUID         NOT NULL DEFAULT gen_random_uuid(),
  "scope"        VARCHAR(10)  NOT NULL, -- 'IP' | 'ACCT'
  "identifier"   VARCHAR(320) NOT NULL,
  "window_start" TIMESTAMPTZ  NOT NULL,
  "fail_count"   INTEGER      NOT NULL DEFAULT 0,
  "updated_at"   TIMESTAMPTZ  NOT NULL DEFAULT now(),
  CONSTRAINT "login_throttles_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "login_throttles_scope_identifier_key" UNIQUE ("scope", "identifier")
);

-- Backfill invoice counters: one row per tenant at its current max(invoice_no).
INSERT INTO "document_counters" ("tenant_id", "scope", "last_value")
SELECT "tenant_id", 'INVOICE', COALESCE(MAX("invoice_no"), 0)
FROM "invoices"
GROUP BY "tenant_id"
ON CONFLICT ("tenant_id", "scope") DO NOTHING;

-- Backfill certificate counters: one row per (tenant, project) at current max.
INSERT INTO "document_counters" ("tenant_id", "scope", "last_value")
SELECT "tenant_id", 'CERT:' || "project_id"::text, COALESCE(MAX("certificate_no"), 0)
FROM "payment_certificates"
GROUP BY "tenant_id", "project_id"
ON CONFLICT ("tenant_id", "scope") DO NOTHING;

-- Duplicate payment references are rejected at the DB layer.
CREATE UNIQUE INDEX IF NOT EXISTS "invoice_payments_tenant_reference_key"
  ON "invoice_payments" ("tenant_id", "reference")
  WHERE "reference" IS NOT NULL;
