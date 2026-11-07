import React, { useState } from 'react';
import { toCurrencyString } from '@construction/money';
import { AuthSession } from '../types/auth';
import BoqImportModal from './BoqImportModal';
import PhysicalProgressModal from './PhysicalProgressModal';
import BudgetSummaryCard from './BudgetSummaryCard';
import CostManagementView from './CostManagementView';
import VarianceMonitorCard from './VarianceMonitorCard';
import VariationManagementView from './VariationManagementView';
import RfiManagementView from './RfiManagementView';
import QualityControlView from './QualityControlView';
import PracticalCompletionCard from './PracticalCompletionCard';
import CertificatesCloseoutView from './CertificatesCloseoutView';
import CommitmentsView from './CommitmentsView';
import ProjectOnboardingView from './ProjectOnboardingView';
import AnnouncementsView from './AnnouncementsView';
import InboxView from './InboxView';
import ObservationsView from './ObservationsView';
import CrewsView from './CrewsView';
import CompanyDocumentsView from './CompanyDocumentsView';
import CorrespondenceView from './CorrespondenceView';
import ScheduledReportsView from './ScheduledReportsView';
import PortalAccessLinkManager from './PortalAccessLinkManager';
import ProjectScheduleGanttView from './ProjectScheduleGanttView';
import SiteInventoryManagementView from './SiteInventoryManagementView';
import SafetyIncidentLogView from './SafetyIncidentLogView';
import ProjectDocumentVaultView from './ProjectDocumentVaultView';
import SubcontractorManagementView from './SubcontractorManagementView';
import WeatherDelayClaimsView from './WeatherDelayClaimsView';
import StatutoryTaxManagementView from './StatutoryTaxManagementView';
import { MaterialRequisitionView } from './MaterialRequisitionView';
import { MaterialWastageVarianceCard } from './MaterialWastageVarianceCard';
import { ProjectSCurveCashFlowCard } from './ProjectSCurveCashFlowCard';
import { SubcontractorValuationView } from './SubcontractorValuationView';
import { PlantEquipmentView } from './PlantEquipmentView';
import { LaborMusterRollView } from './LaborMusterRollView';
import { SafetyAuditScorecardView } from './SafetyAuditScorecardView';
import { ETimsTaxComplianceView } from './ETimsTaxComplianceView';
import { WhatsAppSiteWebhookView } from './WhatsAppSiteWebhookView';
import { RetentionAndBondsView } from './RetentionAndBondsView';
import { GeofencedClockInView } from './GeofencedClockInView';
import { PlantTelematicsView } from './PlantTelematicsView';
import { BarBendingScheduleView } from './BarBendingScheduleView';
import { MpesaDisbursementView } from './MpesaDisbursementView';
import { RmcTransitTrackerView } from './RmcTransitTrackerView';
import { StructuralSteelTakeoffView } from './StructuralSteelTakeoffView';
import { GeotechnicalSoilView } from './GeotechnicalSoilView';
import { AsphaltPavementView } from './AsphaltPavementView';
import { TopographicSurveyView } from './TopographicSurveyView';
import IndependentSiteReportView from './IndependentSiteReportView';
import ContractorTenderBoardView from './ContractorTenderBoardView';
import QuotesManagementView from './QuotesManagementView';
import InvoicingView from './InvoicingView';

interface PmQsDashboardProps {
  session: AuthSession;
  onPreviewPortal?: (portalType: string, token: string, name: string, role?: string) => void;
}

export default function PmQsDashboard({ session, onPreviewPortal }: PmQsDashboardProps): React.JSX.Element {
  const { user } = session;
  const sampleBudget = toCurrencyString('45000000.00');
  const [showBoqModal, setShowBoqModal] = useState(false);
  const [boqSuccess, setBoqSuccess] = useState<string | null>(null);
  const [showProgressModal, setShowProgressModal] = useState(false);
  const [progressSuccess, setProgressSuccess] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'all' | 'cost' | 'variations' | 'rfis' | 'quality' | 'closeout' | 'portals' | 'schedule' | 'store' | 'safety' | 'drawings' | 'subcontractors' | 'delays' | 'taxes' | 'requisitions' | 'wastage' | 'cashflow' | 'subvaluations' | 'equipment' | 'muster' | 'safetyaudit' | 'etims' | 'whatsapp' | 'retentionbonds' | 'geofence' | 'telematics' | 'rebar' | 'disbursements' | 'rmc' | 'steel' | 'soil' | 'asphalt' | 'survey' | 'inspections' | 'tenders' | 'quotes' | 'invoices' | 'commitments' | 'project' | 'announcements' | 'inbox' | 'observations' | 'crews' | 'documents' | 'correspondence' | 'scheduled'>('all');

  const handleImportSuccess = (boq: any) => {
    setBoqSuccess(`BOQ Version ${boq.version} successfully imported and committed (Grand Total: KES ${boq.total_amount})`);
  };

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <span className="text-xs font-bold text-purple-700 bg-purple-50 border border-purple-200 px-2.5 py-0.5 rounded-full uppercase tracking-wider">
            PM / Quantity Surveyor Workspace
          </span>
          <h2 className="text-xl font-bold text-slate-900 mt-1">Cost Control & BOQ Management</h2>
          <p className="text-xs text-slate-500">
            Quantity surveyor controls, BOQ baseline, interim valuations, and variance tracking for {user.tenant.name}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <a
            href="/api/v1/projects/project-rcp-2026/reports/ipc"
            download
            data-testid="download-ipc-btn"
            className="px-3.5 py-2 text-xs font-semibold bg-emerald-700 hover:bg-emerald-800 text-white rounded-lg shadow-sm transition flex items-center gap-1.5"
            title="Download Interim Payment Certificate (IPC PDF)"
          >
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            <span>Download IPC (PDF)</span>
          </a>
          <a
            href="/api/v1/projects/project-rcp-2026/reports/summary"
            download
            data-testid="download-summary-btn"
            className="px-3.5 py-2 text-xs font-semibold bg-slate-800 hover:bg-slate-900 text-white rounded-lg shadow-sm transition flex items-center gap-1.5"
            title="Download Project Summary (PDF)"
          >
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            <span>Project Summary (PDF)</span>
          </a>
          <button
            onClick={() => setShowProgressModal(true)}
            className="px-3.5 py-2 text-xs font-semibold bg-blue-600 hover:bg-blue-700 text-white rounded-lg shadow-sm transition flex items-center gap-1.5"
          >
            📈 Record Progress
          </button>
          <button
            onClick={() => setShowBoqModal(true)}
            className="px-3.5 py-2 text-xs font-semibold bg-purple-600 hover:bg-purple-700 text-white rounded-lg shadow-sm transition flex items-center gap-1.5"
          >
            📊 Import Excel BOQ
          </button>
          <span className="hidden sm:inline-block px-3 py-1.5 text-xs font-semibold bg-purple-50 text-purple-700 border border-purple-200 rounded-lg">
            BORAQS / EASMM
          </span>
        </div>
      </div>

      {progressSuccess && (
        <div className="p-3 bg-blue-50 border border-blue-200 text-blue-800 text-xs font-medium rounded-lg flex justify-between items-center">
          <span>✓ {progressSuccess}</span>
          <button onClick={() => setProgressSuccess(null)} className="text-blue-600 hover:text-blue-900 font-bold ml-2">×</button>
        </div>
      )}

      {boqSuccess && (
        <div className="p-3 bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-medium rounded-lg flex justify-between items-center">
          <span>✓ {boqSuccess}</span>
          <button onClick={() => setBoqSuccess(null)} className="text-emerald-600 hover:text-emerald-900 font-bold ml-2">×</button>
        </div>
      )}

      {/* Navigation Module Tabs */}
      <div className="flex flex-wrap items-center gap-1.5 bg-white p-1.5 rounded-xl border border-slate-200 shadow-xs text-xs font-semibold">
        {[
          { id: 'all', label: 'All Modules' },
          { id: 'schedule', label: '📅 Schedule & Gantt' },
          { id: 'store', label: '📦 Site Inventory' },
          { id: 'subcontractors', label: '🤝 Subcontractors' },
          { id: 'drawings', label: '📐 Drawings Vault' },
          { id: 'safety', label: '🦺 HSE & Safety' },
          { id: 'cost', label: '💰 Costs & BOQ' },
          { id: 'variations', label: '📑 Variations' },
          { id: 'rfis', label: '📋 RFI Register' },
          { id: 'quality', label: '🧪 Quality & Cubes' },
          { id: 'delays', label: '🌧️ Weather & EOT' },
          { id: 'taxes', label: '🏛️ KRA WHT / WHVAT' },
          { id: 'requisitions', label: '📦 Material Requisitions' },
          { id: 'wastage', label: '⚖️ Wastage Variance' },
          { id: 'cashflow', label: '📈 Cash Flow & S-Curve' },
          { id: 'subvaluations', label: '📑 Subcontractor Valuations' },
          { id: 'equipment', label: '🚜 Plant & Machinery' },
          { id: 'muster', label: '👷 Labor Muster Roll' },
          { id: 'safetyaudit', label: '🦺 Field Safety Scorecard' },
          { id: 'etims', label: '🧾 KRA e-TIMS Invoices' },
          { id: 'whatsapp', label: '💬 WhatsApp Site Bot' },
          { id: 'retentionbonds', label: '🏦 Retention & Bonds' },
          { id: 'geofence', label: '📍 Site Geofencing' },
          { id: 'telematics', label: '🛰️ Plant Telematics' },
          { id: 'rebar', label: '🏗️ Rebar BBS Takeoff' },
          { id: 'disbursements', label: '💸 M-Pesa B2C Payouts' },
          { id: 'rmc', label: '🚛 RMC Transit & Slump' },
          { id: 'steel', label: '⚙️ Structural Steel Takeoff' },
          { id: 'soil', label: '⛰️ Geotechnical Soil QA' },
          { id: 'asphalt', label: '🛣️ Asphalt Pavement QA' },
          { id: 'survey', label: '📐 Topographic Survey & Earthworks' },
          { id: 'quotes', label: '💼 Quotes & Cash' },
          { id: 'invoices', label: '🧾 Invoicing' },
          { id: 'commitments', label: '🤝 Commitments' },
          { id: 'project', label: '🏗️ Project' },
          { id: 'announcements', label: '📣 Announcements' },
          { id: 'inbox', label: '✉️ Inbox' },
          { id: 'observations', label: '🔍 Observations' },
          { id: 'crews', label: '👷 Crews' },
          { id: 'documents', label: '📁 Documents' },
          { id: 'correspondence', label: '✉️ Correspondence' },
          { id: 'scheduled', label: '📅 Scheduled' },
          { id: 'inspections', label: '🕵️ Site Inspections' },
          { id: 'tenders', label: '📑 Tender Board' },
          { id: 'closeout', label: '🏆 Closeout & Retention' },
          { id: 'portals', label: '🌐 Stakeholder Portals' },
        ].map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id as any)}
            className={`px-3 py-1.5 rounded-lg transition ${
              activeTab === tab.id
                ? 'bg-purple-700 text-white shadow-xs'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Metrics Row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
          <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider block">
            Approved Budget Baseline
          </span>
          <span className="text-lg font-bold font-mono text-slate-900 mt-1 block">
            KES {sampleBudget}
          </span>
          <span className="text-[11px] text-emerald-600 font-medium mt-0.5 block">Locked contract baseline</span>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
          <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider block">
            Active BOQs
          </span>
          <span className="text-2xl font-bold text-slate-900 mt-1 block">1 Active</span>
          <span className="text-[11px] text-slate-400 mt-0.5 block">EASMM 2008 Standard</span>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
          <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider block">
            Pending Cost Reviews
          </span>
          <span className="text-2xl font-bold text-slate-900 mt-1 block">0 Pending</span>
          <span className="text-[11px] text-slate-400 mt-0.5 block">All cost entries settled</span>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
          <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider block">
            Variations Under Review
          </span>
          <span className="text-2xl font-bold text-slate-900 mt-1 block">0 Orders</span>
          <span className="text-[11px] text-slate-400 mt-0.5 block">Net adjustment: KES 0.00</span>
        </div>
      </div>

      {/* Core Loop Workflow Monitor */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6 space-y-3">
        <h3 className="text-sm font-bold text-slate-900">Core Loop Workflow Status</h3>
        <p className="text-xs text-slate-500">
          Enforcing strict Kenyan construction financial and progress lifecycle:
        </p>
        <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-7 gap-2 pt-2">
          <div className="p-2.5 bg-emerald-50 border border-emerald-200 rounded-lg text-center">
            <span className="text-[10px] font-bold text-emerald-800 block">1. BOQ</span>
            <span className="text-[11px] font-semibold text-emerald-900 block mt-0.5">Imported ✓</span>
          </div>
          <div className="p-2.5 bg-emerald-50 border border-emerald-200 rounded-lg text-center">
            <span className="text-[10px] font-bold text-emerald-800 block">2. Budget</span>
            <span className="text-[11px] font-semibold text-emerald-900 block mt-0.5">Locked ✓</span>
          </div>
          <div className="p-2.5 bg-blue-50 border border-blue-200 rounded-lg text-center">
            <span className="text-[10px] font-bold text-blue-800 block">3. Site Progress</span>
            <span className="text-[11px] font-semibold text-blue-900 block mt-0.5">In Progress</span>
          </div>
          <div className="p-2.5 bg-slate-50 border border-slate-200 rounded-lg text-center">
            <span className="text-[10px] font-bold text-slate-600 block">4. Actual Cost</span>
            <span className="text-[11px] font-medium text-slate-500 block mt-0.5">Queued</span>
          </div>
          <div className="p-2.5 bg-slate-50 border border-slate-200 rounded-lg text-center">
            <span className="text-[10px] font-bold text-slate-600 block">5. Evidence</span>
            <span className="text-[11px] font-medium text-slate-500 block mt-0.5">Pending</span>
          </div>
          <div className="p-2.5 bg-slate-50 border border-slate-200 rounded-lg text-center">
            <span className="text-[10px] font-bold text-slate-600 block">6. Approvals</span>
            <span className="text-[11px] font-medium text-slate-500 block mt-0.5">Pending</span>
          </div>
          <div className="p-2.5 bg-slate-50 border border-slate-200 rounded-lg text-center">
            <span className="text-[10px] font-bold text-slate-600 block">7. Client View</span>
            <span className="text-[11px] font-medium text-slate-500 block mt-0.5">Live</span>
          </div>
        </div>
      </div>

      {/* Variance Monitor & Neutral Alert Guard (Milestone M7) */}
      <VarianceMonitorCard projectName="Riverside Commercial Plaza" />

      {/* Active Project & Bill of Quantities Structure */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6 space-y-4">
        <div className="flex justify-between items-start">
          <div>
            <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Assigned Project Baseline</span>
            <h3 className="text-lg font-bold text-slate-900 mt-0.5">Riverside Commercial Plaza</h3>
            <p className="text-xs text-slate-500">Riverside Drive, Nairobi • Code: RCP-2026</p>
          </div>
          <span className="px-2.5 py-1 text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200 rounded-full">
            Active Project
          </span>
        </div>

        <div className="border border-slate-200 rounded-lg overflow-hidden">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 font-semibold uppercase tracking-wider">
              <tr>
                <th className="p-3">BOQ Section</th>
                <th className="p-3">Standard Reference</th>
                <th className="p-3">Original Budget</th>
                <th className="p-3">Current Budget</th>
                <th className="p-3">Actual Cost</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-slate-700">
              <tr className="hover:bg-slate-50/50">
                <td className="p-3 font-semibold text-slate-900">Section 1: Preliminaries & General</td>
                <td className="p-3 text-slate-500">EASMM Section A</td>
                <td className="p-3 font-mono font-medium">KES {toCurrencyString('4500000.00')}</td>
                <td className="p-3 font-mono font-medium">KES {toCurrencyString('4500000.00')}</td>
                <td className="p-3 font-mono text-slate-400">KES 0.00</td>
              </tr>
              <tr className="hover:bg-slate-50/50">
                <td className="p-3 font-semibold text-slate-900">Section 2: Substructure & Earthworks</td>
                <td className="p-3 text-slate-500">EASMM Section D</td>
                <td className="p-3 font-mono font-medium">KES {toCurrencyString('12000000.00')}</td>
                <td className="p-3 font-mono font-medium">KES {toCurrencyString('12000000.00')}</td>
                <td className="p-3 font-mono text-slate-400">KES 0.00</td>
              </tr>
              <tr className="hover:bg-slate-50/50">
                <td className="p-3 font-semibold text-slate-900">Section 3: Reinforced Concrete Frame</td>
                <td className="p-3 text-slate-500">EASMM Section F</td>
                <td className="p-3 font-mono font-medium">KES {toCurrencyString('18500000.00')}</td>
                <td className="p-3 font-mono font-medium">KES {toCurrencyString('18500000.00')}</td>
                <td className="p-3 font-mono text-slate-400">KES 0.00</td>
              </tr>
              <tr className="hover:bg-slate-50/50">
                <td className="p-3 font-semibold text-slate-900">Section 4: Walling, Finishes & Services</td>
                <td className="p-3 text-slate-500">EASMM Section G & V</td>
                <td className="p-3 font-mono font-medium">KES {toCurrencyString('10000000.00')}</td>
                <td className="p-3 font-mono font-medium">KES {toCurrencyString('10000000.00')}</td>
                <td className="p-3 font-mono text-slate-400">KES 0.00</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      {/* Budget vs Actual Metrics Card */}
      <BudgetSummaryCard projectName="Riverside Commercial Plaza" />

      {/* Append-Only Costs & Approvals Ledger */}
      <CostManagementView
        projectId="project-rcp-2026"
        canApprove={true}
        canCreate={true}
      />

      {/* Variations & Scope Adjustments Workflow (Milestone M8) */}
      {(activeTab === 'all' || activeTab === 'variations') && (
        <VariationManagementView
          projectId="project-rcp-2026"
          userRole="PM_QS"
          canRequest={true}
          canReview={true}
          canApprove={true}
        />
      )}

      {/* RFI Technical Clarifications Register */}
      {(activeTab === 'all' || activeTab === 'rfis') && (
        <RfiManagementView
          projectId="project-rcp-2026"
          projectName="Riverside Commercial Plaza"
          canCreate={true}
        />
      )}

      {/* Pre-Pour Quality Hold Points & Concrete Cube Tests */}
      {(activeTab === 'all' || activeTab === 'quality') && (
        <QualityControlView
          projectId="project-rcp-2026"
          projectName="Riverside Commercial Plaza"
          canApprove={true}
        />
      )}

      {/* Interim Payment Certificates & Closeout Stage Machine (Gate-4 S4 / ADR-008) */}
      {(activeTab === 'all' || activeTab === 'closeout') && (
        <CertificatesCloseoutView projectId="project-rcp-2026" canManage={true} />
      )}

      {/* Practical Completion & Retention Release Card */}
      {(activeTab === 'all' || activeTab === 'closeout') && (
        <PracticalCompletionCard
          projectName="Riverside Commercial Plaza"
          projectCode="RCP-2026"
        />
      )}

      {/* External Stakeholder Portals Manager (Zero Seat Tax) */}
      {(activeTab === 'all' || activeTab === 'portals') && (
        <PortalAccessLinkManager
          projectId="project-rcp-2026"
          onPreviewPortal={onPreviewPortal}
        />
      )}

      {/* Interactive Project Schedule & Gantt View */}
      {(activeTab === 'all' || activeTab === 'schedule') && (
        <ProjectScheduleGanttView
          projectId="project-rcp-2026"
          canEdit={true}
        />
      )}

      {/* Site Store Materials & Inventory View */}
      {(activeTab === 'all' || activeTab === 'store') && (
        <SiteInventoryManagementView
          projectId="project-rcp-2026"
          canManage={true}
        />
      )}

      {/* Subcontractor Work Packages & Directory */}
      {(activeTab === 'all' || activeTab === 'subcontractors') && (
        <SubcontractorManagementView
          projectId="project-rcp-2026"
          canAward={true}
        />
      )}

      {/* Project Drawing & Regulatory Document Vault */}
      {(activeTab === 'all' || activeTab === 'drawings') && (
        <ProjectDocumentVaultView
          projectId="project-rcp-2026"
          canUpload={true}
        />
      )}

      {/* Safety & HSE Incident Register (OSHA 2007) */}
      {(activeTab === 'all' || activeTab === 'safety') && (
        <SafetyIncidentLogView
          projectId="project-rcp-2026"
          canLog={true}
          canInvestigate={true}
        />
      )}

      {/* Weather Delays & Extension of Time (JBC Clause 25/32) */}
      {(activeTab === 'all' || activeTab === 'delays') && (
        <WeatherDelayClaimsView
          projectId="project-rcp-2026"
          canClaim={true}
          canReview={true}
        />
      )}

      {/* KRA Statutory Withholding Tax (Cap 470) & WHVAT Certificates */}
      {(activeTab === 'all' || activeTab === 'taxes') && (
        <StatutoryTaxManagementView
          projectId="project-rcp-2026"
          canIssue={true}
        />
      )}

      {/* Material Purchase Requisitions & Orders (Platform Benchmark) */}
      {(activeTab === 'all' || activeTab === 'requisitions') && (
        <MaterialRequisitionView
          projectId="project-rcp-2026"
          projectName="Riverside Commercial Plaza"
          userRole="PM_QS"
        />
      )}

      {/* Material Wastage & Theoretical Loss Engine */}
      {(activeTab === 'all' || activeTab === 'wastage') && (
        <MaterialWastageVarianceCard
          projectId="project-rcp-2026"
          projectName="Riverside Commercial Plaza"
        />
      )}

      {/* Cash Flow Forecasting & S-Curve */}
      {(activeTab === 'all' || activeTab === 'cashflow') && (
        <ProjectSCurveCashFlowCard
          projectId="project-rcp-2026"
          projectName="Riverside Commercial Plaza"
        />
      )}

      {/* Subcontractor Valuations & Back-to-Back Retention Ledger */}
      {(activeTab === 'all' || activeTab === 'subvaluations') && (
        <SubcontractorValuationView
          projectId="project-rcp-2026"
          projectName="Riverside Commercial Plaza"
          userRole="PM_QS"
        />
      )}

      {/* Plant, Machinery & Fuel Siphoning Audit (Milestone M16) */}
      {(activeTab === 'all' || activeTab === 'equipment') && (
        <PlantEquipmentView
          projectId="project-rcp-2026"
          projectName="Riverside Commercial Plaza"
          userRole="PM_QS"
        />
      )}

      {/* Site Casual Labor Muster Roll & Artisan Payroll (Milestone M17) */}
      {(activeTab === 'all' || activeTab === 'muster') && (
        <LaborMusterRollView
          projectId="project-rcp-2026"
          projectName="Riverside Commercial Plaza"
          userRole="PM_QS"
        />
      )}

      {/* Field Safety Audits & DOSHS/NCA Compliance Scorecards (Milestone M18) */}
      {(activeTab === 'all' || activeTab === 'safetyaudit') && (
        <SafetyAuditScorecardView
          projectId="project-rcp-2026"
          projectName="Riverside Commercial Plaza"
          userRole="PM_QS"
        />
      )}

      {/* KRA e-TIMS Electronic Tax Invoices & TCC Compliance (Milestone M19) */}
      {(activeTab === 'all' || activeTab === 'etims') && (
        <ETimsTaxComplianceView
          projectId="project-rcp-2026"
          projectName="Riverside Commercial Plaza"
          userRole="PM_QS"
        />
      )}

      {/* WhatsApp & SMS Two-Way Site Ops Webhook Stream (Milestone M20) */}
      {(activeTab === 'all' || activeTab === 'whatsapp') && (
        <WhatsAppSiteWebhookView
          projectId="project-rcp-2026"
          projectName="Riverside Commercial Plaza"
          userRole="PM_QS"
        />
      )}

      {/* Subcontractor Dual-Moiety Retention & Contractor Performance Bonds (Milestone M21) */}
      {(activeTab === 'all' || activeTab === 'retentionbonds') && (
        <RetentionAndBondsView
          projectId="project-rcp-2026"
          projectName="Riverside Commercial Plaza"
          userRole="PM_QS"
        />
      )}

      {/* Project Geofencing & Biometric Mobile Clock-In (Milestone M23) */}
      {(activeTab === 'all' || activeTab === 'geofence') && (
        <GeofencedClockInView
          projectId="project-rcp-2026"
          projectName="Riverside Commercial Plaza"
        />
      )}

      {/* Plant GPS Telematics & Remote Fuel Siphoning Anomaly Detection (Milestone M24) */}
      {(activeTab === 'all' || activeTab === 'telematics') && (
        <PlantTelematicsView
          projectId="project-rcp-2026"
          projectName="Riverside Commercial Plaza"
        />
      )}

      {/* BS 8666 / KS 02-598 Rebar Takeoff & Bar Bending Schedules (Milestone M25) */}
      {(activeTab === 'all' || activeTab === 'rebar') && (
        <BarBendingScheduleView
          projectId="project-rcp-2026"
          projectName="Riverside Commercial Plaza"
        />
      )}

      {/* Safaricom Daraja B2C Bulk Wages & Retention Disbursements (Milestone M26) */}
      {(activeTab === 'all' || activeTab === 'disbursements') && (
        <MpesaDisbursementView
          projectId="project-rcp-2026"
          projectName="Riverside Commercial Plaza"
        />
      )}

      {/* Ready-Mix Concrete (RMC) Batching & Transit Slump Tracker (Milestone M27) */}
      {(activeTab === 'all' || activeTab === 'rmc') && (
        <RmcTransitTrackerView
          projectId="project-rcp-2026"
          projectName="Riverside Commercial Plaza"
        />
      )}

      {/* Structural Steel Framing & Fabrication Takeoff Engine (Milestone M28) */}
      {(activeTab === 'all' || activeTab === 'steel') && (
        <StructuralSteelTakeoffView
          projectId="project-rcp-2026"
          projectName="Riverside Commercial Plaza"
        />
      )}

      {/* Geotechnical Soil Compaction QA Engine (Milestone M29) */}
      {(activeTab === 'all' || activeTab === 'soil') && (
        <GeotechnicalSoilView
          projectId="project-rcp-2026"
          projectName="Riverside Commercial Plaza"
        />
      )}

      {/* Asphalt Pavement Quality & Thermal Tracker (Milestone M30) */}
      {(activeTab === 'all' || activeTab === 'asphalt') && (
        <AsphaltPavementView
          projectId="project-rcp-2026"
          projectName="Riverside Commercial Plaza"
        />
      )}

      {/* Topographic Survey & Earthworks Engine (Milestone M31) */}
      {(activeTab === 'all' || activeTab === 'survey') && (
        <TopographicSurveyView
          projectId="project-rcp-2026"
          projectName="Riverside Commercial Plaza"
        />
      )}

      {/* Platform Diaspora Independent Site Inspection Reports (Milestone M33) */}
      {(activeTab === 'all' || activeTab === 'inspections') && (
        <IndependentSiteReportView
          projectId="project-rcp-2026"
          projectName="Riverside Commercial Plaza"
          userRole="PM_QS"
        />
      )}

      {/* Platform Contractor Tender Board & Bidding Studio (Milestone M33) */}
      {(activeTab === 'all' || activeTab === 'tenders') && (
        <ContractorTenderBoardView
          projectId="project-rcp-2026"
          projectName="Riverside Commercial Plaza"
          userRole="PM_QS"
        />
      )}

      {/* Quotes-to-Cash: quotations, client acceptance, project conversion (Gate-4 S1) */}
      {(activeTab === 'all' || activeTab === 'quotes') && <QuotesManagementView />}

      {/* Invoicing: AR invoices, payments, PDF tax invoices (Gate-4 S2) */}
      {(activeTab === 'all' || activeTab === 'invoices') && <InvoicingView />}

      {/* Commitments -> Claims -> Payment Applications (Gate-4 S5) */}
      {(activeTab === 'all' || activeTab === 'commitments') && (
        <CommitmentsView projectId="project-rcp-2026" canManage={true} />
      )}

      {/* Project onboarding & edit (Gate-4 S8) */}
      {(activeTab === 'all' || activeTab === 'project') && <ProjectOnboardingView />}

      {/* Announcements (Gate-5 G5-1) */}
      {(activeTab === 'all' || activeTab === 'announcements') && <AnnouncementsView canManage={true} />}

      {/* Scheduled reports (Gate-5 G5-9) */}
      {(activeTab === 'all' || activeTab === 'scheduled') && <ScheduledReportsView canManage={true} />}

      {/* Correspondence log (Gate-5 G5-8) */}
      {(activeTab === 'all' || activeTab === 'correspondence') && <CorrespondenceView canManage={true} />}

      {/* Company documents vault (Gate-5 G5-7) */}
      {(activeTab === 'all' || activeTab === 'documents') && <CompanyDocumentsView canManage={true} />}

      {/* Crews (Gate-5 G5-5) */}
      {(activeTab === 'all' || activeTab === 'crews') && <CrewsView canManage={true} />}

      {/* Observations & corrective actions (Gate-5 G5-4) */}
      {(activeTab === 'all' || activeTab === 'observations') && <ObservationsView projectId="project-rcp-2026" canManage={true} />}

      {/* Team inbox (Gate-5 G5-3) */}
      {(activeTab === 'all' || activeTab === 'inbox') && <InboxView currentUserId={user?.id} />}

      {/* BOQ Import Modal */}
      <BoqImportModal
        isOpen={showBoqModal}
        onClose={() => setShowBoqModal(false)}
        onImportSuccess={handleImportSuccess}
        projectId="project-rcp-2026"
        projectName="Riverside Commercial Plaza"
      />

      {/* Physical Progress Inspection Modal */}
      <PhysicalProgressModal
        isOpen={showProgressModal}
        onClose={() => setShowProgressModal(false)}
        projectId="project-rcp-2026"
        projectName="Riverside Commercial Plaza"
        onProgressRecorded={(prog) => {
          const pct = prog.overallProgress ? (parseFloat(prog.overallProgress) * 100).toFixed(1) : '15.0';
          setProgressSuccess(`QS site progress inspection verified and recorded (${pct}% cumulative completion)`);
        }}
      />
    </div>
  );
}