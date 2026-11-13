-- Account lifecycle hardening:
--  * single-use email-verification token columns on users (hash-only storage)
--  * password_reset_tokens table for self-serve + admin-assisted resets
--  * grandfather existing accounts into the verified state (they predate
--    the verification gate; new accounts must verify or be admin-activated)

ALTER TABLE "users"
  ADD COLUMN "email_verify_token_hash" VARCHAR(64),
  ADD COLUMN "email_verify_token_expires_at" TIMESTAMPTZ,
  ADD COLUMN "email_verify_token_used_at" TIMESTAMPTZ;

UPDATE "users"
SET "email_verified_at" = COALESCE("email_verified_at", "created_at")
WHERE "email_verified_at" IS NULL;

CREATE TABLE "password_reset_tokens" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tenant_id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "token_hash" VARCHAR(64) NOT NULL,
    "expires_at" TIMESTAMPTZ NOT NULL,
    "used_at" TIMESTAMPTZ,
    "created_by" UUID,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT now(),

    CONSTRAINT "password_reset_tokens_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "password_reset_tokens_token_hash_key" ON "password_reset_tokens"("token_hash");
CREATE INDEX "password_reset_tokens_tenant_id_user_id_idx" ON "password_reset_tokens"("tenant_id", "user_id");
