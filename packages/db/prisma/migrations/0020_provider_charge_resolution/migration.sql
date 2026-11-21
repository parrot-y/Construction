-- NEEDS_REVIEW resolution fields for provider payment charges (G1).
ALTER TABLE "provider_payment_charges"
  ADD COLUMN IF NOT EXISTS "resolution" VARCHAR(20),
  ADD COLUMN IF NOT EXISTS "resolved_at" TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS "resolved_by" UUID,
  ADD COLUMN IF NOT EXISTS "resolution_note" TEXT,
  ADD COLUMN IF NOT EXISTS "resolution_reference" VARCHAR(100),
  ADD COLUMN IF NOT EXISTS "resolved_invoice_id" UUID;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'provider_payment_charges_resolved_invoice_id_fkey'
  ) THEN
    ALTER TABLE "provider_payment_charges"
      ADD CONSTRAINT "provider_payment_charges_resolved_invoice_id_fkey"
      FOREIGN KEY ("resolved_invoice_id") REFERENCES "invoices"("id")
      ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS "provider_payment_charges_review_idx"
  ON "provider_payment_charges"("tenant_id", "status", "resolved_at");
