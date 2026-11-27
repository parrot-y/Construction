-- CB5 contractor master: tenant-level register of subcontractor firms
-- (KRA PIN, work categories, approval status) and an optional link from
-- project work packages to the approved firm.

-- CreateTable
CREATE TABLE "contractor_firms" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "firm_name" VARCHAR(255) NOT NULL,
    "kra_pin" VARCHAR(20),
    "contact_person" VARCHAR(255),
    "phone" VARCHAR(50),
    "email" VARCHAR(255),
    "work_categories" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "approval_status" VARCHAR(20) NOT NULL DEFAULT 'PENDING',
    "approved_by" VARCHAR(255),
    "approved_at" TIMESTAMPTZ,
    "status_reason" TEXT,
    "notes" TEXT,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_by" VARCHAR(255),
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "contractor_firms_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "contractor_firms_tenant_id_kra_pin_key" ON "contractor_firms"("tenant_id", "kra_pin");

-- CreateIndex
CREATE INDEX "contractor_firms_tenant_id_approval_status_idx" ON "contractor_firms"("tenant_id", "approval_status");

-- AlterTable
ALTER TABLE "subcontractor_packages" ADD COLUMN "contractor_id" UUID;

-- CreateIndex
CREATE INDEX "subcontractor_packages_contractor_id_idx" ON "subcontractor_packages"("contractor_id");

-- AddForeignKey
ALTER TABLE "subcontractor_packages" ADD CONSTRAINT "subcontractor_packages_contractor_id_fkey" FOREIGN KEY ("contractor_id") REFERENCES "contractor_firms"("id") ON DELETE SET NULL ON UPDATE CASCADE;
