-- Portal hardening: subcontractor package scoping, link usage tracking,
-- external RFI responder identity, supplier dispute reason.
ALTER TABLE "portal_access_links"
  ADD COLUMN IF NOT EXISTS "subcontractor_package_id" UUID,
  ADD COLUMN IF NOT EXISTS "last_used_at" TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS "use_count" INTEGER NOT NULL DEFAULT 0;

ALTER TABLE "rfi_responses"
  ALTER COLUMN "responder_id" DROP NOT NULL,
  ADD COLUMN IF NOT EXISTS "external_responder_name" VARCHAR(255),
  ADD COLUMN IF NOT EXISTS "external_link_id" UUID;

ALTER TABLE "rfi_responses" DROP CONSTRAINT IF EXISTS "rfi_responses_responder_id_fkey";
ALTER TABLE "rfi_responses" ADD CONSTRAINT "rfi_responses_responder_id_fkey"
  FOREIGN KEY ("responder_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "material_deliveries"
  ADD COLUMN IF NOT EXISTS "dispute_reason" VARCHAR(500);
