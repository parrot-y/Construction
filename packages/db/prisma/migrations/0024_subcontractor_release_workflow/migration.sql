-- H2: subcontractor retention release maker-checker workflow
-- Tracks who requested, recommended and approved each release so the
-- QS-recommend / director-approve separation of duties is enforceable.

ALTER TABLE "subcontractor_retention_releases"
  ADD COLUMN IF NOT EXISTS "requested_by_user_id" UUID,
  ADD COLUMN IF NOT EXISTS "recommended_by_user_id" UUID,
  ADD COLUMN IF NOT EXISTS "approved_by_user_id" UUID,
  ADD COLUMN IF NOT EXISTS "approval_override_reason" TEXT;
