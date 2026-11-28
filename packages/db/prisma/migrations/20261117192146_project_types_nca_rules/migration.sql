-- Phase 2.8: project taxonomy (project_type / project_subtype, nullable —
-- legacy projects stay untyped) + editable NCA class-rule table.
-- Rollback: ALTER TABLE "projects" DROP COLUMN "project_subtype", DROP COLUMN "project_type";
--           DROP TABLE "nca_class_rules";

-- AlterTable
ALTER TABLE "projects" ADD COLUMN "project_type" VARCHAR(30),
ADD COLUMN "project_subtype" VARCHAR(60);

-- CreateTable
CREATE TABLE "nca_class_rules" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "trade" VARCHAR(60) NOT NULL,
    "class_label" VARCHAR(10) NOT NULL,
    "min_contract_value" DECIMAL(15,2),
    "max_contract_value" DECIMAL(15,2),
    "notes" VARCHAR(255),
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "nca_class_rules_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "nca_class_rules_tenant_id_trade_idx" ON "nca_class_rules"("tenant_id", "trade");

-- CreateIndex
CREATE UNIQUE INDEX "nca_class_rules_tenant_id_trade_class_label_key" ON "nca_class_rules"("tenant_id", "trade", "class_label");

-- Seed default NCA bands for every existing tenant. These are STARTING bands
-- only — NCA publishes revised limits, so tenants edit them via
-- PATCH /api/v1/project-types/nca-rules/:id. Bands: class 1 lowest … class 8
-- highest; max is exclusive, NULL = no ceiling.
INSERT INTO "nca_class_rules" ("id", "tenant_id", "trade", "class_label", "min_contract_value", "max_contract_value", "notes", "updated_at")
SELECT gen_random_uuid(), t."id", trade."trade", trade."class_label", trade."min_val", trade."max_val",
       'Default band — confirm current NCA limits before registration', CURRENT_TIMESTAMP
FROM "tenants" t
CROSS JOIN (VALUES
  ('Building',            'NCA-1', 0::numeric,        5000000::numeric),
  ('Building',            'NCA-2', 5000000::numeric,  20000000::numeric),
  ('Building',            'NCA-3', 20000000::numeric, 50000000::numeric),
  ('Building',            'NCA-4', 50000000::numeric, 150000000::numeric),
  ('Building',            'NCA-5', 150000000::numeric, 300000000::numeric),
  ('Building',            'NCA-6', 300000000::numeric, 750000000::numeric),
  ('Building',            'NCA-7', 750000000::numeric, NULL::numeric),
  ('Building',            'NCA-8', NULL::numeric,     NULL::numeric),
  ('Roads and earthworks', 'NCA-1', 0::numeric,        5000000::numeric),
  ('Roads and earthworks', 'NCA-2', 5000000::numeric,  20000000::numeric),
  ('Roads and earthworks', 'NCA-3', 20000000::numeric, 50000000::numeric),
  ('Roads and earthworks', 'NCA-4', 50000000::numeric, 150000000::numeric),
  ('Roads and earthworks', 'NCA-5', 150000000::numeric, 300000000::numeric),
  ('Roads and earthworks', 'NCA-6', 300000000::numeric, 750000000::numeric),
  ('Roads and earthworks', 'NCA-7', 750000000::numeric, NULL::numeric),
  ('Roads and earthworks', 'NCA-8', NULL::numeric,     NULL::numeric),
  ('Water',               'NCA-1', 0::numeric,        5000000::numeric),
  ('Water',               'NCA-2', 5000000::numeric,  20000000::numeric),
  ('Water',               'NCA-3', 20000000::numeric, 50000000::numeric),
  ('Water',               'NCA-4', 50000000::numeric, 150000000::numeric),
  ('Water',               'NCA-5', 150000000::numeric, 300000000::numeric),
  ('Water',               'NCA-6', 300000000::numeric, 750000000::numeric),
  ('Water',               'NCA-7', 750000000::numeric, NULL::numeric),
  ('Water',               'NCA-8', NULL::numeric,     NULL::numeric),
  ('Electrical',          'NCA-1', 0::numeric,        5000000::numeric),
  ('Electrical',          'NCA-2', 5000000::numeric,  20000000::numeric),
  ('Electrical',          'NCA-3', 20000000::numeric, 50000000::numeric),
  ('Electrical',          'NCA-4', 50000000::numeric, 150000000::numeric),
  ('Electrical',          'NCA-5', 150000000::numeric, 300000000::numeric),
  ('Electrical',          'NCA-6', 300000000::numeric, 750000000::numeric),
  ('Electrical',          'NCA-7', 750000000::numeric, NULL::numeric),
  ('Electrical',          'NCA-8', NULL::numeric,     NULL::numeric),
  ('Mechanical',          'NCA-1', 0::numeric,        5000000::numeric),
  ('Mechanical',          'NCA-2', 5000000::numeric,  20000000::numeric),
  ('Mechanical',          'NCA-3', 20000000::numeric, 50000000::numeric),
  ('Mechanical',          'NCA-4', 50000000::numeric, 150000000::numeric),
  ('Mechanical',          'NCA-5', 150000000::numeric, 300000000::numeric),
  ('Mechanical',          'NCA-6', 300000000::numeric, 750000000::numeric),
  ('Mechanical',          'NCA-7', 750000000::numeric, NULL::numeric),
  ('Mechanical',          'NCA-8', NULL::numeric,     NULL::numeric)
) AS trade("trade", "class_label", "min_val", "max_val")
ON CONFLICT ("tenant_id", "trade", "class_label") DO NOTHING;
