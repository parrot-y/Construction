ALTER TABLE "subcontractor_valuations" ADD COLUMN "reviewed_by_id" UUID;
ALTER TABLE "subcontractor_valuations" ADD COLUMN "reviewed_at" TIMESTAMPTZ;
