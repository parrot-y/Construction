-- Stage 3: optional PO-line allocation on supplier invoices for three-way match.
ALTER TABLE "purchase_order_invoices" ADD COLUMN "purchase_order_item_id" UUID;
ALTER TABLE "purchase_order_invoices" ADD CONSTRAINT "purchase_order_invoices_purchase_order_item_id_fkey"
  FOREIGN KEY ("purchase_order_item_id") REFERENCES "purchase_order_items"("id") ON DELETE SET NULL ON UPDATE CASCADE;
