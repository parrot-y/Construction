-- Stage 6: client acknowledgement of practical completion (portal).
CREATE TABLE "practical_completion_acknowledgements" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tenant_id" UUID NOT NULL,
    "project_id" UUID NOT NULL,
    "defects_liability_certificate_id" UUID,
    "acknowledged_by_name" VARCHAR(255) NOT NULL,
    "portal_link_id" UUID NOT NULL,
    "acknowledged_at" TIMESTAMPTZ NOT NULL DEFAULT now(),

    CONSTRAINT "practical_completion_acknowledgements_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "practical_completion_acknowledgements_project_id_key" ON "practical_completion_acknowledgements"("project_id");
CREATE INDEX "practical_completion_acknowledgements_tenant_id_project_id_idx" ON "practical_completion_acknowledgements"("tenant_id", "project_id");

ALTER TABLE "practical_completion_acknowledgements" ADD CONSTRAINT "practical_completion_acknowledgements_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;
