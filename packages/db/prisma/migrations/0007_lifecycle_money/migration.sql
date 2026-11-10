-- AlterTable
ALTER TABLE "cost_entries" ADD COLUMN     "commitment_id" UUID;

-- AlterTable
ALTER TABLE "invoices" ADD COLUMN     "certificate_id" UUID,
ADD COLUMN     "wht_amount" DECIMAL(15,2) NOT NULL DEFAULT 0,
ADD COLUMN     "wht_pct" DECIMAL(5,2) NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "payment_certificates" ADD COLUMN     "invoice_id" UUID,
ADD COLUMN     "vat_amount" DECIMAL(15,2) NOT NULL DEFAULT 0,
ADD COLUMN     "vat_pct" DECIMAL(5,2) NOT NULL DEFAULT 0,
ADD COLUMN     "wht_amount" DECIMAL(15,2) NOT NULL DEFAULT 0,
ADD COLUMN     "wht_pct" DECIMAL(5,2) NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "subcontractor_valuations" ADD COLUMN     "approved_at" TIMESTAMPTZ,
ADD COLUMN     "approved_by_id" UUID,
ADD COLUMN     "cost_entry_id" UUID,
ADD COLUMN     "prepared_by_id" UUID,
ADD COLUMN     "rejected_at" TIMESTAMPTZ,
ADD COLUMN     "rejected_by_id" UUID,
ADD COLUMN     "rejection_reason" TEXT,
ADD COLUMN     "submitted_at" TIMESTAMPTZ;

-- CreateTable
CREATE TABLE "payment_certificate_lines" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "certificate_id" UUID NOT NULL,
    "boq_item_id" UUID,
    "description" TEXT NOT NULL,
    "unit" VARCHAR(20),
    "progress_pct" DECIMAL(7,4),
    "unit_rate" DECIMAL(15,4),
    "amount" DECIMAL(15,2) NOT NULL,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "payment_certificate_lines_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tenant_tax_settings" (
    "tenant_id" UUID NOT NULL,
    "vat_pct" DECIMAL(5,2) NOT NULL DEFAULT 16.00,
    "wht_subcontractor_pct" DECIMAL(5,2) NOT NULL DEFAULT 3.00,
    "wht_consultant_pct" DECIMAL(5,2) NOT NULL DEFAULT 3.00,
    "wht_supplier_pct" DECIMAL(5,2) NOT NULL DEFAULT 0.00,
    "updated_by" UUID,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "tenant_tax_settings_pkey" PRIMARY KEY ("tenant_id")
);

-- CreateIndex
CREATE INDEX "payment_certificate_lines_tenant_id_certificate_id_idx" ON "payment_certificate_lines"("tenant_id", "certificate_id");

-- CreateIndex
CREATE INDEX "cost_entries_tenant_id_commitment_id_idx" ON "cost_entries"("tenant_id", "commitment_id");

-- CreateIndex
CREATE INDEX "invoices_tenant_id_certificate_id_idx" ON "invoices"("tenant_id", "certificate_id");

-- AddForeignKey
ALTER TABLE "cost_entries" ADD CONSTRAINT "cost_entries_commitment_id_fkey" FOREIGN KEY ("commitment_id") REFERENCES "commitments"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_certificate_id_fkey" FOREIGN KEY ("certificate_id") REFERENCES "payment_certificates"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payment_certificate_lines" ADD CONSTRAINT "payment_certificate_lines_certificate_id_fkey" FOREIGN KEY ("certificate_id") REFERENCES "payment_certificates"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tenant_tax_settings" ADD CONSTRAINT "tenant_tax_settings_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
