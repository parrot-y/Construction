-- Supplier portal: delivery confirmation + invoice reference on material deliveries
ALTER TABLE "material_deliveries"
  ADD COLUMN "delivery_status" VARCHAR(20) NOT NULL DEFAULT 'RECORDED',
  ADD COLUMN "confirmed_at" TIMESTAMPTZ,
  ADD COLUMN "confirmed_by_name" VARCHAR(255),
  ADD COLUMN "supplier_invoice_ref" VARCHAR(100);
