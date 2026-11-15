-- Stage 6: retention write-off fields on projects (closeout CLOSED gate).
ALTER TABLE "projects"
  ADD COLUMN "retention_write_off_amount" DECIMAL(15,2),
  ADD COLUMN "retention_write_off_reason" VARCHAR(500),
  ADD COLUMN "retention_write_off_by" UUID,
  ADD COLUMN "retention_write_off_at" TIMESTAMPTZ;
