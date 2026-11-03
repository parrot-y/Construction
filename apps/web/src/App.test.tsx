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
});