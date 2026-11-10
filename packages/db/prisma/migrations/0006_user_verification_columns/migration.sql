-- Verification placeholders for self-serve company onboarding.
-- Nullable timestamps; populated when a real verification provider is wired.
ALTER TABLE "users"
  ADD COLUMN "email_verified_at" TIMESTAMPTZ,
  ADD COLUMN "phone_verified_at" TIMESTAMPTZ;
