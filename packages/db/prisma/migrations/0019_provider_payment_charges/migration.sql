-- Provider-initiated online payment charges (Paystack seam).
-- RLS is applied by prisma/rls.sql (tenant_id column → automatic policy).

CREATE TABLE IF NOT EXISTS "provider_payment_charges" (
  "id"                UUID          NOT NULL DEFAULT gen_random_uuid(),
  "tenant_id"         UUID          NOT NULL,
  "invoice_id"        UUID          NOT NULL,
  "provider"          VARCHAR(20)   NOT NULL,
  "reference"         VARCHAR(100)  NOT NULL,
  "access_code"       VARCHAR(100),
  "authorization_url" VARCHAR(500),
  "amount_minor"      INTEGER       NOT NULL,
  "currency"          VARCHAR(3)    NOT NULL,
  "email"             VARCHAR(255),
  "status"            VARCHAR(20)   NOT NULL DEFAULT 'PENDING',
  "invoice_payment_id" UUID,
  "failure_reason"    TEXT,
  "created_by"        UUID,
  "created_at"        TIMESTAMPTZ   NOT NULL DEFAULT now(),
  "updated_at"        TIMESTAMPTZ   NOT NULL DEFAULT now(),
  CONSTRAINT "provider_payment_charges_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "provider_payment_charges_tenant_id_fkey"
    FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "provider_payment_charges_invoice_id_fkey"
    FOREIGN KEY ("invoice_id") REFERENCES "invoices"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "provider_payment_charges_provider_reference_key"
    UNIQUE ("provider", "reference")
);

CREATE INDEX IF NOT EXISTS "provider_payment_charges_tenant_id_invoice_id_idx"
  ON "provider_payment_charges"("tenant_id", "invoice_id");
CREATE INDEX IF NOT EXISTS "provider_payment_charges_tenant_id_status_idx"
  ON "provider_payment_charges"("tenant_id", "status");

-- Narrow SECURITY DEFINER lookup so the unauthenticated provider webhook can
-- resolve tenant context from (provider, reference) before entering
-- withTenantTx. Returns only the fields the webhook needs — no PII.
DROP FUNCTION IF EXISTS lookup_provider_payment_charge(TEXT, TEXT);
CREATE OR REPLACE FUNCTION lookup_provider_payment_charge(p_provider TEXT, p_reference TEXT)
RETURNS TABLE (
  id UUID,
  tenant_id UUID,
  invoice_id UUID,
  amount_minor INTEGER,
  currency VARCHAR,
  status VARCHAR,
  invoice_payment_id UUID
)
SECURITY DEFINER
SET search_path = public
LANGUAGE sql AS $$
  SELECT id, tenant_id, invoice_id, amount_minor, currency, status, invoice_payment_id
  FROM public.provider_payment_charges
  WHERE provider = p_provider AND reference = p_reference
  LIMIT 1;
$$;

REVOKE ALL ON FUNCTION lookup_provider_payment_charge(TEXT, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION lookup_provider_payment_charge(TEXT, TEXT) TO db_app;
