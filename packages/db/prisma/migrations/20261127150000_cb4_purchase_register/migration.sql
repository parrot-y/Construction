-- CB4 purchase register: store/site columns on POs and material deliveries
-- (GRNs) so the register can show supplier + store + value per row.

ALTER TABLE "purchase_orders" ADD COLUMN "store_location" VARCHAR(255);
ALTER TABLE "material_deliveries" ADD COLUMN "store_location" VARCHAR(255);
