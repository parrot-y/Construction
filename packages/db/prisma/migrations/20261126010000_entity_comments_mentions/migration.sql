-- P5.6: polymorphic entity comments + direct-message inbox delivery
ALTER TABLE "inbox_messages" ADD COLUMN "recipient_id" UUID;
CREATE INDEX "inbox_messages_tenant_id_recipient_id_idx" ON "inbox_messages"("tenant_id", "recipient_id");

CREATE TABLE "entity_comments" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "entity_type" VARCHAR(40) NOT NULL,
    "entity_id" UUID NOT NULL,
    "project_id" UUID,
    "author_id" UUID NOT NULL,
    "author_name" VARCHAR(255) NOT NULL,
    "body" TEXT NOT NULL,
    "mentions" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT now(),

    CONSTRAINT "entity_comments_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "entity_comments_tenant_id_entity_type_entity_id_created_at_idx" ON "entity_comments"("tenant_id", "entity_type", "entity_id", "created_at");
