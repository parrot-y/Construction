import { describe, expect, it } from 'vitest';
import { readFileSync, readdirSync, statSync } from 'fs';
import { join } from 'path';

/**
 * Currency guard (audit P2.2): money must render through formatKes()
 * ("KES 2,250,000", no raw decimals). This test fails on:
 *  1. NEW literal "KES <digits>" strings in components (beyond BASELINE).
 *  2. NEW .toFixed(2) / toLocaleString money formatting in components
 *     (beyond BASELINE — migrate offenders to formatKes and shrink it).
 * When you migrate a file, remove it from BASELINE.
 */

const SRC = join(__dirname, '..', 'src');

// Files still carrying legacy money formatting — shrink, never grow.
const BASELINE_TOFIXED = new Set([
  // Migrated files must be removed from this list.
'/home/maskgod/Documents/FRONT_END_WEB_DEVELOPMENT_COURSE/Construction/apps/web/src/components/AnnouncementsView.tsx',
  '/home/maskgod/Documents/FRONT_END_WEB_DEVELOPMENT_COURSE/Construction/apps/web/src/components/AsphaltPavementView.tsx',
  '/home/maskgod/Documents/FRONT_END_WEB_DEVELOPMENT_COURSE/Construction/apps/web/src/components/BarBendingScheduleView.tsx',
  '/home/maskgod/Documents/FRONT_END_WEB_DEVELOPMENT_COURSE/Construction/apps/web/src/components/ClientDashboard.tsx',
  '/home/maskgod/Documents/FRONT_END_WEB_DEVELOPMENT_COURSE/Construction/apps/web/src/components/CompanyAdminDashboard.tsx',
  '/home/maskgod/Documents/FRONT_END_WEB_DEVELOPMENT_COURSE/Construction/apps/web/src/components/console/AskAiPanel.tsx',
  '/home/maskgod/Documents/FRONT_END_WEB_DEVELOPMENT_COURSE/Construction/apps/web/src/components/console/sections/BoqWorkbookView.tsx',
  '/home/maskgod/Documents/FRONT_END_WEB_DEVELOPMENT_COURSE/Construction/apps/web/src/components/console/sections/FilesSection.tsx',
  '/home/maskgod/Documents/FRONT_END_WEB_DEVELOPMENT_COURSE/Construction/apps/web/src/components/console/sections/MoneySection.tsx',
  '/home/maskgod/Documents/FRONT_END_WEB_DEVELOPMENT_COURSE/Construction/apps/web/src/components/console/sections/ProjectsSection.tsx',
  '/home/maskgod/Documents/FRONT_END_WEB_DEVELOPMENT_COURSE/Construction/apps/web/src/components/console/SessionsModal.tsx',
  '/home/maskgod/Documents/FRONT_END_WEB_DEVELOPMENT_COURSE/Construction/apps/web/src/components/ContractorTenderBoardView.tsx',
  '/home/maskgod/Documents/FRONT_END_WEB_DEVELOPMENT_COURSE/Construction/apps/web/src/components/CostCaptureModal.tsx',
  '/home/maskgod/Documents/FRONT_END_WEB_DEVELOPMENT_COURSE/Construction/apps/web/src/components/CrewsView.tsx',
  '/home/maskgod/Documents/FRONT_END_WEB_DEVELOPMENT_COURSE/Construction/apps/web/src/components/ETimsTaxComplianceView.tsx',
  '/home/maskgod/Documents/FRONT_END_WEB_DEVELOPMENT_COURSE/Construction/apps/web/src/components/GeofencedClockInView.tsx',
  '/home/maskgod/Documents/FRONT_END_WEB_DEVELOPMENT_COURSE/Construction/apps/web/src/components/GeotechnicalSoilView.tsx',
  '/home/maskgod/Documents/FRONT_END_WEB_DEVELOPMENT_COURSE/Construction/apps/web/src/components/InboxView.tsx',
  '/home/maskgod/Documents/FRONT_END_WEB_DEVELOPMENT_COURSE/Construction/apps/web/src/components/IndependentSiteReportView.tsx',
  '/home/maskgod/Documents/FRONT_END_WEB_DEVELOPMENT_COURSE/Construction/apps/web/src/components/InvoicingView.tsx',
  '/home/maskgod/Documents/FRONT_END_WEB_DEVELOPMENT_COURSE/Construction/apps/web/src/components/LaborMusterRollView.tsx',
  '/home/maskgod/Documents/FRONT_END_WEB_DEVELOPMENT_COURSE/Construction/apps/web/src/components/LandingPortalHub.tsx',
  '/home/maskgod/Documents/FRONT_END_WEB_DEVELOPMENT_COURSE/Construction/apps/web/src/components/MaterialRequisitionView.tsx',
  '/home/maskgod/Documents/FRONT_END_WEB_DEVELOPMENT_COURSE/Construction/apps/web/src/components/MaterialWastageVarianceCard.tsx',
  '/home/maskgod/Documents/FRONT_END_WEB_DEVELOPMENT_COURSE/Construction/apps/web/src/components/MpesaDisbursementView.tsx',
  '/home/maskgod/Documents/FRONT_END_WEB_DEVELOPMENT_COURSE/Construction/apps/web/src/components/PlantEquipmentView.tsx',
  '/home/maskgod/Documents/FRONT_END_WEB_DEVELOPMENT_COURSE/Construction/apps/web/src/components/PlantTelematicsView.tsx',
  '/home/maskgod/Documents/FRONT_END_WEB_DEVELOPMENT_COURSE/Construction/apps/web/src/components/portals/SubcontractorPortalView.tsx',
  '/home/maskgod/Documents/FRONT_END_WEB_DEVELOPMENT_COURSE/Construction/apps/web/src/components/ProjectSCurveCashFlowCard.tsx',
  '/home/maskgod/Documents/FRONT_END_WEB_DEVELOPMENT_COURSE/Construction/apps/web/src/components/QuotesManagementView.tsx',
  '/home/maskgod/Documents/FRONT_END_WEB_DEVELOPMENT_COURSE/Construction/apps/web/src/components/RetentionAndBondsView.tsx',
  '/home/maskgod/Documents/FRONT_END_WEB_DEVELOPMENT_COURSE/Construction/apps/web/src/components/RmcTransitTrackerView.tsx',
  '/home/maskgod/Documents/FRONT_END_WEB_DEVELOPMENT_COURSE/Construction/apps/web/src/components/SafetyAuditScorecardView.tsx',
  '/home/maskgod/Documents/FRONT_END_WEB_DEVELOPMENT_COURSE/Construction/apps/web/src/components/SafetyIncidentLogView.tsx',
  '/home/maskgod/Documents/FRONT_END_WEB_DEVELOPMENT_COURSE/Construction/apps/web/src/components/ScheduledReportsView.tsx',
  '/home/maskgod/Documents/FRONT_END_WEB_DEVELOPMENT_COURSE/Construction/apps/web/src/components/SiteInventoryManagementView.tsx',
  '/home/maskgod/Documents/FRONT_END_WEB_DEVELOPMENT_COURSE/Construction/apps/web/src/components/StatutoryTaxManagementView.tsx',
  '/home/maskgod/Documents/FRONT_END_WEB_DEVELOPMENT_COURSE/Construction/apps/web/src/components/StructuralSteelTakeoffView.tsx',
  '/home/maskgod/Documents/FRONT_END_WEB_DEVELOPMENT_COURSE/Construction/apps/web/src/components/SubcontractorValuationView.tsx',
  '/home/maskgod/Documents/FRONT_END_WEB_DEVELOPMENT_COURSE/Construction/apps/web/src/components/SubscriptionBillingView.tsx',
  '/home/maskgod/Documents/FRONT_END_WEB_DEVELOPMENT_COURSE/Construction/apps/web/src/components/TendersView.tsx',
  '/home/maskgod/Documents/FRONT_END_WEB_DEVELOPMENT_COURSE/Construction/apps/web/src/components/TopographicSurveyView.tsx',
  '/home/maskgod/Documents/FRONT_END_WEB_DEVELOPMENT_COURSE/Construction/apps/web/src/components/VariationManagementView.tsx',
  '/home/maskgod/Documents/FRONT_END_WEB_DEVELOPMENT_COURSE/Construction/apps/web/src/components/WeatherDelayClaimsView.tsx'
]);
const BASELINE_KES_LITERAL = new Set<string>([
  // Budget-range chip labels (ranges, not amounts) and a static fixture string.
  join(SRC, 'components', 'ClientRequestView.tsx'),
  join(SRC, 'components', 'BoqImportModal.tsx'),
  join(SRC, 'ui', 'index.tsx'), // formatKes docstring
]);

function walk(dir: string, out: string[] = []): string[] {
  for (const e of readdirSync(dir)) {
    const p = join(dir, e);
    if (statSync(p).isDirectory()) walk(p, out);
    else if (/\.tsx$/.test(e) && !e.endsWith('.test.tsx')) out.push(p);
  }
  return out;
}

const files = walk(SRC);

const kesLiteralRe = /KES\s+\d[\d,]*/;
const moneyFormatRe = /\.toFixed\(2\)|toLocaleString\([^)]*\)/;

describe('currency guard', () => {
  it('no literal "KES <amount>" strings in components', () => {
    const offenders: string[] = [];
    for (const f of files) {
      const src = readFileSync(f, 'utf8');
      src.split('\n').forEach((line, i) => {
        if (kesLiteralRe.test(line) && !BASELINE_KES_LITERAL.has(f)) {
          offenders.push(`${f.replace(SRC, 'src')}:${i + 1}: ${line.trim().slice(0, 90)}`);
        }
      });
    }
    expect(offenders).toEqual([]);
  });

  it('legacy money formatting does not grow beyond baseline', () => {
    const offenders: string[] = [];
    for (const f of files) {
      if (f.endsWith(join('ui', 'index.tsx'))) continue; // formatKes itself
      const src = readFileSync(f, 'utf8');
      const count = (src.match(new RegExp(moneyFormatRe.source, 'g')) || []).length;
      if (count > 0 && !BASELINE_TOFIXED.has(f)) {
        offenders.push(`${f.replace(SRC, 'src')} (${count} hits)`);
      }
    }
    expect(offenders).toEqual([]);
  });
});
