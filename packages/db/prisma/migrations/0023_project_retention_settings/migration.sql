-- Round H3: project-level retention terms (rate, cap, first moiety).
ALTER TABLE "projects" ADD COLUMN "retention_rate_pct" DECIMAL(5,2) NOT NULL DEFAULT 5.00;
ALTER TABLE "projects" ADD COLUMN "retention_cap_pct" DECIMAL(5,2) NOT NULL DEFAULT 5.00;
ALTER TABLE "projects" ADD COLUMN "retention_first_moiety_pct" DECIMAL(5,2) NOT NULL DEFAULT 50.00;
