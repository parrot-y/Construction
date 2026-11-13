-- Maker-checker self-approval audit columns (Stage 5 follow-up):
-- admins may approve their own cost/certificate/invoice only with a recorded reason.
ALTER TABLE "cost_entries"
  ADD COLUMN "self_approved" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "self_approval_reason" VARCHAR(500);

ALTER TABLE "invoices"
  ADD COLUMN "self_approved" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "self_approval_reason" VARCHAR(500);

ALTER TABLE "payment_certificates"
  ADD COLUMN "self_approved" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "self_approval_reason" VARCHAR(500);
