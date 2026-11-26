-- AlterTable
ALTER TABLE "meetings" ALTER COLUMN "updated_at" DROP DEFAULT;

-- CreateTable
CREATE TABLE "export_jobs" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "project_id" UUID,
    "report_kind" VARCHAR(30) NOT NULL,
    "status" VARCHAR(15) NOT NULL DEFAULT 'QUEUED',
    "filename" VARCHAR(255),
    "storage_key" VARCHAR(500),
    "size_bytes" INTEGER,
    "requested_by_id" UUID,
    "error" VARCHAR(500),
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "finished_at" TIMESTAMPTZ,

    CONSTRAINT "export_jobs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "export_jobs_tenant_id_status_created_at_idx" ON "export_jobs"("tenant_id", "status", "created_at");
