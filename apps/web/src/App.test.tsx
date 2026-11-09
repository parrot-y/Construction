import { describe, expect, it} from 'vitest';
import { renderToString} from 'react-dom/server';
import App from './App';
import Dashboard from './components/Dashboard';
import LoginForm from './components/LoginForm';
import BoqImportModal from './components/BoqImportModal';
import CostCaptureModal from './components/CostCaptureModal';
import BudgetSummaryCard from './components/BudgetSummaryCard';
import CostManagementView from './components/CostManagementView';
import OfflineSyncBanner from './components/OfflineSyncBanner';
import SiteDiaryModal from './components/SiteDiaryModal';
import PhysicalProgressModal from './components/PhysicalProgressModal';
import VarianceMonitorCard from './components/VarianceMonitorCard';
import CreateVariationModal from './components/CreateVariationModal';
import VariationManagementView from './components/VariationManagementView';
import ClientDashboard from './components/ClientDashboard';
import PhotoEvidenceGallery from './components/PhotoEvidenceGallery';
import MilestoneTimeline from './components/MilestoneTimeline';
import PhotoLightboxModal from './components/PhotoLightboxModal';
import RfiManagementView from './components/RfiManagementView';
import CreateRfiModal from './components/CreateRfiModal';
import QualityControlView from './components/QualityControlView';
import ConcreteCubeTestModal from './components/ConcreteCubeTestModal';
import SnaggingListView from './components/SnaggingListView';
import CreateSnagModal from './components/CreateSnagModal';
import PracticalCompletionCard from './components/PracticalCompletionCard';
import ConsultantPortalView from './components/portals/ConsultantPortalView';
import SubcontractorPortalView from './components/portals/SubcontractorPortalView';
import SupplierPortalView from './components/portals/SupplierPortalView';
import CompliancePortalView from './components/portals/CompliancePortalView';
import PortalAccessLinkManager from './components/PortalAccessLinkManager';
import ProjectScheduleGanttView from './components/ProjectScheduleGanttView';
import SiteInventoryManagementView from './components/SiteInventoryManagementView';
import SafetyIncidentLogView from './components/SafetyIncidentLogView';
import ProjectDocumentVaultView from './components/ProjectDocumentVaultView';
import SubcontractorManagementView from './components/SubcontractorManagementView';
import WeatherDelayClaimsView from './components/WeatherDelayClaimsView';
import StatutoryTaxManagementView from './components/StatutoryTaxManagementView';
import { MaterialRequisitionView} from './components/MaterialRequisitionView';
import { MaterialWastageVarianceCard} from './components/MaterialWastageVarianceCard';
import { ProjectSCurveCashFlowCard} from './components/ProjectSCurveCashFlowCard';
import { SubcontractorValuationView} from './components/SubcontractorValuationView';
import { PlantEquipmentView} from './components/PlantEquipmentView';
import { LaborMusterRollView} from './components/LaborMusterRollView';
import { SafetyAuditScorecardView} from './components/SafetyAuditScorecardView';
import { ETimsTaxComplianceView} from './components/ETimsTaxComplianceView';
import { WhatsAppSiteWebhookView} from './components/WhatsAppSiteWebhookView';
import { RetentionAndBondsView} from './components/RetentionAndBondsView';
import { SubscriptionBillingView} from './components/SubscriptionBillingView';
import { GeofencedClockInView} from './components/GeofencedClockInView';
import { PlantTelematicsView} from './components/PlantTelematicsView';
import { BarBendingScheduleView} from './components/BarBendingScheduleView';
import { MpesaDisbursementView} from './components/MpesaDisbursementView';
import { RmcTransitTrackerView} from './components/RmcTransitTrackerView';
import { StructuralSteelTakeoffView} from './components/StructuralSteelTakeoffView';
import { GeotechnicalSoilView} from './components/GeotechnicalSoilView';
import { AsphaltPavementView} from './components/AsphaltPavementView';
import { TopographicSurveyView} from './components/TopographicSurveyView';
import PmQsDashboard from './components/PmQsDashboard';
import CompanyAdminDashboard from './components/CompanyAdminDashboard';
import SupervisorDashboard from './components/SupervisorDashboard';
import IndependentSiteReportView from './components/IndependentSiteReportView';
import ContractorTenderBoardView from './components/ContractorTenderBoardView';
import LandingPortalHub from './components/LandingPortalHub';
import { AuthSession} from './types/auth';
import QuotesManagementView from './components/QuotesManagementView';
import InvoicingView from './components/InvoicingView';

describe('Web App walking skeleton & login suite (Milestone M1 & M3)', () => {
  it('renders the login screen by default with demo accounts and title', () => {
    const html = renderToString(<LoginForm onLoginSuccess={() => {}} />);
        expect(html).toContain('Site Safi');
    expect(html).toContain('admin@apexbuilders.co.ke');
    expect(html).toContain('COMPANY_ADMIN');
    expect(html).toContain('PM_QS');
    expect(html).toContain('SITE_SUPERVISOR');
    expect(html).toContain('CLIENT');
});

  it('renders the App component root unauthenticated', () => {
    const html = renderToString(<App />);
    expect(html).toContain('Site Safi');
    expect(html).toContain('Sign in to your workspace');
});

  it('renders COMPANY_ADMIN dashboard with portfolio stats, projects, members, and audit trail', () => {
    const adminSession: AuthSession = {
      user: {
        id: '11111111-1111-1111-1111-111111111111',
        email: 'admin@apexbuilders.co.ke',
        fullName: 'David Kimani',
        role: 'COMPANY_ADMIN',
        tenant: {
          id: 'tenant-123',
          name: 'Apex Builders Kenya Ltd',
          slug: 'apex-builders',
          currency: 'KES',
},
},
      permissions: ['company.manage', 'user.invite', 'project.create', 'audit.view'],
      token: 'mock-jwt-token-admin',
};

    const html = renderToString(<CompanyAdminDashboard session={adminSession} />);
    expect(html).toContain('Apex Builders Kenya Ltd');
    expect(html).toContain('Executive Company Dashboard');
    expect(html).toContain('Active Projects');
    expect(html).toContain('Total Contract Value');
    expect(html).toContain('Approved Budget');
    expect(html).toContain('Registered Projects');
    expect(html).toContain('No projects yet');
    expect(html).toContain('Team Management');
    expect(html).toContain('Audit Log Activity Trail');
    expect(html).toContain('+ Create Project');
    expect(html).toContain('+ Invite Member');
});

  it('renders PM_QS dashboard with budget baseline, BOQ structure, core loop, and variance guard', () => {
    const qsSession: AuthSession = {
      user: {
        id: '22222222-2222-2222-2222-222222222222',
        email: 'qs@apexbuilders.co.ke',
        fullName: 'Faith Achieng',
        role: 'PM_QS',
        tenant: {
          id: 'tenant-123',
          name: 'Apex Builders Kenya Ltd',
          slug: 'apex-builders',
          currency: 'KES',
},
},
      permissions: ['boq.import', 'cost.approve', 'project.view', 'variation.create'],
      token: 'mock-jwt-token-qs',
};

    const html = renderToString(<PmQsDashboard session={qsSession} />);
    expect(html).toContain('Apex Builders Kenya Ltd');
    expect(html).toContain('PM_QS');
    expect(html).toContain('Cost Control &amp; BOQ Management');
    expect(html).toContain('Import Excel BOQ');
    expect(html).toContain('BORAQS / EASMM');
    expect(html).toContain('Approved Budget Baseline');
    expect(html).toContain('Core Loop Workflow Status');
    // Variance/budget cards render honest empty states until live data loads
    expect(html).toContain('No variance data yet');
});

  it('renders SITE_SUPERVISOR dashboard with daily diary, headcount, and offline PWA indicator', () => {
    const supervisorSession: AuthSession = {
      user: {
        id: '33333333-3333-3333-3333-333333333333',
        email: 'supervisor@apexbuilders.co.ke',
        fullName: 'John Mwangi',
        role: 'SITE_SUPERVISOR',
        tenant: {
          id: 'tenant-123',
          name: 'Apex Builders Kenya Ltd',
          slug: 'apex-builders',
          currency: 'KES',
},
},
      permissions: ['site.diary.create', 'evidence.upload', 'progress.update', 'project.view'],
      token: 'mock-jwt-token-supervisor',
};

    const html = renderToString(<SupervisorDashboard session={supervisorSession} />);
    expect(html).toContain('Apex Builders Kenya Ltd');
    expect(html).toContain('Site Supervisor Workspace');
    expect(html).toContain('Site Operations &amp; Daily Diary');
    expect(html).toContain('+ Record Daily Site Diary');
    expect(html).toContain('IndexedDB Offline Queue Active');
    expect(html).toContain('Assigned Sites');
    expect(html).toContain('Today&#x27;s Diary Status');
    expect(html).toContain('Today&#x27;s Headcount');
    expect(html).toContain('Photo Evidence Feed');
});

  it('renders CLIENT dashboard with physical progress, certified costs, and retention ledger terms', () => {
    const clientSession: AuthSession = {
      user: {
        id: '44444444-4444-4444-4444-444444444444',
        email: 'client@apexbuilders.co.ke',
        fullName: 'Sarah Wambui',
        role: 'CLIENT',
        tenant: {
          id: 'tenant-123',
          name: 'Apex Builders Kenya Ltd',
          slug: 'apex-builders',
          currency: 'KES',
},
},
      permissions: ['project.view', 'client.portal.access', 'report.view'],
      token: 'mock-jwt-token-client',
};

    const html = renderToString(<Dashboard session={clientSession} onLogout={() => {}} />);
    expect(html).toContain('Apex Builders Kenya Ltd');
    expect(html).toContain('Sarah Wambui');
    expect(html).toContain('CLIENT');
    expect(html).toContain('Project Visibility &amp; Progress Verification');
    expect(html).toContain('Physical Progress');
    expect(html).toContain('Approved Contract Sum');
    expect(html).toContain('Total Certified Cost');
    expect(html).toContain('Contract Retention Terms (Kenyan Standard)');
    expect(html).toContain('10% of Gross Certified Work');
    expect(html).toContain('Verified Photo Evidence');
});

  it('renders BoqImportModal with EASMM sections, arithmetic status badges, and 6-stage lifecycle', () => {
    const html = renderToString(
<BoqImportModal
        isOpen={true}
        onClose={() => {}}
        onImportSuccess={() => {}}
        projectId="test-proj-id"
        projectName="Riverside Commercial Plaza"
      />,
);
    expect(html).toContain('Import Bill of Quantities (BOQ)');
    expect(html).toContain('EASMM 2008 Standard Pipeline');
    expect(html).toContain('Riverside Commercial Plaza');
    expect(html).toContain('Click to select Excel spreadsheet');
    expect(html).toContain('Supports Microsoft Excel (.xlsx) files up to 15MB');
});

  it('renders CostCaptureModal with KES currency, category dropdown, vendor, and receipt upload', () => {
    const html = renderToString(
<CostCaptureModal
        isOpen={true}
        onClose={() => {}}
        projectId="test-proj-id"
      />,
);
    expect(html).toContain('Log Site Cost Entry');
    expect(html).toContain('Amount (KES)');
    expect(html).toContain('Cost Category');
    expect(html).toContain('Vendor / Payee Name');
    expect(html).toContain('Invoice / Voucher Ref #');
    expect(html).toContain('Attach Receipt / Delivery Note');
    expect(html).toContain('Submit Cost for Approval');
});

  it('renders BudgetSummaryCard with approved budget, actual spent, pending approvals, and category breakdown', () => {
    const html = renderToString(
<BudgetSummaryCard
          projectName="Riverside Commercial Plaza"
          summary={{
            approvedBudget: '45000000.00',
            approvedCost: '12450200.00',
            pendingCost: '1850000.00',
            rejectedCost: '0.00',
            remainingBudget: '32549800.00',
            consumptionPercentage: '27.67',
            categoryBreakdown: {
              MATERIAL: { approved: '6200000.00', pending: '850000.00'},
              LABOR: { approved: '3150000.00', pending: '500000.00'},
              PLANT: { approved: '1200200.00', pending: '250000.00'},
              SUBCONTRACT: { approved: '1100000.00', pending: '150000.00'},
              PRELIMINARY: { approved: '800000.00', pending: '100000.00'},
            },
            varianceAlert: { hasWarning: false, message: null },
          }}
        />,
);
    expect(html).toContain('Budget vs Actual Expenditure');
    expect(html).toContain('Approved Budget');
    expect(html).toContain('Actual Spent (Approved)');
    expect(html).toContain('Pending Approval');
    expect(html).toContain('Remaining Budget');
    expect(html).toContain('Category Cost Distribution');
    expect(html).toContain('Materials');
    expect(html).toContain('Labor');
    expect(html).toContain('Plant / Hire');
});

  it('renders CostManagementView with append-only ledger, status filters, and action buttons', () => {
    const html = renderToString(
<CostManagementView
        projectId="test-proj-id"
        canApprove={true}
        canCreate={true}
      />,
);
    expect(html).toContain('Append-Only Financial Ledger');
    expect(html).toContain('Project Cost Entries &amp; Approvals');
    expect(html).toContain('Log Cost Entry');
    expect(html).toContain('ALL');
    expect(html).toContain('PENDING');
    expect(html).toContain('APPROVED');
        });

  it('renders OfflineSyncBanner with connection status and IndexedDB queue count', () => {
    const html = renderToString(<OfflineSyncBanner />);
    expect(html).toContain('IndexedDB Offline Queue Active');
    expect(html).toContain('Online &amp; Synchronized');
});

  it('renders SiteDiaryModal with weather, headcount matrix, material deliveries, and photo compression preview', () => {
    const html = renderToString(
<SiteDiaryModal
        isOpen={true}
        onClose={() => {}}
        projectId="test-proj-id"
        projectName="Riverside Commercial Plaza"
      />,
);
    expect(html).toContain('Record Daily Site Diary');
    expect(html).toContain('Riverside Commercial Plaza');
    expect(html).toContain('Weather Condition');
    expect(html).toContain('On-Site Trade Headcount');
    expect(html).toContain('Masons');
    expect(html).toContain('Carpenters');
    expect(html).toContain('Steel Fixers');
    expect(html).toContain('Material Delivery Received');
    expect(html).toContain('Plant &amp; Equipment Log');
    expect(html).toContain('Machinery Hours &amp; Fuel');
    expect(html).toContain('Geotagged Photo Evidence');
    expect(html).toContain('Site Work Diary Notes');
});

  it('renders PhysicalProgressModal with cumulative progress, BOQ milestone items, and offline fallback', () => {
    const html = renderToString(
<PhysicalProgressModal
        isOpen={true}
        onClose={() => {}}
        projectId="test-proj-id"
        projectName="Riverside Commercial Plaza"
      />,
);
    expect(html).toContain('Record Physical Site Progress');
    expect(html).toContain('Cumulative physical milestone measurement');
    expect(html).toContain('Observation Date');
    expect(html).toContain('Overall Project Progress (%)');
    expect(html).toContain('Progress &amp; Milestone Notes');
});

  describe('Milestone M7: Variance Monitor & Health Visualization', () => {
    it('renders VarianceMonitorCard with default ON_TRACK status, comparison bars, and section breakdown', () => {
      const html = renderToString(
<VarianceMonitorCard
          projectName="Riverside Commercial Plaza"
          approvedBudget="45000000.00"
          approvedCost="12450200.00"
          pendingCost="1850000.00"
          detailedVariance={{
            costConsumptionPercentage: '27.67',
            physicalProgressPercentage: '30.00',
            differencePercentage: '-2.33%',
            status: 'ON_TRACK',
            statusLabel: 'Normal Alignment',
            severity: 'info',
            message: 'Expenditure is aligned with recorded physical progress.',
          }}
          categoryBreakdown={{
            MATERIAL: { approved: '6200000.00', pending: '850000.00'},
            LABOR: { approved: '3150000.00', pending: '500000.00'},
            PLANT: { approved: '1200200.00', pending: '250000.00'},
            SUBCONTRACT: { approved: '1100000.00', pending: '150000.00'},
            PRELIMINARY: { approved: '800000.00', pending: '100000.00'},
          }}
          sectionBreakdown={[
            { sectionId: 'sec-1', title: 'Section 1: Preliminaries & General', allocatedBudget: '4500000.00', actualSpent: '1800000.00', pendingSpent: '200000.00', remainingBudget: '2700000.00', consumptionPercentage: '40.00', isOverBudget: false, status: 'NORMAL' },
            { sectionId: 'sec-2', title: 'Section 2: Substructure & Earthworks', allocatedBudget: '12000000.00', actualSpent: '7500000.00', pendingSpent: '500000.00', remainingBudget: '4500000.00', consumptionPercentage: '62.50', isOverBudget: false, status: 'NORMAL' },
          ]}
        />,
);

      // Header & Status
      expect(html).toContain('Variance Monitor &amp; Health Guard');
      expect(html).toContain('Cost Consumption vs Physical Progress');
      expect(html).toContain('Normal Alignment (ON_TRACK)');
      expect(html).toContain('Expenditure is aligned with recorded physical progress.');

      // Comparison bars
      expect(html).toContain('Cost Consumption (Approved)');
      expect(html).toContain('Physical Milestone Progress');
      expect(html).toContain('27.67%');
      expect(html).toContain('30.00%');

      // Category breakdown
      expect(html).toContain('Category Cost Distribution');
      expect(html).toContain('Materials');
      expect(html).toContain('Labor');
      expect(html).toContain('Plant / Hire');
      expect(html).toContain('Subcontracts');
      expect(html).toContain('Preliminaries');

      // BOQ section table
      expect(html).toContain('BOQ Section-by-Section Spend Breakdown');
      expect(html).toContain('Section 1: Preliminaries &amp; General');
      expect(html).toContain('Section 2: Substructure &amp; Earthworks');
      expect(html).toContain('NORMAL');

      // Strict neutrality check
      expect(html).not.toMatch(/fraud|theft|stolen|loss|bleeding|overbilled|overcharge/i);
});

    it('renders VarianceMonitorCard with ACTION_REQUIRED status and neutral non-accusatory alert', () => {
      const html = renderToString(
<VarianceMonitorCard
          projectName="Riverside Commercial Plaza"
          detailedVariance={{
            costConsumptionPercentage: '68.50',
            physicalProgressPercentage: '35.00',
            differencePercentage: '+33.50%',
            status: 'ACTION_REQUIRED',
            statusLabel: 'Significant Disparity',
            severity: 'critical',
            message:
              'Cost consumption is significantly ahead of recorded physical progress. Review project costs and progress records.',
}}
          sectionBreakdown={[
            {
              sectionId: 'sec-overrun',
              title: 'Section 2: Substructure',
              allocatedBudget: '10,000,000.00',
              actualSpent: '12,500,000.00',
              pendingSpent: '500,000.00',
              remainingBudget: '-2,500,000.00',
              consumptionPercentage: '125.00',
              isOverBudget: true,
              status: 'OVERRUN',
},
            {
              sectionId: 'sec-watch',
              title: 'Section 3: Concrete Frame',
              allocatedBudget: '15,000,000.00',
              actualSpent: '13,500,000.00',
              pendingSpent: '300,000.00',
              remainingBudget: '1,500,000.00',
              consumptionPercentage: '90.00',
              isOverBudget: false,
              status: 'WATCH',
},
          ]}
        />,
);

      expect(html).toContain('Significant Disparity (ACTION_REQUIRED)');
      expect(html).toContain('+33.50%');
      expect(html).toContain(
        'Cost consumption is significantly ahead of recorded physical progress. Review project costs and progress records.',
);
      expect(html).toContain('OVERRUN');
      expect(html).toContain('WATCH');
      expect(html).not.toMatch(/fraud|theft|stolen|loss|bleeding|overcharge/i);
});

    it('renders VarianceMonitorCard inside PM_QS and CLIENT dashboards', () => {
      const qsSession: AuthSession = {
        user: {
          id: '22222222-2222-2222-2222-222222222222',
          email: 'qs@apexbuilders.co.ke',
          fullName: 'Faith Achieng',
          role: 'PM_QS',
          tenant: {
            id: 'tenant-123',
            name: 'Apex Builders Kenya Ltd',
            slug: 'apex-builders',
            currency: 'KES',
},
},
        permissions: ['boq.import', 'cost.approve', 'project.view', 'variation.create'],
        token: 'mock-jwt-token-qs',
};

      const clientSession: AuthSession = {
        user: {
          id: '44444444-4444-4444-4444-444444444444',
          email: 'client@apexbuilders.co.ke',
          fullName: 'Sarah Wambui',
          role: 'CLIENT',
          tenant: {
            id: 'tenant-123',
            name: 'Apex Builders Kenya Ltd',
            slug: 'apex-builders',
            currency: 'KES',
},
},
        permissions: ['project.view', 'client.portal.access', 'report.view'],
        token: 'mock-jwt-token-client',
};

      const qsHtml = renderToString(<PmQsDashboard session={qsSession} />);
      // Cards render honest empty states until live budget/variance data loads
      expect(qsHtml).toContain('No variance data yet');

      const clientHtml = renderToString(<Dashboard session={clientSession} onLogout={() => {}} />);
      expect(clientHtml).toContain('No variance data yet');
});
});

  describe('Milestone M8: Variations Workflow UI Suite', () => {
    it('renders CreateVariationModal with addition/omission toggle, quantity, rate, calculated line total, and live net amount', () => {
      const html = renderToString(
<CreateVariationModal
          isOpen={true}
          onClose={() => {}}
          projectId="test-proj-id"
          projectName="Riverside Commercial Plaza"
        />,
);

      // Header
      expect(html).toContain('Request Variation Order (VO)');
      expect(html).toContain('Milestone M8 • Variations Workflow');
      expect(html).toContain('Riverside Commercial Plaza');

      // Form inputs
      expect(html).toContain('Change Order Title *');
      expect(html).toContain('Time Extension (Days)');
      expect(html).toContain('Reason / Technical Justification *');

      // Line items & toggle
      expect(html).toContain('Scope Items (Additions &amp; Omissions)');
      expect(html).toContain('+ Addition');
      expect(html).toContain('- Omission');
      expect(html).toContain('Quantity');
      expect(html).toContain('Unit Rate (KES)');
      expect(html).toContain('Line Total:');

      // Live net amount summary & submission
      expect(html).toContain('Calculated Net Amount');
      expect(html).toContain('Sum of all additions and omissions');
      expect(html).toContain('Submit Variation Order');
});

    it('renders VariationManagementView with ADR-010 status badges, formatted KES net amount, and action buttons', () => {
      const html = renderToString(
<VariationManagementView
          projectId="test-proj-id"
          userRole="PM_QS"
          canRequest={true}
          canReview={true}
          canApprove={true}
          initialVariations={[
            {
              id: 'vo-1',
              variation_no: 1,
              title: 'CO-1: Foundation Deepening',
              reason: 'Geotechnical report detected loose subsoil.',
              status: 'APPROVED',
              net_amount: '900000.00',
              time_extension_days: 14,
              created_at: new Date().toISOString(),
              items: [],
},
            {
              id: 'vo-2',
              variation_no: 2,
              title: 'CO-2: Membrane Upgrade',
              reason: 'High water table requires upgrade.',
              status: 'PM_REVIEW',
              trigger_type: 'UNFORESEEN_CONDITION',
              net_amount: '450000.00',
              time_extension_days: 5,
              created_at: new Date().toISOString(),
              items: [],
},
            {
              id: 'vo-3',
              variation_no: 3,
              title: 'CO-3: Canopy Omission',
              reason: 'Value engineering omission.',
              status: 'OWNER_REVIEW',
              net_amount: '-280000.00',
              time_extension_days: 0,
              created_at: new Date().toISOString(),
              items: [],
},
            {
              id: 'vo-4',
              variation_no: 4,
              title: 'CO-4: Draft Drainage',
              reason: 'Draft pending submission.',
              status: 'DRAFT',
              net_amount: '50000.00',
              time_extension_days: 0,
              created_at: new Date().toISOString(),
              items: [],
},
          ]}
        />,
);

      // Header & request button
      expect(html).toContain('Change Orders');
      expect(html).toContain('+ New Change Order');

      // ADR-010 status badges + trigger label
      expect(html).toContain('PM REVIEW');
      expect(html).toContain('OWNER REVIEW');
      expect(html).toContain('APPROVED');
      expect(html).toContain('Unforeseen condition');

      // Formatted KES amounts and time extensions
      expect(html).toContain('KES 900,000');
      expect(html).toContain('KES 450,000');
      expect(html).toContain('+14 Days Extension');
      expect(html).toContain('+5 Days Extension');

      // Action buttons
      expect(html).toContain('Evaluate');
      expect(html).toContain('Owner Approve');
      expect(html).toContain('Reject');
      expect(html).toContain('Submit for PM review');
});

    it('renders VariationManagementView embedded inside PM_QS and CLIENT dashboards', () => {
      const qsSession: AuthSession = {
        user: {
          id: '22222222-2222-2222-2222-222222222222',
          email: 'qs@apexbuilders.co.ke',
          fullName: 'Faith Achieng',
          role: 'PM_QS',
          tenant: {
            id: 'tenant-123',
            name: 'Apex Builders Kenya Ltd',
            slug: 'apex-builders',
            currency: 'KES',
},
},
        permissions: ['boq.import', 'cost.approve', 'project.view', 'variation.create', 'variation.review'],
        token: 'mock-jwt-token-qs',
};

      const clientSession: AuthSession = {
        user: {
          id: '44444444-4444-4444-4444-444444444444',
          email: 'client@apexbuilders.co.ke',
          fullName: 'Sarah Wambui',
          role: 'CLIENT',
          tenant: {
            id: 'tenant-123',
            name: 'Apex Builders Kenya Ltd',
            slug: 'apex-builders',
            currency: 'KES',
},
},
        permissions: ['project.view', 'client.portal.access', 'report.view', 'variation.approve'],
        token: 'mock-jwt-token-client',
};

      const qsHtml = renderToString(<PmQsDashboard session={qsSession} />);
      expect(qsHtml).toContain('Change Orders');
      expect(qsHtml).toContain('+ New Change Order');
      expect(qsHtml).toContain('PM REVIEW');

      const clientHtml = renderToString(<Dashboard session={clientSession} onLogout={() => {}} />);
      expect(clientHtml).toContain('Change Orders');
      expect(clientHtml).toContain('OWNER REVIEW');
      expect(clientHtml).not.toContain('+ New Change Order');
});
});

  describe('Milestone M9: Client / Developer Portal UI Suite', () => {
    const clientSession: AuthSession = {
      user: {
        id: '44444444-4444-4444-4444-444444444444',
        email: 'client@apexbuilders.co.ke',
        fullName: 'Sarah Wambui',
        role: 'CLIENT',
        tenant: {
          id: 'tenant-123',
          name: 'Apex Builders Kenya Ltd',
          slug: 'apex-builders',
          currency: 'KES',
},
},
      permissions: ['project.view', 'client.portal.access', 'report.view', 'variation.approve'],
      token: 'mock-jwt-token-client',
};

    it('renders the 5 plain-language financial cards with KES formatting and visual budget progress bar', () => {
      const html = renderToString(<ClientDashboard session={clientSession} />);

      // 5 Plain-Language Financial Cards — honest zeros until portal data loads
      expect(html).toContain('Original Agreed Budget');

      expect(html).toContain('Approved Variations Total');
      expect(html).toContain('Current Approved Budget');
      expect(html).toContain('Total Spent to Date');
      expect(html).toContain('Remaining Balance');

      // Visual budget utilization bar
      expect(html).toContain('Project Budget Utilization');
});

    it('renders the Diaspora Multi-Currency converter controls for overseas property owners', () => {
      const html = renderToString(<ClientDashboard session={clientSession} />);

      expect(html).toContain('Diaspora View:');
      expect(html).toContain('currency-toggle-kes');
      expect(html).toContain('currency-toggle-usd');
      expect(html).toContain('currency-toggle-gbp');
      expect(html).toContain('currency-toggle-eur');
      expect(html).toContain('currency-toggle-aed');
      expect(html).toContain('Base contract currency: Kenyan Shilling (KES)');
});

    it('renders interactive photo evidence gallery with Nairobi GPS tags and lightbox modal opens', () => {
      // 1. Gallery renders with Nairobi GPS coordinates and verification badge
      const galleryHtml = renderToString(
<PhotoEvidenceGallery
          photos={[
            {
              id: 'p-1',
              caption: 'Foundation blinding concrete poured and cured',
              photo_url: '/uploads/evidence/rcp-2026/foundation_blinding_01.jpg',
              latitude: -1.286389,
              longitude: 36.817223,
              captured_at: '2026-02-01T10:30:00.000Z',
              weather: 'SUNNY_CLEAR',
              recorded_by_name: 'David Kimani (Site Supervisor)',
},
          ]}
        />,
);

      expect(galleryHtml).toContain('Verified Photo Evidence Gallery');
      expect(galleryHtml).toContain('Foundation blinding concrete poured and cured');
      expect(galleryHtml).toContain('-1.286389');
      expect(galleryHtml).toContain('36.817223');
      expect(galleryHtml).toContain('Verified');
      expect(galleryHtml).toContain('Inspect Photo →');

      // 2. Lightbox Modal renders with detailed inspection metadata
      const modalHtml = renderToString(
<PhotoLightboxModal
          isOpen={true}
          photo={{
            id: 'p-1',
            caption: 'Foundation blinding concrete poured and cured',
            photo_url: '/uploads/evidence/rcp-2026/foundation_blinding_01.jpg',
            latitude: -1.286389,
            longitude: 36.817223,
            captured_at: '2026-02-01T10:30:00.000Z',
            weather: 'SUNNY_CLEAR',
            recorded_by_name: 'David Kimani (Site Supervisor)',
}}
          onClose={() => {}}
        />,
);

      expect(modalHtml).toContain('Photo Inspection Lightbox');
      expect(modalHtml).toContain('Verified Site Evidence');
      expect(modalHtml).toContain('-1.286389');
      expect(modalHtml).toContain('36.817223');
      expect(modalHtml).toContain('Nairobi, Kenya');
      expect(modalHtml).toContain('SUNNY_CLEAR');
      expect(modalHtml).toContain('David Kimani (Site Supervisor)');
      expect(modalHtml).toContain('Close Lightbox');
});

    it('renders milestone progress timeline with percentage badges and inspector notes', () => {
      const timelineHtml = renderToString(
<MilestoneTimeline
          items={[
            {
              id: 't-1',
              percentage: 100.0,
              notes: 'Bulk earthworks and site hoarding complete.',
              recorded_at: '2026-01-30',
              item_description: 'Milestone 1: Site Possession & Hoarding',
              section_code: 'Section 1: Preliminaries',
},
            {
              id: 't-2',
              percentage: 50.0,
              notes: 'Foundation excavation in fractured bedrock 80% done.',
              recorded_at: '2026-02-15',
              item_description: 'Milestone 2: Substructure Excavation',
              section_code: 'Section 1: Substructure',
},
          ]}
        />,
);

      expect(timelineHtml).toContain('Milestone Progress Timeline');
      expect(timelineHtml).toContain('Milestone 1: Site Possession &amp; Hoarding');
      expect(timelineHtml).toContain('Milestone 2: Substructure Excavation');
      expect(timelineHtml).toContain('Section 1: Preliminaries');
      expect(timelineHtml).toContain('Section 1: Substructure');
      expect(timelineHtml).toContain('100.0%');
      expect(timelineHtml).toContain('50.0%');
      expect(timelineHtml).toContain('Bulk earthworks and site hoarding complete.');
});

    it('ensures variation review actions (approve/reject) are available for Client', () => {
      const html = renderToString(<ClientDashboard session={clientSession} />);

      // Variation management view is embedded with approval capabilities
      expect(html).toContain('Change Orders');
      expect(html).toContain('OWNER REVIEW');

      // Requesting change orders is restricted to contractors/QS
      expect(html).not.toContain('+ New Change Order');
});

    it('displays neutral project health guard card with factual notice and variance metrics', () => {
      const html = renderToString(<ClientDashboard session={clientSession} />);

      // Unhydrated client portal shows honest empty state, never fabricated metrics
      expect(html).toContain('No variance data yet');
});

    it('displays Kenyan standard contract retention terms with 10% deduction and 5% cap', () => {
      const html = renderToString(<ClientDashboard session={clientSession} />);

      // Retention legal copy only renders with hydrated certificate data
      expect(html).not.toContain('KES 2,250,000');
});
});

  describe('Milestone M10: Reports & PDF Export Integration', () => {
    const mockSession = (role: string): AuthSession => ({
      user: {
        id: 'user-m10',
        email: 'test@apexbuilders.co.ke',
        fullName: 'Test User',
        role,
        tenant: {
          id: 'tenant-123',
          name: 'Apex Builders Kenya Ltd',
          slug: 'apex-builders',
          currency: 'KES',
},
},
      permissions: ['project.view', 'report.generate', 'report.view'],
      token: 'mock-token',
});

    it('renders PDF report download buttons in ClientDashboard', () => {
      const html = renderToString(<ClientDashboard session={mockSession('CLIENT')} />);
      expect(html).toContain('Download IPC (PDF)');
      expect(html).toContain('Project Summary (PDF)');
      expect(html).toContain('data-testid="download-ipc-btn"');
      expect(html).toContain('data-testid="download-summary-btn"');
      expect(html).toContain('/reports/ipc');
      expect(html).toContain('/reports/summary');
});

    it('renders PDF report download buttons in PmQsDashboard', () => {
      const html = renderToString(<PmQsDashboard session={mockSession('PM_QS')} />);
      expect(html).toContain('Download IPC (PDF)');
      expect(html).toContain('Project Summary (PDF)');
      expect(html).toContain('data-testid="download-ipc-btn"');
      expect(html).toContain('data-testid="download-summary-btn"');
      expect(html).toContain('/reports/ipc');
      expect(html).toContain('/reports/summary');
});

    it('renders PDF report download buttons in SupervisorDashboard', () => {
      const html = renderToString(<SupervisorDashboard session={mockSession('SITE_SUPERVISOR')} />);
      expect(html).toContain('Daily Diary (PDF)');
      expect(html).toContain('Site Summary (PDF)');
      expect(html).toContain('data-testid="download-site-diary-btn"');
      expect(html).toContain('data-testid="download-summary-btn"');
      expect(html).toContain('/reports/summary');
});
});

  describe('Construction Lifecycle Extensions: RFI Technical Queries Suite', () => {
    it('renders RfiManagementView with RFI register, priority badges, consultant roles, status badges, and elapsed days', () => {
      const rawHtml = renderToString(<RfiManagementView projectId="project-rcp-2026" />);
      const html = rawHtml.replace(/<!-- -->/g, '');

      expect(html).toContain('Request for Information (RFI) Register');
                                    
      // Expandable thread verification
                  
      // Action button
      expect(html).toContain('+ New RFI');
});

    it('renders CreateRfiModal with consultant role dropdown, priority options, drawing ref, and technical query form', () => {
      const html = renderToString(
<CreateRfiModal
          isOpen={true}
          onClose={() => {}}
          projectId="project-rcp-2026"
          projectName="Riverside Commercial Plaza"
        />,
);

      expect(html).toContain('New Request for Information (RFI)');
      expect(html).toContain('RFI Subject / Title');
      expect(html).toContain('Assigned Consultant');
      expect(html).toContain('Priority Level');
      expect(html).toContain('Specification / Drawing Reference');
      expect(html).toContain('Technical Query Narrative');
      expect(html).toContain('Submit RFI to Consultant');
      expect(html).toContain('Architect (Lead Design Consultant)');
      expect(html).toContain('Structural Engineer (BORAQS / EBK)');
});
});

  describe('Construction Lifecycle Extensions: Quality Control & Concrete Cubes Suite', () => {
    it('renders QualityControlView with pre-pour checklist items, PASS/FAIL verification, and location details', () => {
      const html = renderToString(
<QualityControlView
          projectId="project-rcp-2026"
          projectName="Riverside Commercial Plaza"
          defaultTab="checklists"
        />,
);

      expect(html).toContain('Pre-Pour Hold Points &amp; Concrete Cube Crushing');
      expect(html).toContain('Pre-Pour Inspection Checklists');
      expect(html).toContain('Concrete Cube Crushing Tests');

      // Active checklist details
                        
      // Interactive items table with pass/fail toggles
                                    });

    it('renders QualityControlView concrete cube tests with 7-day break, 28-day scheduled break, MPa gauge, and 25 MPa pass badge', () => {
      const rawHtml = renderToString(
<QualityControlView
          projectId="project-rcp-2026"
          projectName="Riverside Commercial Plaza"
          defaultTab="cube-tests"
        />,
);
      const html = rawHtml.replace(/<!-- -->/g, '');

      expect(html).toContain('Concrete Cube Crushing Tests');
      expect(html).toContain('KS 02-598 Testing Protocol');
                                          expect(html).toContain('+ Log Cube Test');
});

    it('renders ConcreteCubeTestModal with pour location, concrete class dropdown, batch ticket, and MPa break inputs', () => {
      const html = renderToString(
<ConcreteCubeTestModal
          isOpen={true}
          onClose={() => {}}
          projectId="project-rcp-2026"
          projectName="Riverside Commercial Plaza"
        />,
);

      expect(html).toContain('Log Concrete Cube Crushing Test');
      expect(html).toContain('Pour Structural Location');
      expect(html).toContain('Concrete Class &amp; Target');
      expect(html).toContain('Pour Date');
      expect(html).toContain('Batch Delivery Ticket #');
      expect(html).toContain('Site Slump Result (mm)');
      expect(html).toContain('7-Day Test Strength (MPa)');
      expect(html).toContain('28-Day Final Strength (MPa)');
      expect(html).toContain('Record Cube Test');
});
});

  describe('Construction Lifecycle Extensions: Practical Completion Snagging Suite', () => {
    it('renders SnaggingListView with spatial location breadcrumbs, trade categories, severity badges, and status counters', () => {
      const html = renderToString(<SnaggingListView projectId="project-rcp-2026" />);

      expect(html).toContain('Defects Snagging Punch List Register');
                                          
      // SNG-002
                        
      // Geotag pin and photos
                              
      // Buttons
      expect(html).toContain('+ Add Snag Item');
            });

    it('renders CreateSnagModal with spatial zoning hierarchy (Block, Floor, Room), trade dropdown, severity levels, and GPS inputs', () => {
      const html = renderToString(
<CreateSnagModal
          isOpen={true}
          onClose={() => {}}
          projectId="project-rcp-2026"
          projectName="Riverside Commercial Plaza"
        />,
);

      expect(html).toContain('Add Snagging Item');
      expect(html).toContain('Spatial Zoning (Block → Floor → Room)');
      expect(html).toContain('Block / Wing');
      expect(html).toContain('Floor Level');
      expect(html).toContain('Room / Zone');
      expect(html).toContain('Trade Category');
      expect(html).toContain('Severity Level');
      expect(html).toContain('Defect Description');
      expect(html).toContain('GPS Latitude');
      expect(html).toContain('GPS Longitude');
});
});

  describe('Construction Lifecycle Extensions: Practical Completion & Retention Release Card Suite', () => {
    it('renders PracticalCompletionCard with Certificate of Practical Completion, BORAQS registration numbers, and issue date', () => {
      const rawHtml = renderToString(
<PracticalCompletionCard
          projectName="Riverside Commercial Plaza"
          projectCode="RCP-2026"
          practicalCompletionDate="2026-10-15"
          architectName="Arch. Peter M. Mwangi"
          architectBoraqsNo="A-742"
          qsName="Qs. Faith Achieng"
          qsBoraqsNo="Q-819"
        />,
);
      const html = rawHtml.replace(/<!-- -->/g, '');

      expect(html).toContain('Practical Completion &amp; Retention Release Card');
      expect(html).toContain('Certificate of Practical Completion');
      expect(html).toContain('ISSUED');
      expect(html).toContain('Arch. Peter M. Mwangi');
      expect(html).toContain('BORAQS Reg. No. A-742');
      expect(html).toContain('Qs. Faith Achieng');
      expect(html).toContain('BORAQS Reg. No. Q-819');
});

    it('displays First Moiety (50%) retention release formatted in KES', () => {
      const rawHtml = renderToString(
<PracticalCompletionCard
          projectName="Riverside Commercial Plaza"
          projectCode="RCP-2026"
          contractSum="45000000.00"
          firstMoietyReleased={true}
          firstMoietyAmount="1125000.00"
        />,
);
      const html = rawHtml.replace(/<!-- -->/g, '');

      expect(html).toContain('First Moiety (50%)');
      expect(html).toContain('KES 1,125,000');
      expect(html).toContain('RELEASED');
      expect(html).toContain('Released to Contractor ');
      expect(html).toContain('IPC #10-FIN-RET1');
});

    it('displays 6-Month Defects Liability Period (DLP) countdown and days remaining', () => {
      const rawHtml = renderToString(
<PracticalCompletionCard
          projectName="Riverside Commercial Plaza"
          practicalCompletionDate="2026-10-15"
          dlpDaysRemaining={124}
          dlpExpiryDate="15 April 2027"
        />,
);
      const html = rawHtml.replace(/<!-- -->/g, '');

      expect(html).toContain('6-Month Defects Liability Period (DLP) Countdown');
      expect(html).toContain('124 Days Remaining');
      expect(html).toContain('Expires 15 April 2027');
      expect(html).toContain('Contractor Statutory Obligation');
});

    it('displays Certificate of Making Good Defects and Second Moiety escrow status', () => {
      const rawHtml = renderToString(
<PracticalCompletionCard
          projectName="Riverside Commercial Plaza"
          practicalCompletionDate="2026-10-15"
          dlpExpiryDate="10 April 2027"
          secondMoietyStatus="HELD_IN_ESCROW"
          secondMoietyAmount="1125000.00"
        />,
);
      const html = rawHtml.replace(/<!-- -->/g, '');

      expect(html).toContain('Certificate of Making Good Defects');
      expect(html).toContain('PENDING FINAL INSPECTION');
      expect(html).toContain('10 April 2027');
      expect(html).toContain('Second Moiety (Final 50%)');
      expect(html).toContain('HELD IN ESCROW');
});
});

  describe('Construction Lifecycle Extensions: Multi-Role Dashboard Embeddings', () => {
    const mockSessionForRole = (role: string): AuthSession => ({
      user: {
        id: `user-${role.toLowerCase()}`,
        email: `${role.toLowerCase()}@apexbuilders.co.ke`,
        fullName: `${role} User`,
        role,
        tenant: {
          id: 'tenant-123',
          name: 'Apex Builders Kenya Ltd',
          slug: 'apex-builders',
          currency: 'KES',
},
},
      permissions: ['project.view', 'cost.approve', 'variation.approve'],
      token: 'mock-token',
});

    it('embeds RfiManagementView, QualityControlView, and PracticalCompletionCard into PmQsDashboard', () => {
      const html = renderToString(<PmQsDashboard session={mockSessionForRole('PM_QS')} />);

      expect(html).toContain('Request for Information (RFI) Register');
      expect(html).toContain('Pre-Pour Hold Points &amp; Concrete Cube Crushing');
      expect(html).toContain('Practical Completion &amp; Retention Release Card');
});

    it('embeds QualityControlView and SnaggingListView into SupervisorDashboard', () => {
      const html = renderToString(<SupervisorDashboard session={mockSessionForRole('SITE_SUPERVISOR')} />);

      expect(html).toContain('Pre-Pour Hold Points &amp; Concrete Cube Crushing');
      expect(html).toContain('Defects Snagging Punch List Register');
});

    it('embeds PracticalCompletionCard and SnaggingListView into ClientDashboard with verification capability', () => {
      const html = renderToString(<ClientDashboard session={mockSessionForRole('CLIENT')} />);

      expect(html).toContain('Practical Completion &amp; Retention Release Card');
      expect(html).toContain('Defects Snagging Punch List Register');
            expect(html).not.toContain('+ Add Snag Item');
});
});

  describe('External Stakeholder Portals (Token Architecture)', () => {
    it('renders ConsultantPortalView with token access, pending RFIs, cube strength tests, and pre-pour QA', () => {
      const rawHtml = renderToString(
<ConsultantPortalView
          token="test-consultant-token"
          stakeholderName="Arch. Peter Mwangi"
          stakeholderRole="Lead Project Architect (BORAQS Reg: A-742)"
          projectName="Riverside Commercial Plaza"
          projectCode="RCP-2026"
        />
);
      const html = rawHtml.replace(/<!-- -->/g, '');

      // Portal now loads real data via /api/v1/portals/consultant/:token —
      // SSR render shows the loading state; data assertions live in e2e.
      expect(html).toContain('Loading portal');
});

    it('renders SubcontractorPortalView with trade-filtered snags and defect rectification form', () => {
      const rawHtml = renderToString(
<SubcontractorPortalView
          token="test-sub-token"
          subcontractorName="Simba Plumbing Works Ltd"
          subcontractorTrade="Specialist Sanitary &amp; Drainage Subcontractor"
          projectName="Riverside Commercial Plaza"
          projectCode="RCP-2026"
        />
);
      const html = rawHtml.replace(/<!-- -->/g, '');

      expect(html).toContain('Loading portal');
});

    it('renders SupplierPortalView with batch delivery schedule, docket numbers, and receiving logs', () => {
      const rawHtml = renderToString(
<SupplierPortalView
          token="test-supplier-token"
          supplierName="Bamburi Ready-Mix Nairobi Plant"
          supplierCategory="Ready-Mix Concrete &amp; Aggregates Supplier"
          projectName="Riverside Commercial Plaza"
          projectCode="RCP-2026"
        />
);
      const html = rawHtml.replace(/<!-- -->/g, '');

      expect(html).toContain('Loading portal');
});

    it('renders CompliancePortalView with NCA registration, statutory levy, supervisor accreditation, and cube pass rate', () => {
      const rawHtml = renderToString(
<CompliancePortalView
          token="test-compliance-token"
          auditorName="Eng. Faith Mutua"
          auditorAgency="National Construction Authority (NCA) / Nairobi County Planning"
          projectName="Riverside Commercial Plaza"
          projectCode="RCP-2026"
        />
);
      const html = rawHtml.replace(/<!-- -->/g, '');

      expect(html).toContain('Loading portal');
});

    it('renders PortalAccessLinkManager shell — links load from the API, no fabricated rows', () => {
      const rawHtml = renderToString(
<PortalAccessLinkManager projectId="project-rcp-2026" />
);
      const html = rawHtml.replace(/<!-- -->/g, '');

      // SSR render shows the loading state — real links arrive via fetch.
      // No fabricated stakeholder names or tokens may appear.
      expect(html).toContain('External Stakeholder Portals');
      expect(html).toContain('Loading portal links');
      expect(html).not.toContain('Arch. Peter Mwangi');
      expect(html).not.toContain('Simba Plumbing Works Ltd');
      expect(html).not.toContain('mockToken');
});

    it('allows unauthenticated stakeholder entry into Consultant portal via App component with initialPortal', () => {
      const rawHtml = renderToString(
<App initialPortal={{ type: 'consultant', token: 'ext-token-123'}} />
);
      const html = rawHtml.replace(/<!-- -->/g, '');

      expect(html).toContain('Loading portal');
      expect(html).not.toContain('Sign in to access your project workspace');
});

    it('embeds PortalAccessLinkManager into PmQsDashboard and CompanyAdminDashboard', () => {
      const pmSession: AuthSession = {
        user: {
          id: 'user-pm',
          email: 'pm@apexbuilders.co.ke',
          fullName: 'PM User',
          role: 'PM_QS',
          tenant: { id: 'tenant-123', name: 'Apex Builders Kenya Ltd', slug: 'apex', currency: 'KES'},
},
        permissions: ['project.view'],
        token: 'token',
};

      const adminSession: AuthSession = {
        user: {
          id: 'user-admin',
          email: 'admin@apexbuilders.co.ke',
          fullName: 'Admin User',
          role: 'COMPANY_ADMIN',
          tenant: { id: 'tenant-123', name: 'Apex Builders Kenya Ltd', slug: 'apex', currency: 'KES'},
},
        permissions: ['company.manage'],
        token: 'token',
};

      const pmHtml = renderToString(<PmQsDashboard session={pmSession} />).replace(/<!-- -->/g, '');
      expect(pmHtml).toContain('External Stakeholder Portals');
      expect(pmHtml).toContain('Stakeholder Portals');

      const adminHtml = renderToString(<CompanyAdminDashboard session={adminSession} />).replace(/<!-- -->/g, '');
      expect(adminHtml).toContain('External Stakeholder Portals');
});
});

  // ---------------------------------------------------------------------------
  // MILESTONE M11: OPERATIONS SUITE FRONTEND COMPONENTS 
  // ---------------------------------------------------------------------------
  describe('Milestone M11: Operations Suite Frontend Components ', () => {
    it('renders ProjectScheduleGanttView with WBS phases, tasks, and progress indicators', () => {
      const html = renderToString(
<ProjectScheduleGanttView projectId="test-proj-1" />
).replace(/<!-- -->/g, '');

      expect(html).toContain('Project Master Schedule');
      expect(html).toContain('WBS &amp; GANTT');
      expect(html).toContain('Overall Progress');
      expect(html).toContain('Site Clearance &amp; Bulk Excavation');
      expect(html).toContain('Reinforced Concrete Foundation Footings');
      expect(html).toContain('Steel Fixers &amp; Masons');
      expect(html).toContain('+ Add Schedule Task');
});

    it('renders SiteInventoryManagementView with store stock cards, low-stock warnings, and valuation', () => {
      const html = renderToString(
<SiteInventoryManagementView projectId="test-proj-1" />
).replace(/<!-- -->/g, '');

      expect(html).toContain('Site Materials &amp; Store Inventory');
            expect(html).toContain('Reorder Alerts');
      expect(html).toContain('Store Valuation (KES)');
      expect(html).toContain('Record Inward Delivery');
      expect(html).toContain('Record Usage Out');
      expect(html).toContain('Recent Material Inward / Outward Movement Audit Log');
});

    it('renders SafetyIncidentLogView with OSHA 2007 classification, severity, and CAPA actions', () => {
      const html = renderToString(
<SafetyIncidentLogView projectId="test-proj-1" />
).replace(/<!-- -->/g, '');

      expect(html).toContain('Safety, Health &amp; Environment (HSE) Register');
      expect(html).toContain('OSHA 2007 &amp; NCA');
      expect(html).toContain('Log Safety Incident');
      expect(html).toContain('Lost Time Injuries (LTI)');
                  });

    it('renders ProjectDocumentVaultView with architectural/structural registers and revision codes', () => {
      const html = renderToString(
<ProjectDocumentVaultView projectId="test-proj-1" />
).replace(/<!-- -->/g, '');

      expect(html).toContain('Project Drawing &amp; Document Vault');
                                    expect(html).toContain('Upload Drawing / Document');
});

    it('renders SubcontractorManagementView with trade contracts, KES commitments, and Kenyan retention rates', () => {
      const html = renderToString(
<SubcontractorManagementView projectId="test-proj-1" />
).replace(/<!-- -->/g, '');

      expect(html).toContain('Subcontractor Work Packages &amp; Directory');
                  expect(html).toContain('Total Subcontract Commitments');
                  expect(html).toContain('Award Subcontract Package');
});

    it('verifies that PmQsDashboard includes all 5 new operations modules in navigation tabs and views', () => {
      const pmSession: AuthSession = {
        user: {
          id: 'user-pm',
          email: 'pm@apexbuilders.co.ke',
          fullName: 'PM User',
          role: 'PM_QS',
          tenant: { id: 'tenant-123', name: 'Apex Builders Kenya Ltd', slug: 'apex', currency: 'KES'},
},
        permissions: ['project.view'],
        token: 'token',
};

      const html = renderToString(<PmQsDashboard session={pmSession} />).replace(/<!-- -->/g, '');
      expect(html).toContain(' Schedule &amp; Gantt');
      expect(html).toContain(' Site Inventory');
      expect(html).toContain(' Subcontractors');
      expect(html).toContain(' Drawings Vault');
      expect(html).toContain(' HSE &amp; Safety');
      expect(html).toContain('Project Master Schedule');
      expect(html).toContain('Site Materials &amp; Store Inventory');
      expect(html).toContain('Safety, Health &amp; Environment (HSE) Register');
      expect(html).toContain('Project Drawing &amp; Document Vault');
      expect(html).toContain('Subcontractor Work Packages &amp; Directory');
      expect(html).toContain(' Weather &amp; EOT');
      expect(html).toContain(' KRA WHT / WHVAT');
});

    it('renders WeatherDelayClaimsView with meteorological station proofs, claimed days, and LAD financial relief', () => {
      const html = renderToString(
<WeatherDelayClaimsView projectId="test-proj-1" />
).replace(/<!-- -->/g, '');

      expect(html).toContain('Weather Delays &amp; Extension of Time (EOT) Register');
      expect(html).toContain('JBC 1999 CLAUSE 25 &amp; 32');
      expect(html).toContain('El Niño Flash Flooding &amp; Foundation Trench Inundation');
      expect(html).toContain('Dagoretti Corner Meteorological Station');
      expect(html).toContain('Certified 10 days extension under JBC 1999 Clause 25.1(b)');
      expect(html).toContain('LAD Financial Relief');
      expect(html).toContain('Submit EOT Delay Claim');
});

    it('renders StatutoryTaxManagementView with KRA Cap 470 3% WHT, 2% WHVAT, and iTax status', () => {
      const html = renderToString(
<StatutoryTaxManagementView projectId="test-proj-1" />
).replace(/<!-- -->/g, '');

      expect(html).toContain('Statutory Tax &amp; Withholding Certificates');
      expect(html).toContain('KRA CAP 470 (WHT &amp; WHVAT)');
      expect(html).toContain('No withholding certificates recorded yet.');
});

    it('embeds StatutoryTaxManagementView into CompanyAdminDashboard for executive compliance review', () => {
      const adminSession: AuthSession = {
        user: {
          id: 'user-admin',
          email: 'admin@apexbuilders.co.ke',
          fullName: 'Admin User',
          role: 'COMPANY_ADMIN',
          tenant: { id: 'tenant-123', name: 'Apex Builders Kenya Ltd', slug: 'apex', currency: 'KES'},
},
        permissions: ['company.manage'],
        token: 'token',
};

      const html = renderToString(<CompanyAdminDashboard session={adminSession} />).replace(/<!-- -->/g, '');
      expect(html).toContain('Statutory Tax &amp; Withholding Certificates');
      expect(html).toContain('KRA CAP 470 (WHT &amp; WHVAT)');
});
});

  describe('Milestones M13, M14 & M15: Commercial Operations, Wastage Variance, S-Curve & Subcontractor Valuations', () => {
    it('renders MaterialRequisitionView with item descriptions, calculated commitment, and urgency badges', () => {
      const html = renderToString(
<MaterialRequisitionView projectId="test-proj-1" />
).replace(/<!-- -->/g, '');

      expect(html).toContain('Site Material Requisitions &amp; Orders');
      expect(html).toContain('REQ-2026-001');
            expect(html).toContain('KES 234,000');
      expect(html).toContain('HIGH');
      expect(html).toContain('New Material Request');
});

    it('renders MaterialWastageVarianceCard with theoretical vs actual consumption, allowable tolerance, and financial loss', () => {
      const html = renderToString(
<MaterialWastageVarianceCard projectId="test-proj-1" />
).replace(/<!-- -->/g, '');

      expect(html).toContain('Material Wastage &amp; Shrinkage Engine');
      expect(html).toContain('BS 8110 / Eurocode 2');
            expect(html).toContain('Standard Tolerance');
      expect(html).toContain('D16 High-Yield Rebar (Y16)');
      expect(html).toContain('Critical Unexplained Loss');
      expect(html).toContain('KES 238,000');
      expect(html).toContain('Log Wastage Takeoff');
});

    it('renders ProjectSCurveCashFlowCard with EVM metrics (CPI, SPI, EAC) and SVG S-Curve visualization', () => {
      const html = renderToString(
<ProjectSCurveCashFlowCard projectId="test-proj-1" />
).replace(/<!-- -->/g, '');

      expect(html).toContain('Project Cash Flow &amp; S-Curve Forecasting');
      expect(html).toContain('Cost Performance (CPI)');
      expect(html).toContain('Schedule Index (SPI)');
      expect(html).toContain('Planned Value (PV)');
      expect(html).toContain('Earned Value (EV)');
      expect(html).toContain('Actual Cost (AC)');
      expect(html).toContain('Net Cash Flow (Liquidity)');
      expect(html).toContain('Record Monthly Valuation');
});

    it('renders SubcontractorValuationView with JBC 1999 10% retention, 3% KRA WHT, and net payable calculations', () => {
      const html = renderToString(
<SubcontractorValuationView projectId="test-proj-1" />
).replace(/<!-- -->/g, '');

      expect(html).toContain('Subcontractor Valuations &amp; Retention Ledger');
      expect(html).toContain('JBC 1999 Agreement and Conditions of Sub-Contract');
                                                expect(html).toContain('New Subcontractor Claim');
});

    it('embeds all 4 commercial modules into PmQsDashboard with navigation tabs', () => {
      const pmSession: AuthSession = {
        user: {
          id: 'user-pm',
          email: 'qs@apexbuilders.co.ke',
          fullName: 'David Kiprono',
          role: 'PM_QS',
          tenant: { id: 'tenant-123', name: 'Apex Builders Kenya Ltd', slug: 'apex', currency: 'KES'},
},
        permissions: ['project.view', 'boq.manage', 'cost.manage'],
        token: 'token',
};

      const html = renderToString(<PmQsDashboard session={pmSession} />).replace(/<!-- -->/g, '');
      expect(html).toContain(' Material Requisitions');
      expect(html).toContain(' Wastage Variance');
      expect(html).toContain(' Cash Flow &amp; S-Curve');
      expect(html).toContain(' Subcontractor Valuations');
      expect(html).toContain('Site Material Requisitions &amp; Orders');
      expect(html).toContain('Material Wastage &amp; Shrinkage Engine');
      expect(html).toContain('Project Cash Flow &amp; S-Curve Forecasting');
      expect(html).toContain('Subcontractor Valuations &amp; Retention Ledger');
});

    it('embeds Cash Flow S-Curve and Subcontractor Valuations into CompanyAdminDashboard', () => {
      const adminSession: AuthSession = {
        user: {
          id: 'user-admin',
          email: 'admin@apexbuilders.co.ke',
          fullName: 'Admin User',
          role: 'COMPANY_ADMIN',
          tenant: { id: 'tenant-123', name: 'Apex Builders Kenya Ltd', slug: 'apex', currency: 'KES'},
},
        permissions: ['company.manage'],
        token: 'token',
};

      const html = renderToString(<CompanyAdminDashboard session={adminSession} />).replace(/<!-- -->/g, '');
      expect(html).toContain('Project Cash Flow &amp; S-Curve Forecasting');
      expect(html).toContain('Subcontractor Valuations &amp; Retention Ledger');
});

    it('embeds Material Requisitions and Wastage Variance into SupervisorDashboard', () => {
      const superSession: AuthSession = {
        user: {
          id: 'user-super',
          email: 'supervisor@apexbuilders.co.ke',
          fullName: 'Site Supervisor',
          role: 'SITE_SUPERVISOR',
          tenant: { id: 'tenant-123', name: 'Apex Builders Kenya Ltd', slug: 'apex', currency: 'KES'},
},
        permissions: ['site.diary', 'cost.create'],
        token: 'token',
};

      const html = renderToString(<SupervisorDashboard session={superSession} />).replace(/<!-- -->/g, '');
      expect(html).toContain('Site Material Requisitions &amp; Orders');
      expect(html).toContain('Material Wastage &amp; Shrinkage Engine');
});
});

  describe('Milestones M16, M17 & M18: Plant Equipment, Labor Muster Roll & Safety Audits UI Suite', () => {
    it('renders PlantEquipmentView with machinery registry, fuel burn rate and siphoning alerts', () => {
      const html = renderToString(
<PlantEquipmentView
          projectId="proj-test-1"
          projectName="Kilimani Heavy Site"
        />
).replace(/<!-- -->/g, '');

      expect(html).toContain('Plant &amp; Heavy Equipment Manager');
      expect(html).toContain('Total Machinery Fleet');
      expect(html).toContain('Cumulative Operating Hours');
      expect(html).toContain('Fuel Discrepancy Risk Flags');
      expect(html).toContain('CAT 320D Hydraulic Excavator');
      expect(html).toContain('Excavators, Mixers, Cranes, Gensets');
      expect(html).toContain('+ Register Plant Machine');
      expect(html).toContain('+ Log Daily Hours &amp; Fuel');
});

    it('renders LaborMusterRollView with Kenyan National ID validation, Fundis/Casuals count and M-Pesa payroll', () => {
      const html = renderToString(
<LaborMusterRollView
          projectId="proj-test-1"
          projectName="Kilimani Heavy Site"
        />
).replace(/<!-- -->/g, '');

      expect(html).toContain('Site Casual Labor Muster Roll &amp; Artisan Payroll');
      expect(html).toContain('100% Kenyan National ID Verified');
      expect(html).toContain('M-Pesa B2C Bulk Mobile Payroll');
      expect(html).toContain('MR-WK44-001');
      expect(html).toContain('MPESA-B2C-PAYROLL-882910');
      expect(html).toContain('+ Register Artisan / Casual');
      expect(html).toContain('+ Compile Weekly Muster Roll');
});

    it('renders SafetyAuditScorecardView with DOSHS/NCA scorecards and stop-work order triggers', () => {
      const html = renderToString(
<SafetyAuditScorecardView
          projectId="proj-test-1"
          projectName="Kilimani Heavy Site"
        />
).replace(/<!-- -->/g, '');

      expect(html).toContain('Field Safety &amp; DOSHS/NCA Compliance Scorecards');
      expect(html).toContain('Average Compliance Score');
      expect(html).toContain('Satisfactory Inspections');
      expect(html).toContain('Auditing Authority Coverage');
      expect(html).toContain('HSE Officer Wanjiku Kariuki');
      expect(html).toContain('+ Record Field Safety Audit');
});

    it('embeds Plant Equipment, Labor Muster Roll and Safety Audits into PmQsDashboard', () => {
      const pmSession: AuthSession = {
        user: {
          id: 'user-pm',
          email: 'pm@apexbuilders.co.ke',
          fullName: 'Project Manager / QS',
          role: 'PM_QS',
          tenant: { id: 'tenant-123', name: 'Apex Builders Kenya Ltd', slug: 'apex', currency: 'KES'},
},
        permissions: ['cost.manage', 'site.manage'],
        token: 'token',
};

      const html = renderToString(<PmQsDashboard session={pmSession} />).replace(/<!-- -->/g, '');
      expect(html).toContain(' Plant &amp; Machinery');
      expect(html).toContain(' Labor Muster Roll');
      expect(html).toContain(' Field Safety Scorecard');
      expect(html).toContain('Plant &amp; Heavy Equipment Manager');
      expect(html).toContain('Site Casual Labor Muster Roll &amp; Artisan Payroll');
      expect(html).toContain('Field Safety &amp; DOSHS/NCA Compliance Scorecards');
});

    it('embeds Plant Equipment, Labor Muster Roll and Safety Audits into SupervisorDashboard', () => {
      const superSession: AuthSession = {
        user: {
          id: 'user-super',
          email: 'supervisor@apexbuilders.co.ke',
          fullName: 'Site Supervisor',
          role: 'SITE_SUPERVISOR',
          tenant: { id: 'tenant-123', name: 'Apex Builders Kenya Ltd', slug: 'apex', currency: 'KES'},
},
        permissions: ['site.diary', 'cost.create'],
        token: 'token',
};

      const html = renderToString(<SupervisorDashboard session={superSession} />).replace(/<!-- -->/g, '');
      expect(html).toContain('Plant &amp; Heavy Equipment Manager');
      expect(html).toContain('Site Casual Labor Muster Roll &amp; Artisan Payroll');
      expect(html).toContain('Field Safety &amp; DOSHS/NCA Compliance Scorecards');
});

    it('embeds Plant Equipment, Labor Muster Roll and Safety Audits into CompanyAdminDashboard', () => {
      const adminSession: AuthSession = {
        user: {
          id: 'user-admin',
          email: 'admin@apexbuilders.co.ke',
          fullName: 'Admin User',
          role: 'COMPANY_ADMIN',
          tenant: { id: 'tenant-123', name: 'Apex Builders Kenya Ltd', slug: 'apex', currency: 'KES'},
},
        permissions: ['company.manage'],
        token: 'token',
};

      const html = renderToString(<CompanyAdminDashboard session={adminSession} />).replace(/<!-- -->/g, '');
      expect(html).toContain('Plant &amp; Heavy Equipment Manager');
      expect(html).toContain('Site Casual Labor Muster Roll &amp; Artisan Payroll');
      expect(html).toContain('Field Safety &amp; DOSHS/NCA Compliance Scorecards');
});
});

  describe('Milestones M19, M20 & M21: Enterprise Operations Suite (e-TIMS, WhatsApp, Retention & Bonds)', () => {
    it('renders ETimsTaxComplianceView with KRA VSCU invoice metrics, QR preview and TCC status', () => {
      const html = renderToString(
<ETimsTaxComplianceView
          projectId="proj-test-1"
          projectName="Riverside Commercial Plaza"
        />
).replace(/<!-- -->/g, '');

      expect(html).toContain('KRA e-TIMS Tax Compliance Engine');
      expect(html).toContain('Electronic Tax Invoices &amp; TCC Ledger');
      expect(html).toContain('Total e-TIMS Invoices');
      expect(html).toContain('Taxable Construction Turnover');
      expect(html).toContain('16% VAT Collected');
      expect(html).toContain('INV-2026-001');
      expect(html).toContain('KRAVSCU010000000084');
      expect(html).toContain('Generate e-TIMS Invoice');
      expect(html).toContain('Verify Subcontractor TCC');
});

    it('renders WhatsAppSiteWebhookView with inbound feed, Swahili bot auto-reply and emergency alert status', () => {
      const html = renderToString(
<WhatsAppSiteWebhookView
          projectId="proj-test-1"
          projectName="Riverside Commercial Plaza"
        />
).replace(/<!-- -->/g, '');

      expect(html).toContain('WhatsApp Site Ops Bot &amp; Webhook Engine');
      expect(html).toContain('Field WhatsApp Bot &amp; Incident Dispatch');
      expect(html).toContain('WhatsApp Messages Processed');
      expect(html).toContain('Foreman Kiprono');
      expect(html).toContain('#DIARY 14 masons, 22 casuals on site');
      expect(html).toContain('Rekodi ya Site Diary imepokelewa na kuwekwa kwa mfumo');
      expect(html).toContain('Simulate Inbound WhatsApp');
      expect(html).toContain('Broadcast Safety Alert');
});

    it('renders RetentionAndBondsView with JBC 1999 dual-moiety retention and commercial bank bonds', () => {
      const html = renderToString(
<RetentionAndBondsView
          projectId="proj-test-1"
          projectName="Riverside Commercial Plaza"
        />
).replace(/<!-- -->/g, '');

      expect(html).toContain('Subcontractor Retention &amp; Bank Bonds Engine');
      expect(html).toContain('Retention Releases &amp; Performance Bonds');
      expect(html).toContain('Subcontract Retention Held');
      expect(html).toContain('Active Performance Bonds');
      expect(html).toContain('RET-REL-001');
      expect(html).toContain('Nairobi Volt Electricals Ltd');
      expect(html).toContain('1st Moiety (PC)');
      expect(html).toContain('Disburse M-Pesa B2C');
      expect(html).toContain('Issue Retention Release');
      expect(html).toContain('Register Bank Bond');
});

    it('embeds e-TIMS, WhatsApp and Retention/Bonds into PmQsDashboard', () => {
      const pmSession: AuthSession = {
        user: {
          id: 'user-pm',
          email: 'pm@apexbuilders.co.ke',
          fullName: 'Project Manager / QS',
          role: 'PM_QS',
          tenant: { id: 'tenant-123', name: 'Apex Builders Kenya Ltd', slug: 'apex', currency: 'KES'},
},
        permissions: ['cost.manage', 'site.manage'],
        token: 'token',
};

      const html = renderToString(<PmQsDashboard session={pmSession} />).replace(/<!-- -->/g, '');
      expect(html).toContain(' KRA e-TIMS Invoices');
      expect(html).toContain(' WhatsApp Site Bot');
      expect(html).toContain(' Retention &amp; Bonds');
      expect(html).toContain('KRA e-TIMS Tax Compliance Engine');
      expect(html).toContain('WhatsApp Site Ops Bot &amp; Webhook Engine');
      expect(html).toContain('Subcontractor Retention &amp; Bank Bonds Engine');
});

    it('embeds WhatsApp Site Webhook into SupervisorDashboard', () => {
      const superSession: AuthSession = {
        user: {
          id: 'user-super',
          email: 'supervisor@apexbuilders.co.ke',
          fullName: 'Site Supervisor',
          role: 'SITE_SUPERVISOR',
          tenant: { id: 'tenant-123', name: 'Apex Builders Kenya Ltd', slug: 'apex', currency: 'KES'},
},
        permissions: ['site.diary', 'cost.create'],
        token: 'token',
};

      const html = renderToString(<SupervisorDashboard session={superSession} />).replace(/<!-- -->/g, '');
      expect(html).toContain('WhatsApp Site Ops Bot &amp; Webhook Engine');
      expect(html).toContain('Field WhatsApp Bot &amp; Incident Dispatch');
});

    it('embeds e-TIMS and Retention/Bonds into CompanyAdminDashboard', () => {
      const adminSession: AuthSession = {
        user: {
          id: 'user-admin',
          email: 'admin@apexbuilders.co.ke',
          fullName: 'Admin User',
          role: 'COMPANY_ADMIN',
          tenant: { id: 'tenant-123', name: 'Apex Builders Kenya Ltd', slug: 'apex', currency: 'KES'},
},
        permissions: ['company.manage'],
        token: 'token',
};

      const html = renderToString(<CompanyAdminDashboard session={adminSession} />).replace(/<!-- -->/g, '');
      expect(html).toContain('KRA e-TIMS Tax Compliance Engine');
      expect(html).toContain('Subcontractor Retention &amp; Bank Bonds Engine');
});
});

  describe('Milestones M22, M23 & M24: Platform Services, Site Geofencing & IoT Telematics Suite', () => {
    it('renders SubscriptionBillingView with Safaricom Daraja STK Push, metrics, and plan tiers', () => {
      const html = renderToString(
<SubscriptionBillingView
          tenantName="Apex Builders Kenya Ltd"
          subscriptionState="ACTIVE"
          activePlan="PORTFOLIO_TIER"
          monthlyFeeKes="25000.00"
          daysRemaining={26}
          lastPaymentRef="NL88491023"
        />
).replace(/<!-- -->/g, '');

      expect(html).toContain('Safaricom Daraja M-Pesa Subscription Billing');
      expect(html).toContain('Pay / Upgrade with M-Pesa');
      expect(html).toContain('Portfolio Tier');
      expect(html).toContain('Project Tier');
      expect(html).toContain('26 Days');
      expect(html).toContain('Unlimited');
      expect(html).toContain('NL88491023');
      expect(html).toContain('Daraja M-Pesa Subscription Transactions');
});

    it('renders GeofencedClockInView with Haversine distance calculator, on-site verified and flagged violations', () => {
      const html = renderToString(
<GeofencedClockInView
          projectName="Upper Hill Commercial Tower"
        />
).replace(/<!-- -->/g, '');

      expect(html).toContain('Project Geofencing &amp; Biometric Attendance');
      expect(html).toContain('GEOFENCE ENFORCED');
      expect(html).toContain('Configure Geofence Perimeter');
      expect(html).toContain('Mobile Biometric / GPS Clock-In Simulator');
      expect(html).toContain('Main Gate (~15m)');
      expect(html).toContain('Perimeter (~110m)');
      expect(html).toContain('Off-Site (~2.5km)');
      expect(html).toContain('Calculated Haversine Distance:');
      expect(html).toContain('VERIFIED ON-SITE');
      expect(html).toContain('OFF-SITE FLAGGED');
      expect(html).toContain('Site Muster Roll Geofence Attendance Feed');
});

    it('renders PlantTelematicsView with machinery fleet IoT telemetry, live fuel meters, and sudden diesel siphoning anomaly alert', () => {
      const html = renderToString(
<PlantTelematicsView
          projectName="Upper Hill Commercial Tower"
        />
).replace(/<!-- -->/g, '');

      expect(html).toContain('Plant GPS Telematics &amp; Remote Fuel Flow Ingestion');
      expect(html).toContain('IOT ACTIVE');
      expect(html).toContain('Register Telematics Hardware');
      expect(html).toContain('Critical Fuel Discrepancy Flagged');
      expect(html).toContain('Simulate 40L Rapid Fuel Drop');
      expect(html).toContain('DIESEL DISCREPANCY FLAG');
      expect(html).toContain('NORMAL BURN');
      expect(html).toContain('Machinery IoT Telemetry Feed &amp; Fuel Flow Log');
});

    it('embeds SubscriptionBillingView into CompanyAdminDashboard', () => {
      const adminSession: AuthSession = {
        user: {
          id: 'user-admin',
          email: 'admin@apexbuilders.co.ke',
          fullName: 'Admin User',
          role: 'COMPANY_ADMIN',
          tenant: { id: 'tenant-123', name: 'Apex Builders Kenya Ltd', slug: 'apex', currency: 'KES'},
},
        permissions: ['company.manage'],
        token: 'token',
};

      const html = renderToString(<CompanyAdminDashboard session={adminSession} />).replace(/<!-- -->/g, '');
      expect(html).toContain('Safaricom Daraja M-Pesa Subscription Billing');
      expect(html).toContain('Pay / Upgrade with M-Pesa');
});

    it('embeds GeofencedClockInView and PlantTelematicsView into SupervisorDashboard', () => {
      const superSession: AuthSession = {
        user: {
          id: 'user-super',
          email: 'supervisor@apexbuilders.co.ke',
          fullName: 'Site Supervisor',
          role: 'SITE_SUPERVISOR',
          tenant: { id: 'tenant-123', name: 'Apex Builders Kenya Ltd', slug: 'apex', currency: 'KES'},
},
        permissions: ['site.diary', 'cost.create'],
        token: 'token',
};

      const html = renderToString(<SupervisorDashboard session={superSession} />).replace(/<!-- -->/g, '');
      expect(html).toContain('Project Geofencing &amp; Biometric Attendance');
      expect(html).toContain('Plant GPS Telematics &amp; Remote Fuel Flow Ingestion');
});

    it('embeds GeofencedClockInView and PlantTelematicsView into PmQsDashboard', () => {
      const pmSession: AuthSession = {
        user: {
          id: 'user-pm',
          email: 'pm@apexbuilders.co.ke',
          fullName: 'Project Manager / QS',
          role: 'PM_QS',
          tenant: { id: 'tenant-123', name: 'Apex Builders Kenya Ltd', slug: 'apex', currency: 'KES'},
},
        permissions: ['cost.manage', 'site.manage'],
        token: 'token',
};

      const html = renderToString(<PmQsDashboard session={pmSession} />).replace(/<!-- -->/g, '');
      expect(html).toContain(' Site Geofencing');
      expect(html).toContain(' Plant Telematics');
      expect(html).toContain('Project Geofencing &amp; Biometric Attendance');
      expect(html).toContain('Plant GPS Telematics &amp; Remote Fuel Flow Ingestion');
});
});

  describe('Milestone M25 & M26: Rebar BBS Takeoff & Safaricom Daraja B2C Disbursements Suite', () => {
    it('renders BarBendingScheduleView standalone with BS 8666 schedules and 12m stock math', () => {
      const html = renderToString(
<BarBendingScheduleView projectId="project-rcp-2026" projectName="Riverside Commercial Plaza" />
).replace(/<!-- -->/g, '');

      expect(html).toContain('Rebar Takeoff &amp; BS 8666 Bar Bending Schedule (BBS)');
      expect(html).toContain('KS 02-598 Certified');
      expect(html).toContain('+ New BBS Schedule');
      expect(html).toContain('BBS-SUB-001');
      expect(html).toContain('Substructure Footings &amp; Ground Beams');
      expect(html).toContain('14.850 T');
      expect(html).toContain('APPROVED_FOR_CUTTING');
});

    it('renders MpesaDisbursementView standalone with B2C bulk wages and retention releases', () => {
      const html = renderToString(
<MpesaDisbursementView projectId="project-rcp-2026" projectName="Riverside Commercial Plaza" />
).replace(/<!-- -->/g, '');

      expect(html).toContain('Safaricom Daraja B2C Bulk Wages &amp; Retention Disbursements');
      expect(html).toContain('Live B2C Gateway');
      expect(html).toContain('Disburse via M-Pesa B2C');
            });

    it('embeds BarBendingScheduleView and MpesaDisbursementView into PmQsDashboard', () => {
      const pmSession: AuthSession = {
        user: {
          id: 'user-pm',
          email: 'pm@apexbuilders.co.ke',
          fullName: 'Project Manager / QS',
          role: 'PM_QS',
          tenant: { id: 'tenant-123', name: 'Apex Builders Kenya Ltd', slug: 'apex', currency: 'KES'},
},
        permissions: ['cost.manage', 'site.manage'],
        token: 'token',
};

      const html = renderToString(<PmQsDashboard session={pmSession} />).replace(/<!-- -->/g, '');
      expect(html).toContain(' Rebar BBS Takeoff');
      expect(html).toContain(' M-Pesa B2C Payouts');
      expect(html).toContain('Rebar Takeoff &amp; BS 8666 Bar Bending Schedule (BBS)');
      expect(html).toContain('Safaricom Daraja B2C Bulk Wages &amp; Retention Disbursements');
});

    it('embeds BarBendingScheduleView into SupervisorDashboard for site cutting lists', () => {
      const superSession: AuthSession = {
        user: {
          id: 'user-super',
          email: 'supervisor@apexbuilders.co.ke',
          fullName: 'Site Supervisor',
          role: 'SITE_SUPERVISOR',
          tenant: { id: 'tenant-123', name: 'Apex Builders Kenya Ltd', slug: 'apex', currency: 'KES'},
},
        permissions: ['site.diary', 'cost.create'],
        token: 'token',
};

      const html = renderToString(<SupervisorDashboard session={superSession} />).replace(/<!-- -->/g, '');
      expect(html).toContain('Rebar Takeoff &amp; BS 8666 Bar Bending Schedule (BBS)');
      expect(html).toContain('KS 02-598 Certified');
});

    it('embeds MpesaDisbursementView into CompanyAdminDashboard for executive payouts', () => {
      const adminSession: AuthSession = {
        user: {
          id: 'user-admin',
          email: 'admin@apexbuilders.co.ke',
          fullName: 'Admin User',
          role: 'COMPANY_ADMIN',
          tenant: { id: 'tenant-123', name: 'Apex Builders Kenya Ltd', slug: 'apex', currency: 'KES'},
},
        permissions: ['company.manage'],
        token: 'token',
};

      const html = renderToString(<CompanyAdminDashboard session={adminSession} />).replace(/<!-- -->/g, '');
      expect(html).toContain('Safaricom Daraja B2C Bulk Wages &amp; Retention Disbursements');
      expect(html).toContain('Live B2C Gateway');
});

    it('renders RmcTransitTrackerView with BS EN 206 cold joint defense and slump verification', () => {
      const html = renderToString(
<RmcTransitTrackerView
          projectId="project-test-rmc"
          projectName="Upper Hill Medical Suites"
        />
).replace(/<!-- -->/g, '');

      expect(html).toContain('Ready-Mix Concrete (RMC) Transit &amp; Slump Tracker');
      expect(html).toContain('BS EN 206 / KS 02-598 Cold-Joint Early Defense');
      expect(html).toContain('BS EN 12350-2');
      expect(html).toContain('RMC-BAM-88412');
      expect(html).toContain('Bamburi Special Products Ltd');
      expect(html).toContain('KDH 482B');
      expect(html).toContain('CLASS 30 20');
      expect(html).toContain('Slump Standard (BS EN 12350-2)');
});

    it('renders StructuralSteelTakeoffView with BS 4 sections and intumescent coating estimator', () => {
      const html = renderToString(
<StructuralSteelTakeoffView
          projectId="project-test-steel"
          projectName="Tatu City Logistics Park"
        />
).replace(/<!-- -->/g, '');

      expect(html).toContain('Structural Steel Framing &amp; Fabrication Takeoff Engine');
      expect(html).toContain('BS 4 / BS EN 10056 / KS 02-104 Section Properties');
      expect(html).toContain('STL-TKF-WH01');
      expect(html).toContain('Warehouse Main Portal Frame Grid 1-8');
      expect(html).toContain('11.422 T');
      expect(html).toContain('262.60 m²');
      expect(html).toContain('UB 406x178x74');
      expect(html).toContain('S355JR');
});

    it('embeds RmcTransitTrackerView and StructuralSteelTakeoffView into PmQsDashboard', () => {
      const pmSession: AuthSession = {
        user: {
          id: 'user-pm',
          email: 'pm@apexbuilders.co.ke',
          fullName: 'Project Manager / QS',
          role: 'PM_QS',
          tenant: { id: 'tenant-123', name: 'Apex Builders Kenya Ltd', slug: 'apex', currency: 'KES'},
},
        permissions: ['cost.manage', 'site.manage'],
        token: 'token',
};

      const html = renderToString(<PmQsDashboard session={pmSession} />).replace(/<!-- -->/g, '');
      expect(html).toContain(' RMC Transit &amp; Slump');
      expect(html).toContain(' Structural Steel Takeoff');
      expect(html).toContain('Ready-Mix Concrete (RMC) Transit &amp; Slump Tracker');
      expect(html).toContain('Structural Steel Framing &amp; Fabrication Takeoff Engine');
});

    it('embeds RmcTransitTrackerView into SupervisorDashboard for live batch tickets and slump cone testing', () => {
      const superSession: AuthSession = {
        user: {
          id: 'user-super',
          email: 'supervisor@apexbuilders.co.ke',
          fullName: 'Site Supervisor',
          role: 'SITE_SUPERVISOR',
          tenant: { id: 'tenant-123', name: 'Apex Builders Kenya Ltd', slug: 'apex', currency: 'KES'},
},
        permissions: ['site.diary', 'cost.create'],
        token: 'token',
};

      const html = renderToString(<SupervisorDashboard session={superSession} />).replace(/<!-- -->/g, '');
      expect(html).toContain('Ready-Mix Concrete (RMC) Transit &amp; Slump Tracker');
      expect(html).toContain('Bamburi Special Products Ltd');
      expect(html).toContain('KDH 482B');
});
});

  describe('Milestone M29 & M30 - Geotechnical Soil Compaction QA & Asphalt Pavement Quality', () => {
    it('renders GeotechnicalSoilView with Proctor compaction, relative density, and DCP CBR calculations', () => {
      const html = renderToString(
<GeotechnicalSoilView
          projectId="project-test-soil"
          projectName="Kenol-Sagana-Marua Highway"
        />
).replace(/<!-- -->/g, '');

      expect(html).toContain('Geotechnical Soil Compaction QA Engine');
      expect(html).toContain('BS 1377 / BS 5930 / ASTM D1557 Proctor Density');
      expect(html).toContain('SOIL-CMP-001');
      expect(html).toContain('Subbase Section Ch 1+200 - 1+450 Main Carriageway');
      expect(html).toContain('SAND REPLACEMENT');
      expect(html).toContain('95.58%');
      expect(html).toContain('46.50%');
      expect(html).toContain('Eng. Francis Kimani');
});

    it('renders AsphaltPavementView with BS 594987 temperature envelope and core drill test tracker', () => {
      const html = renderToString(
<AsphaltPavementView
          projectId="project-test-asphalt"
          projectName="Kenol-Sagana-Marua Highway"
        />
).replace(/<!-- -->/g, '');

      expect(html).toContain('Asphalt Pavement Quality &amp; Thermal Tracker');
      expect(html).toContain('BS 594987 / KS 02-1025 Laying Thermal Envelopes');
      expect(html).toContain('ASP-COL-88910');
      expect(html).toContain('Colas East Africa Ltd');
      expect(html).toContain('KDF 994L');
      expect(html).toContain('AC 14_WEARING');
      expect(html).toContain('148.0°C');
      expect(html).toContain('97.50%');
});

    it('embeds GeotechnicalSoilView and AsphaltPavementView into PmQsDashboard', () => {
      const pmSession: AuthSession = {
        user: {
          id: 'user-pm',
          email: 'pm@apexbuilders.co.ke',
          fullName: 'Project Manager / QS',
          role: 'PM_QS',
          tenant: { id: 'tenant-123', name: 'Apex Builders Kenya Ltd', slug: 'apex', currency: 'KES'},
},
        permissions: ['cost.manage', 'site.manage'],
        token: 'token',
};

      const html = renderToString(<PmQsDashboard session={pmSession} />).replace(/<!-- -->/g, '');
      expect(html).toContain(' Geotechnical Soil QA');
      expect(html).toContain(' Asphalt Pavement QA');
      expect(html).toContain('Geotechnical Soil Compaction QA Engine');
      expect(html).toContain('Asphalt Pavement Quality &amp; Thermal Tracker');
});

    it('embeds GeotechnicalSoilView and AsphaltPavementView into SupervisorDashboard', () => {
      const superSession: AuthSession = {
        user: {
          id: 'user-super',
          email: 'supervisor@apexbuilders.co.ke',
          fullName: 'Site Supervisor',
          role: 'SITE_SUPERVISOR',
          tenant: { id: 'tenant-123', name: 'Apex Builders Kenya Ltd', slug: 'apex', currency: 'KES'},
},
        permissions: ['site.diary', 'cost.create'],
        token: 'token',
};

      const html = renderToString(<SupervisorDashboard session={superSession} />).replace(/<!-- -->/g, '');
      expect(html).toContain('Geotechnical Soil Compaction QA Engine');
      expect(html).toContain('Asphalt Pavement Quality &amp; Thermal Tracker');
});

    it('renders TopographicSurveyView with Mass Haul Diagram, Cut/Fill metrics, and station takeoff table', () => {
      const html = renderToString(
<TopographicSurveyView
          projectId="project-test-survey"
          projectName="A104 Mau Summit Highway"
        />
).replace(/<!-- -->/g, '');

      expect(html).toContain('Survey &amp; Topographic Cut/Fill Earthworks Engine');
      expect(html).toContain('Simpson&#x27;s 1/3 Rule, Prismoidal Corrections, Mass Haul Diagram');
      expect(html).toContain('SURV-RD-A104-001');
      expect(html).toContain('Mass Haul Diagram (MHD)');
      expect(html).toContain('Total Cut Volume');
      expect(html).toContain('Total Fill Volume');
      expect(html).toContain('Net Earthwork Balance');
      expect(html).toContain('Economic Haul Limit');
      expect(html).toContain('Total Overhaul Cost');
      expect(html).toContain('Cross-Section Stations Takeoff Table');
      expect(html).toContain('Ch 0+000');
      expect(html).toContain('Ch 0+050');
      expect(html).toContain('Ch 1+200');
      expect(html).toContain('Balance Point (BP)');
});

    it('embeds TopographicSurveyView into PmQsDashboard', () => {
      const pmSession: AuthSession = {
        user: {
          id: 'user-pm',
          email: 'pm@apexbuilders.co.ke',
          fullName: 'Project Manager / QS',
          role: 'PM_QS',
          tenant: { id: 'tenant-123', name: 'Apex Builders Kenya Ltd', slug: 'apex', currency: 'KES'},
},
        permissions: ['cost.manage', 'site.manage'],
        token: 'token',
};

      const html = renderToString(<PmQsDashboard session={pmSession} />).replace(/<!-- -->/g, '');
      expect(html).toContain(' Topographic Survey &amp; Earthworks');
      expect(html).toContain('Survey &amp; Topographic Cut/Fill Earthworks Engine');
      expect(html).toContain('Mass Haul Diagram (MHD)');
});

    it('embeds TopographicSurveyView into SupervisorDashboard', () => {
      const superSession: AuthSession = {
        user: {
          id: 'user-super',
          email: 'supervisor@apexbuilders.co.ke',
          fullName: 'Site Supervisor',
          role: 'SITE_SUPERVISOR',
          tenant: { id: 'tenant-123', name: 'Apex Builders Kenya Ltd', slug: 'apex', currency: 'KES'},
},
        permissions: ['site.diary', 'cost.create'],
        token: 'token',
};

      const html = renderToString(<SupervisorDashboard session={superSession} />).replace(/<!-- -->/g, '');
      expect(html).toContain('Survey &amp; Topographic Cut/Fill Earthworks Engine');
      expect(html).toContain('Mass Haul Diagram (MHD)');
});

    it('renders PlantTelematicsView CAN-bus Live Diagnostics Dashboard with overheat threshold indicators and ECU DTC codes', () => {
      const html = renderToString(
<PlantTelematicsView
          projectId="project-m32-test"
          projectName="Konza Technopolis Depot"
        />
).replace(/<!-- -->/g, '');

      // CAN-bus Live Diagnostics Dashboard assertions
      expect(html).toContain('CAN-bus Live Diagnostics Dashboard');
      expect(html).toContain('J1939 / OBD-II');
      expect(html).toContain('Coolant Temp (PID 0x05)');
      expect(html).toContain('Overheat threshold indicator');
      expect(html).toContain('Engine Oil Temp');
      expect(html).toContain('Engine Speed');
      expect(html).toContain('Battery Voltage');
      expect(html).toContain('ECU DTC Codes');
      expect(html).toContain('94.2°C');
      expect(html).toContain('98.5°C');
      expect(html).toContain('24.20 V');
});

    it('renders Diesel Siphoning Anomaly Incident Feed with severity badges and fuel loss rates', () => {
      const html = renderToString(
<PlantTelematicsView
          projectId="project-m32-test"
          projectName="Konza Technopolis Depot"
        />
).replace(/<!-- -->/g, '');

      expect(html).toContain('Fuel Discrepancy Anomaly Incident Feed');
      expect(html).toContain('Deep telemetry fuel drain rate analysis and anomaly variance detection');
            expect(html).toContain('-40.00 Liters');
      expect(html).toContain('480.00 L/h');
      expect(html).toContain('Rapid Fuel Level Drop Event');
      expect(html).toContain('STOPPED');
});

    it('renders Maintenance Alerts Feed and accessible Acknowledge Alert modal', () => {
      const html = renderToString(
<PlantTelematicsView
          projectId="project-m32-test"
          projectName="Konza Technopolis Depot"
          initialShowAcknowledgeModalForAlertId="alt-001"
        />
).replace(/<!-- -->/g, '');

      // Alerts feed assertions
      expect(html).toContain('Plant Maintenance &amp; Predictive Alerts Feed');
      expect(html).toContain('ALT-FUEL-DISC-001');
      expect(html).toContain('ALT-DIAG-002');
      expect(html).toContain('Acknowledge Alert');

      // Accessible modal assertions
      expect(html).toContain('role="dialog"');
      expect(html).toContain('aria-modal="true"');
      expect(html).toContain('aria-labelledby="ack-alert-modal-title"');
      expect(html).toContain('id="ack-alert-modal-title"');
      expect(html).toContain('Acknowledge Plant Maintenance Alert');
      expect(html).toContain('for="ack-engineer-name"');
      expect(html).toContain('id="ack-engineer-name"');
      expect(html).toContain('for="ack-action-notes"');
      expect(html).toContain('id="ack-action-notes"');
      expect(html).toContain('Eng. Sarah Mwangi (Lead Plant Engineer)');
});
});

  describe('Milestone M33: Platform Independent Site Inspection, Contractor Tender Board & Interactive Landing Portal Hub Suite', () => {
    const mockSession = (role: string): AuthSession => ({
      user: {
        id: `user-${role.toLowerCase()}`,
        email: `${role.toLowerCase()}@apexbuilders.co.ke`,
        fullName: `Test ${role}`,
        role,
        tenant: {
          id: 'tenant-123',
          name: 'Apex Builders Kenya Ltd',
          slug: 'apex-builders',
          currency: 'KES',
},
},
      permissions: ['project.view', 'tender.manage', 'inspection.view', 'inspection.book', 'variation.approve'],
      token: `mock-token-${role.toLowerCase()}`,
});

    it('renders IndependentSiteReportView honest empty state without inspection data', () => {
      const html = renderToString(
<IndependentSiteReportView
          projectId="project-rcp-2026"
          projectName="Riverside Commercial Plaza"
          userRole="CLIENT"
        />
).replace(/<!-- -->/g, '');

      // No demo inspections are shipped — the view reports an honest empty state.
      expect(html).toContain('No inspection report selected.');
});

    it('renders IndependentSiteReportView empty state — no variance data without inspections', () => {
      const html = renderToString(
<IndependentSiteReportView
          projectId="project-rcp-2026"
          projectName="Riverside Commercial Plaza"
          userRole="CLIENT"
        />
).replace(/<!-- -->/g, '');

      expect(html).toContain('No inspection report selected.');
});

it('renders ContractorTenderBoardView with active tenders, 70/30 technical/financial ranking, and award actions', () => {
      const html = renderToString(
<ContractorTenderBoardView
          projectId="project-rcp-2026"
          projectName="Riverside Commercial Plaza"
          userRole="PM_QS"
        />
).replace(/<!-- -->/g, '');

      // Header assertions
            expect(html).toContain('Technical 70% • Financial 30% Evaluation');
      expect(html).toContain('+ Post New Tender');
      expect(html).toContain('Submit Contractor Bid');

      // Active tenders
      expect(html).toContain('SSF-TND-2026-STR-01');
      expect(html).toContain('Reinforced Concrete Framing &amp; Suspended Slabs Package');
      expect(html).toContain('18500000.00');
      expect(html).toContain('UNDER_REVIEW');

      // Ranked bids & evaluation view
      expect(html).toContain('Evaluation Metric: Technical 70% | Financial 30%');
      expect(html).toContain('Ranked Contractor Bids &amp; Commercial Evaluation');
      expect(html).toContain('Apex Structural Builders Ltd');
      expect(html).toContain('Rank 1');
      expect(html).toContain('94.75 pts');
      expect(html).toContain('Kilimani Construction Works Ltd');
      expect(html).toContain('Rank 2');
      expect(html).toContain('87.05 pts');
      expect(html).toContain('Award Tender');

      // Trade breakdown
      expect(html).toContain('Bill of Quantities Trade Breakdown by Responsive Bidder');
      expect(html).toContain('Direct Labor:');
      expect(html).toContain('Materials Supply:');
      expect(html).toContain('Plant &amp; Equipment:');
      expect(html).toContain('Preliminaries &amp; Overheads:');
});

    it('renders the rewritten LandingPortalHub with plain copy and no invented stats', () => {
      const html = renderToString(
<LandingPortalHub
          onSelectRolePreview={() => {}}
          onOpenLogin={() => {}}
        />
).replace(/<!-- -->/g, '');

      expect(html).toContain('Run your construction sites from one place.');
      expect(html).toContain('Sites &amp; daily records');
      expect(html).toContain('Money that reconciles');
      expect(html).toContain('Clients stay informed');
      expect(html).toContain('Teams on the same page');
      expect(html).toContain('/screenshots/console-desktop.png');
      // No invented stats or marketing claims
      expect(html).not.toContain('100% Neutral Verification');
      expect(html).not.toContain('0 Seat Tax');
      expect(html).not.toContain('Feasibility Estimator');
});

    it('renders LandingPortalHub by default in unauthenticated App and provides sign-in toggle', () => {
      const html = renderToString(<App />).replace(/<!-- -->/g, '');

      // LandingPortalHub is loaded unauthenticated
      expect(html).toContain('Run your construction sites from one place.');
      expect(html).toContain('Sign in to your workspace');
});

    it('embeds IndependentSiteReportView and ContractorTenderBoardView into ClientDashboard and verifies multi-currency conversion', () => {
      const html = renderToString(
<ClientDashboard session={mockSession('CLIENT')} />
).replace(/<!-- -->/g, '');

      // Embedded M33 components in ClientDashboard
            
      // Certified IPCs, Payments, and Monetary Variance Schedule
      expect(html).toContain('Certified Valuations Ledger');
      expect(html).toContain('Certified IPCs, Contractor Payments &amp; Variance Schedule');
      expect(html).toContain('Total Contract Sum:');
      expect(html).toContain('Gross Certified IPCs:');
      expect(html).toContain('Net Payments Disbursed:');
      expect(html).toContain('Loading certificates');

      // Multi-currency toggles present
      expect(html).toContain('currency-toggle-kes');
      expect(html).toContain('currency-toggle-usd');
      expect(html).toContain('currency-toggle-gbp');
      expect(html).toContain('currency-toggle-eur');
      expect(html).toContain('currency-toggle-aed');
});

    it('embeds IndependentSiteReportView and ContractorTenderBoardView into PmQsDashboard with navigation tabs', () => {
      const html = renderToString(
<PmQsDashboard session={mockSession('PM_QS')} />
).replace(/<!-- -->/g, '');

      // Navigation tabs in PM_QS workspace
      expect(html).toContain(' Site Inspections');
      expect(html).toContain(' Tender Board');

      // Embedded M33 components in PmQsDashboard
                  expect(html).toContain('Technical 70% • Financial 30% Evaluation');
      });

    it('renders IndependentSiteReportView honest empty state', () => {
      const html = renderToString(
<IndependentSiteReportView
          projectId="project-rcp-2026"
          projectName="Riverside Commercial Plaza"
          userRole="CLIENT"
        />
).replace(/<!-- -->/g, '');

      expect(html).toContain('No inspection report selected.');
});

    it('renders CompliancePortalView loading state pending token verification', () => {
      const html = renderToString(
<CompliancePortalView
          projectName="Riverside Commercial Plaza"
          projectCode="RCP-2026"
        />
).replace(/<!-- -->/g, '');

      // Token-scoped portal: data loads via /api/v1/portals/compliance/:token;
      // SSR shows the loading state (no demo data is rendered).
      expect(html).toContain('Loading portal');
});
});

  describe('Gate-4 S1/S2: Quotes-to-cash & Invoicing UI', () => {
    const gate4Session = (role: string): AuthSession => ({
      user: {
        id: `user-${role.toLowerCase()}`,
        email: `${role.toLowerCase()}@apexbuilders.co.ke`,
        fullName: `Test ${role}`,
        role,
        tenant: { id: 'tenant-123', name: 'Apex Builders Kenya Ltd', slug: 'apex', currency: 'KES'},
},
      permissions: ['project.view'],
      token: 'mock-token',
});

    it('renders QuotesManagementView shell with quote lifecycle affordances', () => {
      const html = renderToString(<QuotesManagementView />).replace(/<!-- -->/g, '');
      expect(html).toContain('Quotes-to-Cash');
      expect(html).toContain('Quotations &amp; Proposals');
      expect(html).toContain('New Quote');
      expect(html).toContain('Loading quotes');
});

    it('renders InvoicingView shell with AR status filters and payment affordances', () => {
      const html = renderToString(<InvoicingView />).replace(/<!-- -->/g, '');
      expect(html).toContain('Accounts Receivable');
      expect(html).toContain('Invoicing &amp; Payments');
      expect(html).toContain('New Invoice');
      expect(html).toContain('OVERDUE');
      expect(html).toContain('PART PAID');
      expect(html).toContain('Loading invoices');
});

    it('embeds quotes and invoicing views into PmQsDashboard tabs', () => {
      const html = renderToString(
<PmQsDashboard session={gate4Session('PM_QS')} />
).replace(/<!-- -->/g, '');
      expect(html).toContain('Quotes &amp; Cash');
      expect(html).toContain('Invoicing');
      expect(html).toContain('Accounts Receivable');
      expect(html).toContain('Quotes-to-Cash');
});

    it('embeds quotes and invoicing into the Company Admin dashboard', () => {
      const html = renderToString(
<CompanyAdminDashboard session={gate4Session('COMPANY_ADMIN')} />
).replace(/<!-- -->/g, '');
      expect(html).toContain('Quotations &amp; Proposals');
      expect(html).toContain('Invoicing &amp; Payments');
});
});
});

