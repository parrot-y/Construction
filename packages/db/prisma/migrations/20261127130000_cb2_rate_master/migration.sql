-- CB2 rate master: shared per-tenant rate library keyed by geography +
-- item/material typing, with bulk upload/edit and lookup prefill.

-- CreateTable
CREATE TABLE "rate_master_entries" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "country" VARCHAR(100) NOT NULL DEFAULT 'Kenya',
    "state_region" VARCHAR(100),
    "city" VARCHAR(100),
    "item_type" VARCHAR(20) NOT NULL DEFAULT 'MATERIAL',
    "material_type" VARCHAR(100),
    "material_subtype" VARCHAR(100),
    "description" VARCHAR(500) NOT NULL,
    "unit" VARCHAR(20) NOT NULL,
    "unit_rate_kes" DECIMAL(15,4) NOT NULL,
    "effective_from" DATE,
    "effective_to" DATE,
    "source" VARCHAR(20) NOT NULL DEFAULT 'MANUAL',
    "notes" TEXT,
    "created_by" VARCHAR(255),
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "rate_master_entries_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "rate_master_entries_tenant_id_item_type_idx" ON "rate_master_entries"("tenant_id", "item_type");

-- CreateIndex
CREATE INDEX "rate_master_entries_tenant_id_material_type_material_subtype_idx" ON "rate_master_entries"("tenant_id", "material_type", "material_subtype");

-- CreateIndex
CREATE INDEX "rate_master_entries_tenant_id_country_state_region_city_idx" ON "rate_master_entries"("tenant_id", "country", "state_region", "city");
