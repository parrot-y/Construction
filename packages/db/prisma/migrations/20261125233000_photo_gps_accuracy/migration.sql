-- Phase 5.1: GPS accuracy (meters) captured by the device at photo time.
-- Nullable — photos taken without a GPS fix simply have no accuracy.
-- Rollback: ALTER TABLE "site_photos" DROP COLUMN "gps_accuracy_meters";
--           ALTER TABLE "snag_photos" DROP COLUMN "gps_accuracy_meters";
--           ALTER TABLE "independent_inspection_photos" DROP COLUMN "gps_accuracy_meters";

-- AlterTable
ALTER TABLE "site_photos" ADD COLUMN "gps_accuracy_meters" DECIMAL(8,2);

-- AlterTable
ALTER TABLE "snag_photos" ADD COLUMN "gps_accuracy_meters" DECIMAL(8,2);

-- AlterTable
ALTER TABLE "independent_inspection_photos" ADD COLUMN "gps_accuracy_meters" DECIMAL(8,2);
