-- CB1 indent depth: site targeting fields on material_requisitions,
-- delivery schedule batches, and requisition links on POs + issues.
-- NOTE: hand-reviewed — spurious DROP DEFAULT drift statements emitted by
-- migrate diff were removed (see tasks/lessons.md).

-- AlterTable
ALTER TABLE "inventory_movements" ADD COLUMN "requisition_id" UUID;

-- AlterTable
ALTER TABLE "material_requisitions"
  ADD COLUMN "expected_delivery_date" DATE,
  ADD COLUMN "floor_ref" VARCHAR(100),
  ADD COLUMN "indent_category" VARCHAR(100),
  ADD COLUMN "indent_kind" VARCHAR(20) NOT NULL DEFAULT 'MATERIAL',
  ADD COLUMN "lead_time_days" INTEGER,
  ADD COLUMN "material_subtype" VARCHAR(100),
  ADD COLUMN "material_type" VARCHAR(100),
  ADD COLUMN "notes" TEXT,
  ADD COLUMN "store_location" VARCHAR(255),
  ADD COLUMN "unit_ref" VARCHAR(100),
  ADD COLUMN "work_order_ref" VARCHAR(100);

-- AlterTable
ALTER TABLE "purchase_orders" ADD COLUMN "requisition_id" UUID;

-- CreateTable
CREATE TABLE "indent_delivery_batches" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "requisition_id" UUID NOT NULL,
    "batch_date" DATE NOT NULL,
    "quantity" DECIMAL(12,2) NOT NULL,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "indent_delivery_batches_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "indent_delivery_batches_tenant_id_requisition_id_idx" ON "indent_delivery_batches"("tenant_id", "requisition_id");

-- CreateIndex
CREATE INDEX "material_requisitions_tenant_id_indent_kind_idx" ON "material_requisitions"("tenant_id", "indent_kind");

-- AddForeignKey
ALTER TABLE "inventory_movements" ADD CONSTRAINT "inventory_movements_requisition_id_fkey" FOREIGN KEY ("requisition_id") REFERENCES "material_requisitions"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "indent_delivery_batches" ADD CONSTRAINT "indent_delivery_batches_requisition_id_fkey" FOREIGN KEY ("requisition_id") REFERENCES "material_requisitions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "purchase_orders" ADD CONSTRAINT "purchase_orders_requisition_id_fkey" FOREIGN KEY ("requisition_id") REFERENCES "material_requisitions"("id") ON DELETE SET NULL ON UPDATE CASCADE;
