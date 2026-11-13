-- Stage 2 + Stage 3 schema: tenant terms, suppliers, purchase orders,
-- supplier-bound deliveries/portal links, valuation resubmission, client
-- payment notices. (Generated via prisma migrate diff; the unrelated
-- password_reset_tokens.id default drift was intentionally excluded.)

-- AlterTable
ALTER TABLE "material_deliveries" ADD COLUMN     "purchase_order_id" UUID,
ADD COLUMN     "purchase_order_item_id" UUID,
ADD COLUMN     "supplier_id" UUID;

-- AlterTable
ALTER TABLE "portal_access_links" ADD COLUMN     "supplier_id" UUID;

-- AlterTable
ALTER TABLE "subcontractor_valuations" ADD COLUMN     "replaces_valuation_id" UUID;

-- AlterTable
ALTER TABLE "tenants" ADD COLUMN     "payment_instructions" JSONB,
ADD COLUMN     "retention_terms" JSONB;

-- CreateTable
CREATE TABLE "suppliers" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "name" VARCHAR(255) NOT NULL,
    "contact_person" VARCHAR(255),
    "phone" VARCHAR(50),
    "email" VARCHAR(255),
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "suppliers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "purchase_orders" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "project_id" UUID NOT NULL,
    "po_number" VARCHAR(50) NOT NULL,
    "supplier_id" UUID NOT NULL,
    "status" VARCHAR(30) NOT NULL DEFAULT 'DRAFT',
    "order_date" DATE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expected_delivery_date" DATE,
    "notes" TEXT,
    "total_amount_kes" DECIMAL(15,2) NOT NULL DEFAULT 0,
    "commitment_id" UUID,
    "issued_at" TIMESTAMPTZ,
    "created_by_id" UUID,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "purchase_orders_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "purchase_order_items" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "purchase_order_id" UUID NOT NULL,
    "description" VARCHAR(500) NOT NULL,
    "unit" VARCHAR(20) NOT NULL,
    "quantity" DECIMAL(14,4) NOT NULL,
    "rate" DECIMAL(15,2) NOT NULL,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "purchase_order_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "purchase_order_invoices" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "purchase_order_id" UUID NOT NULL,
    "reference" VARCHAR(100) NOT NULL,
    "amount" DECIMAL(15,2) NOT NULL,
    "status" VARCHAR(30) NOT NULL DEFAULT 'SUBMITTED',
    "note" TEXT,
    "submitted_by_name" VARCHAR(255),
    "reviewed_by_id" UUID,
    "reviewed_at" TIMESTAMPTZ,
    "review_reason" TEXT,
    "cost_entry_id" UUID,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "purchase_order_invoices_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "client_payment_notices" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "invoice_id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "amount" DECIMAL(15,2) NOT NULL,
    "method" VARCHAR(30) NOT NULL,
    "reference" VARCHAR(100),
    "note" TEXT,
    "status" VARCHAR(20) NOT NULL DEFAULT 'PENDING',
    "confirmed_at" TIMESTAMPTZ,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "client_payment_notices_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "suppliers_tenant_id_idx" ON "suppliers"("tenant_id");

-- CreateIndex
CREATE INDEX "purchase_orders_tenant_id_project_id_status_idx" ON "purchase_orders"("tenant_id", "project_id", "status");

-- CreateIndex
CREATE UNIQUE INDEX "purchase_orders_project_id_po_number_key" ON "purchase_orders"("project_id", "po_number");

-- CreateIndex
CREATE INDEX "purchase_order_items_tenant_id_purchase_order_id_idx" ON "purchase_order_items"("tenant_id", "purchase_order_id");

-- CreateIndex
CREATE INDEX "purchase_order_invoices_tenant_id_purchase_order_id_status_idx" ON "purchase_order_invoices"("tenant_id", "purchase_order_id", "status");

-- CreateIndex
CREATE INDEX "client_payment_notices_tenant_id_invoice_id_idx" ON "client_payment_notices"("tenant_id", "invoice_id");

-- CreateIndex
CREATE INDEX "material_deliveries_tenant_id_supplier_id_idx" ON "material_deliveries"("tenant_id", "supplier_id");

-- AddForeignKey
ALTER TABLE "material_deliveries" ADD CONSTRAINT "material_deliveries_supplier_id_fkey" FOREIGN KEY ("supplier_id") REFERENCES "suppliers"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "material_deliveries" ADD CONSTRAINT "material_deliveries_purchase_order_id_fkey" FOREIGN KEY ("purchase_order_id") REFERENCES "purchase_orders"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "material_deliveries" ADD CONSTRAINT "material_deliveries_purchase_order_item_id_fkey" FOREIGN KEY ("purchase_order_item_id") REFERENCES "purchase_order_items"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "portal_access_links" ADD CONSTRAINT "portal_access_links_supplier_id_fkey" FOREIGN KEY ("supplier_id") REFERENCES "suppliers"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "subcontractor_valuations" ADD CONSTRAINT "subcontractor_valuations_replaces_valuation_id_fkey" FOREIGN KEY ("replaces_valuation_id") REFERENCES "subcontractor_valuations"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "purchase_orders" ADD CONSTRAINT "purchase_orders_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "purchase_orders" ADD CONSTRAINT "purchase_orders_supplier_id_fkey" FOREIGN KEY ("supplier_id") REFERENCES "suppliers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "purchase_order_items" ADD CONSTRAINT "purchase_order_items_purchase_order_id_fkey" FOREIGN KEY ("purchase_order_id") REFERENCES "purchase_orders"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "purchase_order_invoices" ADD CONSTRAINT "purchase_order_invoices_purchase_order_id_fkey" FOREIGN KEY ("purchase_order_id") REFERENCES "purchase_orders"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "client_payment_notices" ADD CONSTRAINT "client_payment_notices_invoice_id_fkey" FOREIGN KEY ("invoice_id") REFERENCES "invoices"("id") ON DELETE CASCADE ON UPDATE CASCADE;
