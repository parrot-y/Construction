-- Tenant-configured FX rates (KES base) with as-of date and source.
-- Replaces hard-coded reference rates: no rates on file -> conversion hidden.

-- AlterTable
ALTER TABLE "tenants" ADD COLUMN     "fx_rates" JSONB;
