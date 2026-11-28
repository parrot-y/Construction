-- Stage 4: consultant link scopes, drawing acknowledgements + issued dates,
-- project permits register, compliance visits/actions, phone+PIN field auth.

-- AlterTable
ALTER TABLE "users" ADD COLUMN     "pin_hash" VARCHAR(255),
ADD COLUMN     "pin_failed_attempts" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "pin_locked_until" TIMESTAMPTZ;

-- AlterTable
ALTER TABLE "invitations" ADD COLUMN     "pin_hash" VARCHAR(255);

-- AlterTable
ALTER TABLE "portal_access_links" ADD COLUMN     "scope" VARCHAR(30);

-- AlterTable
ALTER TABLE "project_documents" ADD COLUMN     "issued_date" DATE;

-- CreateTable
CREATE TABLE "drawing_acknowledgements" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "project_id" UUID NOT NULL,
    "document_id" UUID NOT NULL,
    "portal_link_id" UUID NOT NULL,
    "stakeholder_name" VARCHAR(255) NOT NULL,
    "acknowledged_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "drawing_acknowledgements_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "project_permits" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "project_id" UUID NOT NULL,
    "permit_type" VARCHAR(40) NOT NULL,
    "permit_number" VARCHAR(100) NOT NULL,
    "issuer" VARCHAR(255) NOT NULL,
    "issued_date" DATE,
    "expiry_date" DATE,
    "notes" TEXT,
    "created_by_id" UUID,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "project_permits_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "compliance_visits" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "project_id" UUID NOT NULL,
    "portal_link_id" UUID NOT NULL,
    "visit_date" DATE NOT NULL,
    "outcome" VARCHAR(40) NOT NULL,
    "notes" TEXT,
    "recorded_by_name" VARCHAR(255) NOT NULL,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "compliance_visits_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "compliance_actions" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "visit_id" UUID NOT NULL,
    "description" TEXT NOT NULL,
    "due_date" DATE,
    "status" VARCHAR(20) NOT NULL DEFAULT 'OPEN',
    "completed_at" TIMESTAMPTZ,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "compliance_actions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "drawing_acknowledgements_document_id_portal_link_id_key" ON "drawing_acknowledgements"("document_id", "portal_link_id");

-- CreateIndex
CREATE INDEX "drawing_acknowledgements_tenant_id_project_id_idx" ON "drawing_acknowledgements"("tenant_id", "project_id");

-- CreateIndex
CREATE INDEX "project_permits_tenant_id_project_id_idx" ON "project_permits"("tenant_id", "project_id");

-- CreateIndex
CREATE INDEX "compliance_visits_tenant_id_project_id_idx" ON "compliance_visits"("tenant_id", "project_id");

-- CreateIndex
CREATE INDEX "compliance_actions_tenant_id_visit_id_idx" ON "compliance_actions"("tenant_id", "visit_id");

-- AddForeignKey
ALTER TABLE "drawing_acknowledgements" ADD CONSTRAINT "drawing_acknowledgements_document_id_fkey" FOREIGN KEY ("document_id") REFERENCES "project_documents"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "drawing_acknowledgements" ADD CONSTRAINT "drawing_acknowledgements_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "project_permits" ADD CONSTRAINT "project_permits_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "compliance_visits" ADD CONSTRAINT "compliance_visits_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "compliance_actions" ADD CONSTRAINT "compliance_actions_visit_id_fkey" FOREIGN KEY ("visit_id") REFERENCES "compliance_visits"("id") ON DELETE CASCADE ON UPDATE CASCADE;
