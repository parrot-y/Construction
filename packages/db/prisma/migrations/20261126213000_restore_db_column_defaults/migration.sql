-- Restore DB-level column defaults dropped as schema drift by
-- 20261126011157_message_deliveries and 20261126165954_export_jobs.
-- Hand-written migrations created these with gen_random_uuid()/now()
-- defaults; Prisma's @default(uuid())/@updatedAt generate values
-- client-side, so `migrate dev` saw the DB defaults as drift and dropped
-- them. Raw SQL paths (login_throttles insert in auth.ts, token lookups)
-- rely on the DB defaults — without them inserts fail 23502.
ALTER TABLE "login_throttles" ALTER COLUMN "id" SET DEFAULT gen_random_uuid();
ALTER TABLE "nca_class_rules" ALTER COLUMN "updated_at" SET DEFAULT now();
ALTER TABLE "password_reset_tokens" ALTER COLUMN "id" SET DEFAULT gen_random_uuid();
ALTER TABLE "practical_completion_acknowledgements" ALTER COLUMN "id" SET DEFAULT gen_random_uuid();
ALTER TABLE "provider_payment_charges"
  ALTER COLUMN "id" SET DEFAULT gen_random_uuid(),
  ALTER COLUMN "updated_at" SET DEFAULT now();
ALTER TABLE "tenant_module_flags" ALTER COLUMN "id" SET DEFAULT gen_random_uuid();
ALTER TABLE "meetings" ALTER COLUMN "updated_at" SET DEFAULT now();
