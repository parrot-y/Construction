import { describe, expect, it } from 'vitest';
import { renderToString } from 'react-dom/server';
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
import { MaterialRequisitionView } from './components/MaterialRequisitionView';
import { MaterialWastageVarianceCard } from './components/MaterialWastageVarianceCard';
import { ProjectSCurveCashFlowCard } from './components/ProjectSCurveCashFlowCard';
import { SubcontractorValuationView } from './components/SubcontractorValuationView';
import { PlantEquipmentView } from './components/PlantEquipmentView';
import { LaborMusterRollView } from './components/LaborMusterRollView';
import { SafetyAuditScorecardView } from './components/SafetyAuditScorecardView';
import { ETimsTaxComplianceView } from './components/ETimsTaxComplianceView';
import { WhatsAppSiteWebhookView } from './components/WhatsAppSiteWebhookView';
import { RetentionAndBondsView } from './components/RetentionAndBondsView';
import { SubscriptionBillingView } from './components/SubscriptionBillingView';
import { GeofencedClockInView } from './components/GeofencedClockInView';
import { PlantTelematicsView } from './components/PlantTelematicsView';
import { BarBendingScheduleView } from './components/BarBendingScheduleView';
import { MpesaDisbursementView } from './components/MpesaDisbursementView';
import { AuthSession } from './types/auth';

describe('Web App walking skeleton & login suite (Milestone M1 & M3)', () => {
  it('renders the login screen by default with demo accounts and title', () => {
    const html = renderToString(<LoginForm onLoginSuccess={() => {}} />);
    expect(html).toContain('Apex Builders Kenya');
    expect(html).toContain('Milestone M1 • Walking Skeleton');
    expect(html).toContain('admin@apexbuilders.co.ke');
    expect(html).toContain('COMPANY_ADMIN');
    expect(html).toContain('PM_QS');
    expect(html).toContain('SITE_SUPERVISOR');
    expect(html).toContain('CLIENT');
  });

  it('renders the App component root unauthenticated', () => {
    const html = renderToString(<App />);
    expect(html).toContain('Apex Builders Kenya');
    expect(html).toContain('Sign in to access your project workspace');
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

    const html = renderToString(<Dashboard session={adminSession} onLogout={() => {}} />);
    expect(html).toContain('Apex Builders Kenya Ltd');
    expect(html).toContain('David Kimani');
    expect(html).toContain('COMPANY_ADMIN');
    expect(html).toContain('Executive Company Dashboard');
    expect(html).toContain('Active Projects');
    expect(html).toContain('Total Contract Value');
    expect(html).toContain('Approved Budget');
    expect(html).toContain('Registered Projects');
    expect(html).toContain('Riverside Commercial Plaza');
    expect(html).toContain('Team Management');
    expect(html).toContain('Faith Achieng');
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

    const html = renderToString(<Dashboard session={qsSession} onLogout={() => {}} />);
    expect(html).toContain('Apex Builders Kenya Ltd');
    expect(html).toContain('Faith Achieng');
    expect(html).toContain('PM_QS');
    expect(html).toContain('Cost Control &amp; BOQ Management');
    expect(html).toContain('Import Excel BOQ');
    expect(html).toContain('BORAQS / EASMM');
    expect(html).toContain('Approved Budget Baseline');
    expect(html).toContain('Core Loop Workflow Status');
    expect(html).toContain('Variance Monitor');
    expect(html).toContain('Riverside Commercial Plaza');
    expect(html).toContain('Section 1: Preliminaries &amp; General');
    expect(html).toContain('45000000.00');
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

    const html = renderToString(<Dashboard session={supervisorSession} onLogout={() => {}} />);
    expect(html).toContain('Apex Builders Kenya Ltd');
    expect(html).toContain('John Mwangi');
    expect(html).toContain('SITE_SUPERVISOR');
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
    expect(html).toContain('12.0%');
    expect(html).toContain('Approved Contract Sum');
    expect(html).toContain('Total Certified Cost');
    expect(html).toContain('Contract Retention Terms (Kenyan Standard)');
    expect(html).toContain('10% of Gross Certified Work');
    expect(html).toContain('2250000.00');
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
      <BudgetSummaryCard projectName="Riverside Commercial Plaza" />,
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
    expect(html).toContain('Bamburi Cement Ltd');
    expect(html).toContain('Fundi Kazi Casuals');
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
        <VarianceMonitorCard projectName="Riverside Commercial Plaza" />,
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

      const qsHtml = renderToString(<Dashboard session={qsSession} onLogout={() => {}} />);
      expect(qsHtml).toContain('Variance Monitor &amp; Health Guard');
      expect(qsHtml).toContain('BOQ Section-by-Section Spend Breakdown');

      const clientHtml = renderToString(<Dashboard session={clientSession} onLogout={() => {}} />);
      expect(clientHtml).toContain('Variance Monitor &amp; Health Guard');
      expect(clientHtml).toContain('BOQ Section-by-Section Spend Breakdown');
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
      expect(html).toContain('Variation Title *');
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

    it('renders VariationManagementView with status badges, formatted KES net amount, time extension days, and action buttons', () => {
      const html = renderToString(
        <VariationManagementView
          projectId="test-proj-id"
          userRole="PM_QS"
          canRequest={true}
          canReview={true}
          canApprove={true}
        />,
      );

      // Header & Request button
      expect(html).toContain('Variation Orders &amp; Scope Adjustments');
      expect(html).toContain('Milestone M8');
      expect(html).toContain('+ Request Variation');

      // Status badges
      expect(html).toContain('SUBMITTED');
      expect(html).toContain('QS_EVALUATED');
      expect(html).toContain('APPROVED');

      // Formatted KES amounts and time extensions
      expect(html).toContain('900000.00');
      expect(html).toContain('450000.00');
      expect(html).toContain('+14 Days Extension');
      expect(html).toContain('+5 Days Extension');

      // Action buttons
      expect(html).toContain('Evaluate');
      expect(html).toContain('Approve');
      expect(html).toContain('Reject');
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

      const qsHtml = renderToString(<Dashboard session={qsSession} onLogout={() => {}} />);
      expect(qsHtml).toContain('Variation Orders &amp; Scope Adjustments');
      expect(qsHtml).toContain('+ Request Variation');
      expect(qsHtml).toContain('Evaluate');

      const clientHtml = renderToString(<Dashboard session={clientSession} onLogout={() => {}} />);
      expect(clientHtml).toContain('Variation Orders &amp; Scope Adjustments');
      expect(clientHtml).toContain('Approve');
      expect(clientHtml).not.toContain('+ Request Variation');
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

      // 5 Plain-Language Financial Cards
      expect(html).toContain('Original Agreed Budget');
      expect(html).toContain('45000000.00');

      expect(html).toContain('Approved Variations Total');
      expect(html).toContain('900000.00');

      expect(html).toContain('Current Approved Budget');
      expect(html).toContain('45900000.00');

      expect(html).toContain('Total Spent to Date');
      expect(html).toContain('4500000.00');

      expect(html).toContain('Remaining Balance');
      expect(html).toContain('41400000.00');

      // Visual budget utilization bar
      expect(html).toContain('Project Budget Utilization');
      expect(html).toContain('9.8% Consumed');
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
      expect(html).toContain('Variation Orders &amp; Scope Adjustments');
      expect(html).toContain('Approve');
      expect(html).toContain('Reject');

      // Requesting variations is restricted to contractors/QS
      expect(html).not.toContain('+ Request Variation');
    });

    it('displays neutral project health guard card with factual notice and variance metrics', () => {
      const html = renderToString(<ClientDashboard session={clientSession} />);

      expect(html).toContain('Project Health &amp; Alignment Guard');
      expect(html).toContain('ON TRACK • Normal Alignment');
      expect(html).toContain('Expenditure is aligned with recorded physical progress.');
      expect(html).toContain('Physical Progress');
      expect(html).toContain('Budget Consumed');
      expect(html).toContain('Variance Delta');
    });

    it('displays Kenyan standard contract retention terms with 10% deduction and 5% cap', () => {
      const html = renderToString(<ClientDashboard session={clientSession} />);

      expect(html).toContain('Contract Retention Terms (Kenyan Standard)');
      expect(html).toContain('10% of Gross Certified Work');
      expect(html).toContain('2250000.00');
      expect(html).toContain('5% of Contract Sum');
      expect(html).toContain('50% released at Practical Completion');
      expect(html).toContain('50% released at end of Defects Liability Period (DLP)');
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
      const html = renderToString(<Dashboard session={mockSession('PM_QS')} onLogout={() => {}} />);
      expect(html).toContain('Download IPC (PDF)');
      expect(html).toContain('Project Summary (PDF)');
      expect(html).toContain('data-testid="download-ipc-btn"');
      expect(html).toContain('data-testid="download-summary-btn"');
      expect(html).toContain('/reports/ipc');
      expect(html).toContain('/reports/summary');
    });

    it('renders PDF report download buttons in SupervisorDashboard', () => {
      const html = renderToString(<Dashboard session={mockSession('SITE_SUPERVISOR')} onLogout={() => {}} />);
      expect(html).toContain('Daily Diary (PDF)');
      expect(html).toContain('Site Summary (PDF)');
      expect(html).toContain('data-testid="download-site-diary-btn"');
      expect(html).toContain('data-testid="download-summary-btn"');
      expect(html).toContain('/reports/site-diary/latest');
      expect(html).toContain('/reports/summary');
    });
  });

  describe('Construction Lifecycle Extensions: RFI Technical Queries Suite', () => {
    it('renders RfiManagementView with RFI register, priority badges, consultant roles, status badges, and elapsed days', () => {
      const rawHtml = renderToString(<RfiManagementView projectId="project-rcp-2026" />);
      const html = rawHtml.replace(/<!-- -->/g, '');

      expect(html).toContain('Request for Information (RFI) Register');
      expect(html).toContain('RFI-001');
      expect(html).toContain('Clarification on Pad Footing Reinforcement in Grid C-4');
      expect(html).toContain('Structural Eng');
      expect(html).toContain('CRITICAL');
      expect(html).toContain('ANSWERED');
      expect(html).toContain('5 days elapsed');

      // Expandable thread verification
      expect(html).toContain('Official Consultant Resolution Thread');
      expect(html).toContain('Eng. Peter Gitau');
      expect(html).toContain('SK-ST-04-Pad-Footing-C4-Revision.pdf');

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
      expect(html).toContain('CHK-PRE-001');
      expect(html).toContain('PRE_POUR_CONCRETE');
      expect(html).toContain('Grid 3-B Ground Floor Raft Foundation');
      expect(html).toContain('APPROVED_FOR_POUR');

      // Interactive items table with pass/fail toggles
      expect(html).toContain('Rebar sizing, spacing');
      expect(html).toContain('Formwork rigidity');
      expect(html).toContain('PASS ✓');
      expect(html).toContain('FAIL ✕');
      expect(html).toContain('Approve for Pour');
      expect(html).toContain('Reject / Rework');
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
      expect(html).toContain('CUBE-2026-001');
      expect(html).toContain('Class 25/20');
      expect(html).toContain('18.6 MPa');
      expect(html).toContain('27.8 MPa');
      expect(html).toContain('PASS (27.8 MPa)');
      expect(html).toContain('target 25 MPa');
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
      expect(html).toContain('SNG-001');
      expect(html).toContain('Block A');
      expect(html).toContain('2nd Floor');
      expect(html).toContain('Room 204 (Master Ensuite)');
      expect(html).toContain('Tiling');
      expect(html).toContain('FUNCTIONAL');
      expect(html).toContain('OPEN');

      // SNG-002
      expect(html).toContain('SNG-002');
      expect(html).toContain('Painting');
      expect(html).toContain('COSMETIC');
      expect(html).toContain('RECTIFIED BY CONTRACTOR');

      // Geotag pin and photos
      expect(html).toContain('Geotag Pin');
      expect(html).toContain('-1.268321');
      expect(html).toContain('36.804412');
      expect(html).toContain('BEFORE');
      expect(html).toContain('AFTER');

      // Buttons
      expect(html).toContain('+ Add Snag Item');
      expect(html).toContain('Mark Rectified');
      expect(html).toContain('Verify &amp; Close');
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
          firstMoietyAmount="1125000.00"
        />,
      );
      const html = rawHtml.replace(/<!-- -->/g, '');

      expect(html).toContain('First Moiety (50%)');
      expect(html).toContain('1125000.00');
      expect(html).toContain('RELEASED');
      expect(html).toContain('Released to Contractor ✓');
      expect(html).toContain('IPC #10-FIN-RET1');
    });

    it('displays 6-Month Defects Liability Period (DLP) countdown and days remaining', () => {
      const rawHtml = renderToString(
        <PracticalCompletionCard
          projectName="Riverside Commercial Plaza"
          dlpDaysRemaining={124}
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
      const html = renderToString(<Dashboard session={mockSessionForRole('PM_QS')} onLogout={() => {}} />);

      expect(html).toContain('Request for Information (RFI) Register');
      expect(html).toContain('Pre-Pour Hold Points &amp; Concrete Cube Crushing');
      expect(html).toContain('Practical Completion &amp; Retention Release Card');
    });

    it('embeds QualityControlView and SnaggingListView into SupervisorDashboard', () => {
      const html = renderToString(<Dashboard session={mockSessionForRole('SITE_SUPERVISOR')} onLogout={() => {}} />);

      expect(html).toContain('Pre-Pour Hold Points &amp; Concrete Cube Crushing');
      expect(html).toContain('Defects Snagging Punch List Register');
    });

    it('embeds PracticalCompletionCard and SnaggingListView into ClientDashboard with verification capability', () => {
      const html = renderToString(<Dashboard session={mockSessionForRole('CLIENT')} onLogout={() => {}} />);

      expect(html).toContain('Practical Completion &amp; Retention Release Card');
      expect(html).toContain('Defects Snagging Punch List Register');
      expect(html).toContain('Verify &amp; Close');
      expect(html).not.toContain('+ Add Snag Item');
    });
  });

  describe('External Stakeholder Portals (Zero Seat Tax Architecture)', () => {
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

      expect(html).toContain('Zero Seat Tax • Consultant Portal');
      expect(html).toContain('Arch. Peter Mwangi');
      expect(html).toContain('BORAQS Reg: A-742');
      expect(html).toContain('Riverside Commercial Plaza (RCP-2026)');
      expect(html).toContain('Architectural &amp; Structural RFIs');
      expect(html).toContain('RFI-001');
      expect(html).toContain('Clarification on Column C3 rebar cover');
      expect(html).toContain('Concrete Cube Strength Tests');
      expect(html).toContain('Pre-Pour QA Checklists');
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

      expect(html).toContain('Subcontractor Portal • Zero Seat Tax');
      expect(html).toContain('Simba Plumbing Works Ltd');
      expect(html).toContain('SNG-001');
      expect(html).toContain('Floor 2, Washroom 2B');
      expect(html).toContain('Open Defects');
      expect(html).toContain('Rectified (Pending Sign-off)');
      expect(html).toContain('Submit Defect Rectification Proof');
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

      expect(html).toContain('Material Supplier &amp; Batching Portal • Zero Seat Tax');
      expect(html).toContain('Bamburi Ready-Mix Nairobi Plant');
      expect(html).toContain('DN-BAM-90812');
      expect(html).toContain('Ready-Mix Concrete Class 25/20');
      expect(html).toContain('Site Acknowledged &amp; Cast');
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

      expect(html).toContain('NCA &amp; Regulatory Compliance Portal • Zero Seat Tax');
      expect(html).toContain('Eng. Faith Mutua');
      expect(html).toContain('NCA Cap 499A Verified');
      expect(html).toContain('NCA/PRJ/RCP-2026/REG-0891');
      expect(html).toContain('0.5% Statutory Levy');
      expect(html).toContain('Paid &amp; Reconciled');
      expect(html).toContain('Accredited Supervisor');
      expect(html).toContain('100.0%');
      expect(html).toContain('Structural Concrete Quality Register');
    });

    it('renders PortalAccessLinkManager with zero-seat-tax links for all external stakeholders', () => {
      const rawHtml = renderToString(
        <PortalAccessLinkManager projectId="project-rcp-2026" />
      );
      const html = rawHtml.replace(/<!-- -->/g, '');

      expect(html).toContain('External Stakeholder Portals (Zero Seat Tax)');
      expect(html).toContain('Unlimited External Users');
      expect(html).toContain('+ Generate Stakeholder Link');
      expect(html).toContain('CONSULTANT PORTAL');
      expect(html).toContain('Arch. Peter Mwangi');
      expect(html).toContain('SUBCONTRACTOR PORTAL');
      expect(html).toContain('Simba Plumbing Works Ltd');
      expect(html).toContain('SUPPLIER PORTAL');
      expect(html).toContain('Bamburi Ready-Mix Nairobi');
      expect(html).toContain('COMPLIANCE PORTAL');
      expect(html).toContain('Eng. Faith Mutua');
    });

    it('allows unauthenticated stakeholder entry into Consultant portal via App component with initialPortal', () => {
      const rawHtml = renderToString(
        <App initialPortal={{ type: 'consultant', token: 'ext-token-123' }} />
      );
      const html = rawHtml.replace(/<!-- -->/g, '');

      expect(html).toContain('Zero Seat Tax • Consultant Portal');
      expect(html).toContain('Architectural &amp; Structural RFIs');
      expect(html).not.toContain('Sign in to access your project workspace');
    });

    it('embeds PortalAccessLinkManager into PmQsDashboard and CompanyAdminDashboard', () => {
      const pmSession: AuthSession = {
        user: {
          id: 'user-pm',
          email: 'pm@apexbuilders.co.ke',
          fullName: 'PM User',
          role: 'PM_QS',
          tenant: { id: 'tenant-123', name: 'Apex Builders Kenya Ltd', slug: 'apex', currency: 'KES' },
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
          tenant: { id: 'tenant-123', name: 'Apex Builders Kenya Ltd', slug: 'apex', currency: 'KES' },
        },
        permissions: ['company.manage'],
        token: 'token',
      };

      const pmHtml = renderToString(<Dashboard session={pmSession} onLogout={() => {}} />).replace(/<!-- -->/g, '');
      expect(pmHtml).toContain('External Stakeholder Portals (Zero Seat Tax)');
      expect(pmHtml).toContain('🌐 Stakeholder Portals');

      const adminHtml = renderToString(<Dashboard session={adminSession} onLogout={() => {}} />).replace(/<!-- -->/g, '');
      expect(adminHtml).toContain('External Stakeholder Portals (Zero Seat Tax)');
    });
  });

  // ---------------------------------------------------------------------------
  // MILESTONE M11: OPERATIONS SUITE FRONTEND COMPONENTS (BUILDSASA PARITY)
  // ---------------------------------------------------------------------------
  describe('Milestone M11: Operations Suite Frontend Components (Buildsasa Parity)', () => {
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
      expect(html).toContain('Simba Portland Cement 32.5N');
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
      expect(html).toContain('Grid B-4 Second Floor Deck Shuttering');
      expect(html).toContain('Immediate Action Taken:');
      expect(html).toContain('Corrective &amp; Preventive Action (CAPA):');
    });

    it('renders ProjectDocumentVaultView with architectural/structural registers and revision codes', () => {
      const html = renderToString(
        <ProjectDocumentVaultView projectId="test-proj-1" />
      ).replace(/<!-- -->/g, '');

      expect(html).toContain('Project Drawing &amp; Document Vault');
      expect(html).toContain('Detailed Ground &amp; Typical Floor Layouts');
      expect(html).toContain('Rev C');
      expect(html).toContain('Foundation Strip Footings &amp; Column Schedule');
      expect(html).toContain('Rev B');
      expect(html).toContain('Nairobi City County Development Permit');
      expect(html).toContain('Upload Drawing / Document');
    });

    it('renders SubcontractorManagementView with trade contracts, KES commitments, and Kenyan retention rates', () => {
      const html = renderToString(
        <SubcontractorManagementView projectId="test-proj-1" />
      ).replace(/<!-- -->/g, '');

      expect(html).toContain('Subcontractor Work Packages &amp; Directory');
      expect(html).toContain('Simba Plumbing &amp; Sanitary Works Ltd');
      expect(html).toContain('Kilimani Electrical Engineering Ltd');
      expect(html).toContain('Total Subcontract Commitments');
      expect(html).toContain('Retention Rate: 5.00%');
      expect(html).toContain('Retention Rate: 10.00%');
      expect(html).toContain('Award Subcontract Package');
    });

    it('verifies that PmQsDashboard includes all 5 new operations modules in navigation tabs and views', () => {
      const pmSession: AuthSession = {
        user: {
          id: 'user-pm',
          email: 'pm@apexbuilders.co.ke',
          fullName: 'PM User',
          role: 'PM_QS',
          tenant: { id: 'tenant-123', name: 'Apex Builders Kenya Ltd', slug: 'apex', currency: 'KES' },
        },
        permissions: ['project.view'],
        token: 'token',
      };

      const html = renderToString(<Dashboard session={pmSession} onLogout={() => {}} />).replace(/<!-- -->/g, '');
      expect(html).toContain('📅 Schedule &amp; Gantt');
      expect(html).toContain('📦 Site Inventory');
      expect(html).toContain('🤝 Subcontractors');
      expect(html).toContain('📐 Drawings Vault');
      expect(html).toContain('🦺 HSE &amp; Safety');
      expect(html).toContain('Project Master Schedule');
      expect(html).toContain('Site Materials &amp; Store Inventory');
      expect(html).toContain('Safety, Health &amp; Environment (HSE) Register');
      expect(html).toContain('Project Drawing &amp; Document Vault');
      expect(html).toContain('Subcontractor Work Packages &amp; Directory');
      expect(html).toContain('🌧️ Weather &amp; EOT');
      expect(html).toContain('🏛️ KRA WHT / WHVAT');
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
      expect(html).toContain('Apex Builders Kenya Ltd');
      expect(html).toContain('P051234567Z');
      expect(html).toContain('3% WHT Withheld');
      expect(html).toContain('2% WHVAT Withheld');
      expect(html).toContain('Net Disbursed');
      expect(html).toContain('Generate Tax Withholding Slip');
      expect(html).toContain('iTax Acknowledged');
    });

    it('embeds StatutoryTaxManagementView into CompanyAdminDashboard for executive compliance review', () => {
      const adminSession: AuthSession = {
        user: {
          id: 'user-admin',
          email: 'admin@apexbuilders.co.ke',
          fullName: 'Admin User',
          role: 'COMPANY_ADMIN',
          tenant: { id: 'tenant-123', name: 'Apex Builders Kenya Ltd', slug: 'apex', currency: 'KES' },
        },
        permissions: ['company.manage'],
        token: 'token',
      };

      const html = renderToString(<Dashboard session={adminSession} onLogout={() => {}} />).replace(/<!-- -->/g, '');
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
      expect(html).toContain('Simba Portland Cement 42.5N');
      expect(html).toContain('234,000.00');
      expect(html).toContain('HIGH');
      expect(html).toContain('New Material Request');
    });

    it('renders MaterialWastageVarianceCard with theoretical vs actual consumption, allowable tolerance, and financial loss', () => {
      const html = renderToString(
        <MaterialWastageVarianceCard projectId="test-proj-1" />
      ).replace(/<!-- -->/g, '');

      expect(html).toContain('Material Wastage &amp; Shrinkage Engine');
      expect(html).toContain('BS 8110 / Eurocode 2');
      expect(html).toContain('Simba Portland Cement 42.5N');
      expect(html).toContain('Standard Tolerance');
      expect(html).toContain('D16 High-Yield Rebar (Y16)');
      expect(html).toContain('Critical Unexplained Loss');
      expect(html).toContain('238,000.00');
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
      expect(html).toContain('SC-VAL-001');
      expect(html).toContain('Amani Mechanical &amp; Plumbing Ltd');
      expect(html).toContain('1,500,000.00');
      expect(html).toContain('150,000.00');
      expect(html).toContain('45,000.00');
      expect(html).toContain('1,305,000.00');
      expect(html).toContain('KCB-RTGS-20261102-88192');
      expect(html).toContain('New Subcontractor Claim');
    });

    it('embeds all 4 commercial modules into PmQsDashboard with navigation tabs', () => {
      const pmSession: AuthSession = {
        user: {
          id: 'user-pm',
          email: 'qs@apexbuilders.co.ke',
          fullName: 'David Kiprono',
          role: 'PM_QS',
          tenant: { id: 'tenant-123', name: 'Apex Builders Kenya Ltd', slug: 'apex', currency: 'KES' },
        },
        permissions: ['project.view', 'boq.manage', 'cost.manage'],
        token: 'token',
      };

      const html = renderToString(<Dashboard session={pmSession} onLogout={() => {}} />).replace(/<!-- -->/g, '');
      expect(html).toContain('📦 Material Requisitions');
      expect(html).toContain('⚖️ Wastage Variance');
      expect(html).toContain('📈 Cash Flow &amp; S-Curve');
      expect(html).toContain('📑 Subcontractor Valuations');
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
          tenant: { id: 'tenant-123', name: 'Apex Builders Kenya Ltd', slug: 'apex', currency: 'KES' },
        },
        permissions: ['company.manage'],
        token: 'token',
      };

      const html = renderToString(<Dashboard session={adminSession} onLogout={() => {}} />).replace(/<!-- -->/g, '');
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
          tenant: { id: 'tenant-123', name: 'Apex Builders Kenya Ltd', slug: 'apex', currency: 'KES' },
        },
        permissions: ['site.diary', 'cost.create'],
        token: 'token',
      };

      const html = renderToString(<Dashboard session={superSession} onLogout={() => {}} />).replace(/<!-- -->/g, '');
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
      expect(html).toContain('Fuel Siphoning Risk Flags');
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
          tenant: { id: 'tenant-123', name: 'Apex Builders Kenya Ltd', slug: 'apex', currency: 'KES' },
        },
        permissions: ['cost.manage', 'site.manage'],
        token: 'token',
      };

      const html = renderToString(<Dashboard session={pmSession} onLogout={() => {}} />).replace(/<!-- -->/g, '');
      expect(html).toContain('🚜 Plant &amp; Machinery');
      expect(html).toContain('👷 Labor Muster Roll');
      expect(html).toContain('🦺 Field Safety Scorecard');
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
          tenant: { id: 'tenant-123', name: 'Apex Builders Kenya Ltd', slug: 'apex', currency: 'KES' },
        },
        permissions: ['site.diary', 'cost.create'],
        token: 'token',
      };

      const html = renderToString(<Dashboard session={superSession} onLogout={() => {}} />).replace(/<!-- -->/g, '');
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
          tenant: { id: 'tenant-123', name: 'Apex Builders Kenya Ltd', slug: 'apex', currency: 'KES' },
        },
        permissions: ['company.manage'],
        token: 'token',
      };

      const html = renderToString(<Dashboard session={adminSession} onLogout={() => {}} />).replace(/<!-- -->/g, '');
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
          tenant: { id: 'tenant-123', name: 'Apex Builders Kenya Ltd', slug: 'apex', currency: 'KES' },
        },
        permissions: ['cost.manage', 'site.manage'],
        token: 'token',
      };

      const html = renderToString(<Dashboard session={pmSession} onLogout={() => {}} />).replace(/<!-- -->/g, '');
      expect(html).toContain('🧾 KRA e-TIMS Invoices');
      expect(html).toContain('💬 WhatsApp Site Bot');
      expect(html).toContain('🏦 Retention &amp; Bonds');
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
          tenant: { id: 'tenant-123', name: 'Apex Builders Kenya Ltd', slug: 'apex', currency: 'KES' },
        },
        permissions: ['site.diary', 'cost.create'],
        token: 'token',
      };

      const html = renderToString(<Dashboard session={superSession} onLogout={() => {}} />).replace(/<!-- -->/g, '');
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
          tenant: { id: 'tenant-123', name: 'Apex Builders Kenya Ltd', slug: 'apex', currency: 'KES' },
        },
        permissions: ['company.manage'],
        token: 'token',
      };

      const html = renderToString(<Dashboard session={adminSession} onLogout={() => {}} />).replace(/<!-- -->/g, '');
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
      expect(html).toContain('KES 25,000');
      expect(html).toContain('KES 7,500');
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
      expect(html).toContain('Critical Fuel Theft Anomaly Flagged');
      expect(html).toContain('Simulate 40L Diesel Siphoning Drop');
      expect(html).toContain('DIESEL SIPHONING FLAG');
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
          tenant: { id: 'tenant-123', name: 'Apex Builders Kenya Ltd', slug: 'apex', currency: 'KES' },
        },
        permissions: ['company.manage'],
        token: 'token',
      };

      const html = renderToString(<Dashboard session={adminSession} onLogout={() => {}} />).replace(/<!-- -->/g, '');
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
          tenant: { id: 'tenant-123', name: 'Apex Builders Kenya Ltd', slug: 'apex', currency: 'KES' },
        },
        permissions: ['site.diary', 'cost.create'],
        token: 'token',
      };

      const html = renderToString(<Dashboard session={superSession} onLogout={() => {}} />).replace(/<!-- -->/g, '');
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
          tenant: { id: 'tenant-123', name: 'Apex Builders Kenya Ltd', slug: 'apex', currency: 'KES' },
        },
        permissions: ['cost.manage', 'site.manage'],
        token: 'token',
      };

      const html = renderToString(<Dashboard session={pmSession} onLogout={() => {}} />).replace(/<!-- -->/g, '');
      expect(html).toContain('📍 Site Geofencing');
      expect(html).toContain('🛰️ Plant Telematics');
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
      expect(html).toContain('⚡ Disburse via M-Pesa B2C');
      expect(html).toContain('Kariuki Mwangi (Site Mason)');
      expect(html).toContain('KES 12,500.00');
      expect(html).toContain('Athi River Plumbing Services');
      expect(html).toContain('KES 50,000.00');
      expect(html).toContain('SKL99887766');
    });

    it('embeds BarBendingScheduleView and MpesaDisbursementView into PmQsDashboard', () => {
      const pmSession: AuthSession = {
        user: {
          id: 'user-pm',
          email: 'pm@apexbuilders.co.ke',
          fullName: 'Project Manager / QS',
          role: 'PM_QS',
          tenant: { id: 'tenant-123', name: 'Apex Builders Kenya Ltd', slug: 'apex', currency: 'KES' },
        },
        permissions: ['cost.manage', 'site.manage'],
        token: 'token',
      };

      const html = renderToString(<Dashboard session={pmSession} onLogout={() => {}} />).replace(/<!-- -->/g, '');
      expect(html).toContain('🏗️ Rebar BBS Takeoff');
      expect(html).toContain('💸 M-Pesa B2C Payouts');
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
          tenant: { id: 'tenant-123', name: 'Apex Builders Kenya Ltd', slug: 'apex', currency: 'KES' },
        },
        permissions: ['site.diary', 'cost.create'],
        token: 'token',
      };

      const html = renderToString(<Dashboard session={superSession} onLogout={() => {}} />).replace(/<!-- -->/g, '');
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
          tenant: { id: 'tenant-123', name: 'Apex Builders Kenya Ltd', slug: 'apex', currency: 'KES' },
        },
        permissions: ['company.manage'],
        token: 'token',
      };

      const html = renderToString(<Dashboard session={adminSession} onLogout={() => {}} />).replace(/<!-- -->/g, '');
      expect(html).toContain('Safaricom Daraja B2C Bulk Wages &amp; Retention Disbursements');
      expect(html).toContain('Live B2C Gateway');
    });
  });
});
