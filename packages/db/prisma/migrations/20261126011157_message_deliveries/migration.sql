-- DropIndex
DROP INDEX "provider_payment_charges_review_idx";

-- DropIndex
DROP INDEX "tenant_module_flags_tenant_id_idx";

-- AlterTable
ALTER TABLE "login_throttles" ALTER COLUMN "id" DROP DEFAULT;

-- AlterTable
ALTER TABLE "nca_class_rules" ALTER COLUMN "updated_at" DROP DEFAULT;

-- AlterTable
ALTER TABLE "password_reset_tokens" ALTER COLUMN "id" DROP DEFAULT;

-- AlterTable
ALTER TABLE "practical_completion_acknowledgements" ALTER COLUMN "id" DROP DEFAULT;

-- AlterTable
ALTER TABLE "provider_payment_charges" ALTER COLUMN "id" DROP DEFAULT,
ALTER COLUMN "updated_at" DROP DEFAULT;

-- AlterTable
ALTER TABLE "tenant_module_flags" ALTER COLUMN "id" DROP DEFAULT;

-- CreateTable
CREATE TABLE "message_deliveries" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "channel" VARCHAR(20) NOT NULL,
    "provider" VARCHAR(60) NOT NULL,
    "recipient_masked" VARCHAR(120) NOT NULL,
    "subject" VARCHAR(255),
    "body_excerpt" VARCHAR(500),
    "status" VARCHAR(20) NOT NULL,
    "provider_reference" VARCHAR(120),
    "error_message" VARCHAR(500),
    "source" VARCHAR(60) NOT NULL,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "sent_at" TIMESTAMPTZ,

    CONSTRAINT "message_deliveries_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "message_deliveries_tenant_id_created_at_idx" ON "message_deliveries"("tenant_id", "created_at");

-- CreateIndex
CREATE INDEX "message_deliveries_tenant_id_channel_status_idx" ON "message_deliveries"("tenant_id", "channel", "status");
