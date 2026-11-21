-- B1 pilot scope: per-tenant module flags. Non-core modules default OFF;
-- operator enables per tenant. Core modules are never gated.
CREATE TABLE IF NOT EXISTS "tenant_module_flags" (
  "id"         UUID         NOT NULL DEFAULT gen_random_uuid(),
  "tenant_id"  UUID         NOT NULL,
  "module"     VARCHAR(40)  NOT NULL,
  "enabled"    BOOLEAN      NOT NULL DEFAULT false,
  "updated_by" VARCHAR(64),
  "updated_at" TIMESTAMPTZ  NOT NULL DEFAULT now(),
  CONSTRAINT "tenant_module_flags_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "tenant_module_flags_tenant_id_module_key" UNIQUE ("tenant_id", "module"),
  CONSTRAINT "tenant_module_flags_tenant_id_fkey" FOREIGN KEY ("tenant_id")
    REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE INDEX IF NOT EXISTS "tenant_module_flags_tenant_id_idx" ON "tenant_module_flags"("tenant_id");
