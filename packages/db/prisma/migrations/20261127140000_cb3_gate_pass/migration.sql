-- CB3 gate pass: material-exit authorization register (Assistant QS parity).
-- pass_number allocated from document_counters scope 'GATE_PASS' by the API.

-- CreateTable
CREATE TABLE "gate_passes" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "pass_number" VARCHAR(50) NOT NULL,
    "project_id" UUID,
    "store_location" VARCHAR(255),
    "issued_to_name" VARCHAR(255) NOT NULL,
    "issued_to_phone" VARCHAR(50),
    "destination" VARCHAR(255),
    "vehicle_registration" VARCHAR(50),
    "purpose" VARCHAR(255),
    "items" JSONB NOT NULL,
    "status" VARCHAR(20) NOT NULL DEFAULT 'PENDING',
    "authorized_by" VARCHAR(255),
    "authorized_at" TIMESTAMPTZ,
    "exited_at" TIMESTAMPTZ,
    "exit_confirmed_by" VARCHAR(255),
    "cancel_reason" TEXT,
    "notes" TEXT,
    "created_by" VARCHAR(255) NOT NULL,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "gate_passes_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "gate_passes_tenant_id_pass_number_key" ON "gate_passes"("tenant_id", "pass_number");

-- CreateIndex
CREATE INDEX "gate_passes_tenant_id_status_idx" ON "gate_passes"("tenant_id", "status");

-- CreateIndex
CREATE INDEX "gate_passes_tenant_id_project_id_idx" ON "gate_passes"("tenant_id", "project_id");

-- AddForeignKey
ALTER TABLE "gate_passes" ADD CONSTRAINT "gate_passes_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE SET NULL ON UPDATE CASCADE;
