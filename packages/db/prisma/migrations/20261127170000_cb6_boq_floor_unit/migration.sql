-- CB6 BOQ floor/unit mapping: takeoff dimensions on BOQ items so
-- quantities can be tracked per storey / apartment / unit.

ALTER TABLE "boq_items" ADD COLUMN "floor" VARCHAR(100);
ALTER TABLE "boq_items" ADD COLUMN "unit_ref" VARCHAR(100);

CREATE INDEX "boq_items_tenant_id_floor_idx" ON "boq_items"("tenant_id", "floor");
CREATE INDEX "boq_items_tenant_id_unit_ref_idx" ON "boq_items"("tenant_id", "unit_ref");
