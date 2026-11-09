import { formatKes} from '../ui';
import React, { useEffect, useState} from 'react';
import { AuthSession} from '../types/auth';
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
import AttendanceView from './AttendanceView';
import ChecklistsView from './ChecklistsView';
import PortalAccessLinkManager from './PortalAccessLinkManager';
import ProjectScheduleGanttView from './ProjectScheduleGanttView';
import SiteInventoryManagementView from './SiteInventoryManagementView';
import SafetyIncidentLogView from './SafetyIncidentLogView';
import ProjectDocumentVaultView from './ProjectDocumentVaultView';
import SubcontractorManagementView from './SubcontractorManagementView';
import WeatherDelayClaimsView from './WeatherDelayClaimsView';
import StatutoryTaxManagementView from './StatutoryTaxManagementView';
import { MaterialRequisitionView} from './MaterialRequisitionView';
import { MaterialWastageVarianceCard} from './MaterialWastageVarianceCard';
import { ProjectSCurveCashFlowCard} from './ProjectSCurveCashFlowCard';
import { SubcontractorValuationView} from './SubcontractorValuationView';
import { PlantEquipmentView} from './PlantEquipmentView';
import { LaborMusterRollView} from './LaborMusterRollView';
import { SafetyAuditScorecardView} from './SafetyAuditScorecardView';
import { ETimsTaxComplianceView} from './ETimsTaxComplianceView';
import { WhatsAppSiteWebhookView} from './WhatsAppSiteWebhookView';
import { RetentionAndBondsView} from './RetentionAndBondsView';
import { GeofencedClockInView} from './GeofencedClockInView';
import { PlantTelematicsView} from './PlantTelematicsView';
import { BarBendingScheduleView} from './BarBendingScheduleView';
import { MpesaDisbursementView} from './MpesaDisbursementView';
import { RmcTransitTrackerView} from './RmcTransitTrackerView';
import { StructuralSteelTakeoffView} from './StructuralSteelTakeoffView';
import { GeotechnicalSoilView} from './GeotechnicalSoilView';
import { AsphaltPavementView} from './AsphaltPavementView';
import { TopographicSurveyView} from './TopographicSurveyView';
import IndependentSiteReportView from './IndependentSiteReportView';
import ContractorTenderBoardView from './ContractorTenderBoardView';
import { isModuleEnabled } from '../lib/modules';
import QuotesManagementView from './QuotesManagementView';
import InvoicingView from './InvoicingView';

interface PmQsDashboardProps {
  session: AuthSession;
  onPreviewPortal?: (portalType: string, token: string, name: string, role?: string) => void;
}

export default function PmQsDashboard({ session, onPreviewPortal}: PmQsDashboardProps): React.JSX.Element {
  const { user} = session;
  const [projectDetail, setProjectDetail] = useState<{ name?: string; code?: string; location?: string } | null>(null);
  const [budgetSummary, setBudgetSummary] = useState<{ approvedBudget?: string; sectionBreakdown?: any[] } | null>(null);
  const [showBoqModal, setShowBoqModal] = useState(false);
  const [boqSuccess, setBoqSuccess] = useState<string | null>(null);
  const [showProgressModal, setShowProgressModal] = useState(false);
  const [progressSuccess, setProgressSuccess] = useState<string | null>(null);
  const [projects, setProjects] = useState<{ id: string; name: string; code: string}[]>([]);
  const [pid, setPid] = useState('');
  useEffect(() => {
    fetch('/api/v1/projects', { credentials: 'include'})
      .then((r) => r.json())
      .then((j) => {
        const list = (j.data || []).map((p: any) => ({ id: p.id, name: p.name, code: p.code}));
        setProjects(list);
        if (list.length) setPid(list[0].id);
})
      .catch(() => setProjects([]));
}, []);

  useEffect(() => {
    if (!pid) return;
    let cancelled = false;
    fetch(`/api/v1/projects/${pid}`, { credentials: 'include' })
      .then((r) => (r.ok ? r.json() : null))
      .then((j) => { if (!cancelled && j) setProjectDetail(j.data || j); })
      .catch(() => {});
    fetch(`/api/v1/projects/${pid}/budget/summary`, { credentials: 'include' })
      .then((r) => (r.ok ? r.json() : null))
      .then((j) => { if (!cancelled && j) setBudgetSummary(j.data || j); })
      .catch(() => {});
    return () => { cancelled = true; };
  }, [pid]);
  const [tabGroup, setTabGroup] = useState<'all' | 'core' | 'field' | 'money' | 'collab'>('core');
  const [activeTab, setActiveTab] = useState<'all' | 'cost' | 'variations' | 'rfis' | 'quality' | 'closeout' | 'portals' | 'schedule' | 'store' | 'safety' | 'drawings' | 'subcontractors' | 'delays' | 'taxes' | 'requisitions' | 'wastage' | 'cashflow' | 'subvaluations' | 'equipment' | 'muster' | 'safetyaudit' | 'etims' | 'whatsapp' | 'retentionbonds' | 'geofence' | 'telematics' | 'rebar' | 'disbursements' | 'rmc' | 'steel' | 'soil' | 'asphalt' | 'survey' | 'inspections' | 'tenders' | 'quotes' | 'invoices' | 'commitments' | 'project' | 'announcements' | 'inbox' | 'observations' | 'crews' | 'documents' | 'correspondence' | 'scheduled' | 'attendance' | 'checklists'>('all');

  const handleImportSuccess = (boq: any) => {
    setBoqSuccess(`BOQ Version ${boq.version} successfully imported and committed (Grand Total: ${formatKes(boq.total_amount)})`);
};

  const MODULE_TABS: { id: string; label: string; group: 'all' | 'core' | 'field' | 'money' | 'collab'}[] = [
    { id: 'all', label: 'All Modules', group: 'all'},
    { id: 'schedule', label: ' Schedule & Gantt', group: 'core'},
    { id: 'store', label: ' Site Inventory', group: 'core'},
    { id: 'subcontractors', label: ' Subcontractors', group: 'core'},
    { id: 'drawings', label: ' Drawings Vault', group: 'core'},
    { id: 'safety', label: ' HSE & Safety', group: 'core'},
    { id: 'cost', label: ' Costs & BOQ', group: 'core'},
    { id: 'variations', label: ' Variations', group: 'core'},
    { id: 'rfis', label: ' RFI Register', group: 'core'},
    { id: 'quality', label: ' Quality & Cubes', group: 'core'},
    { id: 'delays', label: ' Weather & EOT', group: 'core'},
    { id: 'closeout', label: ' Closeout & Retention', group: 'core'},
    { id: 'project', label: ' Project', group: 'core'},
    { id: 'portals', label: ' Stakeholder Portals', group: 'core'},
    { id: 'tenders', label: ' Tender Board', group: 'core'},
    { id: 'equipment', label: ' Plant & Machinery', group: 'field'},
    { id: 'muster', label: ' Labor Muster Roll', group: 'field'},
    { id: 'safetyaudit', label: ' Field Safety Scorecard', group: 'field'},
    { id: 'whatsapp', label: ' WhatsApp Site Bot', group: 'field'},
    { id: 'geofence', label: ' Site Geofencing', group: 'field'},
    { id: 'telematics', label: ' Plant Telematics', group: 'field'},
    { id: 'rebar', label: ' Rebar BBS Takeoff', group: 'field'},
    { id: 'rmc', label: ' RMC Transit & Slump', group: 'field'},
    { id: 'steel', label: ' Structural Steel Takeoff', group: 'field'},
    { id: 'soil', label: ' Geotechnical Soil QA', group: 'field'},
    { id: 'asphalt', label: ' Asphalt Pavement QA', group: 'field'},
    { id: 'survey', label: ' Topographic Survey & Earthworks', group: 'field'},
    { id: 'inspections', label: ' Site Inspections', group: 'field'},
    { id: 'attendance', label: ' Attendance', group: 'field'},
    { id: 'checklists', label: ' Checklists', group: 'field'},
    { id: 'crews', label: ' Crews', group: 'field'},
    { id: 'observations', label: ' Observations', group: 'field'},
    { id: 'taxes', label: ' KRA WHT / WHVAT', group: 'money'},
    { id: 'requisitions', label: ' Material Requisitions', group: 'money'},
    { id: 'wastage', label: ' Wastage Variance', group: 'money'},
    { id: 'cashflow', label: ' Cash Flow & S-Curve', group: 'money'},
    { id: 'subvaluations', label: ' Subcontractor Valuations', group: 'money'},
    { id: 'disbursements', label: ' M-Pesa B2C Payouts', group: 'money'},
    { id: 'etims', label: ' KRA e-TIMS Invoices', group: 'money'},
    { id: 'retentionbonds', label: ' Retention & Bonds', group: 'money'},
    { id: 'quotes', label: ' Quotes & Cash', group: 'money'},
    { id: 'invoices', label: ' Invoicing', group: 'money'},
    { id: 'commitments', label: ' Commitments', group: 'money'},
    { id: 'announcements', label: ' Announcements', group: 'collab'},
    { id: 'inbox', label: ' Inbox', group: 'collab'},
    { id: 'documents', label: ' Documents', group: 'collab'},
    { id: 'correspondence', label: ' Correspondence', group: 'collab'},
    { id: 'scheduled', label: ' Scheduled Reports', group: 'collab'},
  ];

  return (
<div className="space-y-6">
      {/* Header Banner */}
<div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
<div>
<span className="text-xs font-bold text-purple-700 bg-purple-50 border border-purple-200 px-2.5 py-0.5 rounded-full ">
            PM / Quantity Surveyor Workspace
</span>
<h2 className="text-xl font-bold text-slate-900 mt-1">Cost Control & BOQ Management</h2>
<p className="text-xs text-slate-500">
            Quantity surveyor controls, BOQ baseline, interim valuations, and variance tracking for {user.tenant.name}
</p>
</div>
<div className="flex flex-wrap items-center gap-2">
          {projects.length > 1 && (
<select value={pid} onChange={(e) => setPid(e.target.value)}
              className="border border-slate-300 rounded-lg px-2 py-1.5 text-xs max-w-[200px]">
              {projects.map((p) =><option key={p.id} value={p.id}>{p.code} — {p.name}</option>)}
</select>
)}
<a
            href={`/api/v1/projects/${pid}/reports/ipc`}
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
            href={`/api/v1/projects/${pid}/reports/summary`}
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
             Record Progress
</button>
<button
            onClick={() => setShowBoqModal(true)}
            className="px-3.5 py-2 text-xs font-semibold bg-purple-600 hover:bg-purple-700 text-white rounded-lg shadow-sm transition flex items-center gap-1.5"
          >
             Import Excel BOQ
</button>
<a
            href={`/api/v1/projects/${pid}/boq/export`}
            download
            data-testid="export-boq-btn"
            className="px-3.5 py-2 text-xs font-semibold bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-200 rounded-lg shadow-sm transition flex items-center gap-1.5"
            title="Download active BOQ as Excel workbook"
          >
            Export BOQ
</a>
<span className="hidden sm:inline-block px-3 py-1.5 text-xs font-semibold bg-purple-50 text-purple-700 border border-purple-200 rounded-lg">
            BORAQS / EASMM
</span>
</div>
</div>

      {progressSuccess && (
<div className="p-3 bg-blue-50 border border-blue-200 text-blue-800 text-xs font-medium rounded-lg flex justify-between items-center">
<span> {progressSuccess}</span>
<button onClick={() => setProgressSuccess(null)} className="text-blue-600 hover:text-blue-900 font-bold ml-2">×</button>
</div>
)}

      {boqSuccess && (
<div className="p-3 bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-medium rounded-lg flex justify-between items-center">
<span> {boqSuccess}</span>
<button onClick={() => setBoqSuccess(null)} className="text-emerald-600 hover:text-emerald-900 font-bold ml-2">×</button>
</div>
)}

      {/* Navigation Module Tabs */}
<div className="space-y-2">
<div className="flex gap-1.5 overflow-x-auto bg-white p-1 rounded-xl border border-slate-200 shadow-xs w-fit max-w-full">
          {([
            { id: 'all', label: 'All Modules'},
            { id: 'core', label: 'Projects & Delivery'},
            { id: 'field', label: 'Site & Field'},
            { id: 'money', label: 'Money & Tax'},
            { id: 'collab', label: 'Collaboration'},
          ] as const).map((g) => (
<button
              key={g.id}
              onClick={() => setTabGroup(g.id)}
              className={`px-3 py-1.5 rounded-lg whitespace-nowrap transition text-xs font-semibold ${
                tabGroup === g.id ? 'bg-slate-900 text-white' : 'text-slate-500 hover:bg-slate-100'
}`}
            >
              {g.label}
</button>
))}
</div>
<div className="flex flex-wrap items-center gap-1.5 bg-white p-1.5 rounded-xl border border-slate-200 shadow-xs text-xs font-semibold">
          {MODULE_TABS.filter((tab) => isModuleEnabled(tab.id)).map((tab) => (
<button
              key={tab.id}
              onClick={() => { setActiveTab(tab.id as any); if (tab.group !== 'all') setTabGroup(tab.group);}}
              className={`px-3 py-1.5 rounded-lg transition ${
                tabGroup !== 'all' && tab.id !== 'all' && tab.group !== tabGroup ? 'hidden' : ''
} ${
                activeTab === tab.id
                  ? 'bg-purple-700 text-white shadow-xs'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
}`}
            >
              {tab.label}
</button>
))}
</div>
</div>

      {/* Metrics Row */}
<div className="grid grid-cols-2 md:grid-cols-4 gap-4">
<div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
<span className="text-[11px] font-semibold text-slate-500 block">
            Approved Budget Baseline
</span>
<span className="text-lg font-bold font-mono text-slate-900 mt-1 block">
            {budgetSummary?.approvedBudget ? formatKes(budgetSummary.approvedBudget) : '—'}
</span>
<span className="text-[11px] text-emerald-600 font-medium mt-0.5 block">Locked contract baseline</span>
</div>

<div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
<span className="text-[11px] font-semibold text-slate-500 block">
            Active BOQs
</span>
<span className="text-2xl font-bold text-slate-900 mt-1 block">1 Active</span>
<span className="text-[11px] text-slate-400 mt-0.5 block">EASMM 2008 Standard</span>
</div>

<div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
<span className="text-[11px] font-semibold text-slate-500 block">
            Pending Cost Reviews
</span>
<span className="text-2xl font-bold text-slate-900 mt-1 block">0 Pending</span>
<span className="text-[11px] text-slate-400 mt-0.5 block">All cost entries settled</span>
</div>

<div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
<span className="text-[11px] font-semibold text-slate-500 block">
            Variations Under Review
</span>
<span className="text-2xl font-bold text-slate-900 mt-1 block">0 Orders</span>
<span className="text-[11px] text-slate-400 mt-0.5 block">Net adjustment: {formatKes(0)}</span>
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
<span className="text-[11px] font-semibold text-emerald-900 block mt-0.5">Imported</span>
</div>
<div className="p-2.5 bg-emerald-50 border border-emerald-200 rounded-lg text-center">
<span className="text-[10px] font-bold text-emerald-800 block">2. Budget</span>
<span className="text-[11px] font-semibold text-emerald-900 block mt-0.5">Locked</span>
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
<VarianceMonitorCard projectId={pid} projectName={projects.find((p) => p.id === pid)?.name || ''} />

      {/* Active Project & Bill of Quantities Structure */}
<div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6 space-y-4">
<div className="flex justify-between items-start">
<div>
<span className="text-xs font-bold text-slate-400 ">Assigned Project Baseline</span>
<h3 className="text-lg font-bold text-slate-900 mt-0.5">{projectDetail?.name || projects.find((p) => p.id === pid)?.name || '—'}</h3>
<p className="text-xs text-slate-500">{[projectDetail?.location, projectDetail?.code || projects.find((p) => p.id === pid)?.code].filter(Boolean).join(' • ') || '—'}</p>
</div>
<span className="px-2.5 py-1 text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200 rounded-full">
            Active Project
</span>
</div>

<div className="border border-slate-200 rounded-lg overflow-hidden">
<table className="w-full text-left text-xs">
<thead className="bg-slate-50 border-b border-slate-200 text-slate-600 font-semibold ">
<tr>
<th className="p-3">BOQ Section</th>
<th className="p-3">Standard Reference</th>
<th className="p-3">Original Budget</th>
<th className="p-3">Current Budget</th>
<th className="p-3">Actual Cost</th>
</tr>
</thead>
<tbody className="divide-y divide-slate-100 text-slate-700">
{(budgetSummary?.sectionBreakdown || []).length === 0 && (
<tr><td colSpan={5} className="p-6 text-center text-sm text-slate-400">No BOQ sections yet — import a BOQ to populate this baseline.</td></tr>
)}
{(budgetSummary?.sectionBreakdown || []).map((sec: any) => (
<tr key={sec.sectionId || sec.title} className="hover:bg-slate-50/50">
<td className="p-3 font-semibold text-slate-900">{sec.title || sec.sectionTitle || 'Section'}</td>
<td className="p-3 text-slate-500">{sec.itemCount != null ? `${sec.itemCount} items` : '—'}</td>
<td className="p-3 font-mono font-medium">{formatKes(sec.allocatedBudget)}</td>
<td className="p-3 font-mono font-medium">{formatKes(sec.allocatedBudget)}</td>
<td className="p-3 font-mono text-slate-400">{formatKes(sec.actualSpent)}</td>
</tr>
))}
</tbody>
</table>
</div>
</div>

      {/* Budget vs Actual Metrics Card */}
<BudgetSummaryCard projectId={pid} projectName={projects.find((p) => p.id === pid)?.name || ''} />

      {/* Append-Only Costs & Approvals Ledger */}
<CostManagementView
        projectId={pid}
        canApprove={true}
        canCreate={true}
      />

      {/* Variations & Scope Adjustments Workflow (Milestone M8) */}
      {(activeTab === 'all' || activeTab === 'variations') && (
<VariationManagementView
          projectId={pid}
          userRole="PM_QS"
          canRequest={true}
          canReview={true}
          canApprove={true}
        />
)}

      {/* RFI Technical Clarifications Register */}
      {(activeTab === 'all' || activeTab === 'rfis') && (
<RfiManagementView
          projectId={pid}
          projectName="Riverside Commercial Plaza"
          canCreate={true}
        />
)}

      {/* Pre-Pour Quality Hold Points & Concrete Cube Tests */}
      {(activeTab === 'all' || activeTab === 'quality') && (
<QualityControlView
          projectId={pid}
          projectName="Riverside Commercial Plaza"
          canApprove={true}
        />
)}

      {/* Interim Payment Certificates & Closeout Stage Machine (Gate-4 S4 / ADR-008) */}
      {(activeTab === 'all' || activeTab === 'closeout') && (
<CertificatesCloseoutView projectId={pid} canManage={true} />
)}

      {/* Practical Completion & Retention Release Card */}
      {(activeTab === 'all' || activeTab === 'closeout') && (
<PracticalCompletionCard
          projectName={projects.find((p) => p.id === pid)?.name || ''}
          projectCode={projects.find((p) => p.id === pid)?.code || ''}
        />
)}

      {/* External Stakeholder Portals Manager */}
      {(activeTab === 'all' || activeTab === 'portals') && (
<PortalAccessLinkManager
          projectId={pid}
          onPreviewPortal={onPreviewPortal}
        />
)}

      {/* Interactive Project Schedule & Gantt View */}
      {(activeTab === 'all' || activeTab === 'schedule') && (
<ProjectScheduleGanttView
          projectId={pid}
          canEdit={true}
        />
)}

      {/* Site Store Materials & Inventory View */}
      {(activeTab === 'all' || activeTab === 'store') && (
<SiteInventoryManagementView
          projectId={pid}
          canManage={true}
        />
)}

      {/* Subcontractor Work Packages & Directory */}
      {(activeTab === 'all' || activeTab === 'subcontractors') && (
<SubcontractorManagementView
          projectId={pid}
          canAward={true}
        />
)}

      {/* Project Drawing & Regulatory Document Vault */}
      {(activeTab === 'all' || activeTab === 'drawings') && (
<ProjectDocumentVaultView
          projectId={pid}
          canUpload={true}
        />
)}

      {/* Safety & HSE Incident Register (OSHA 2007) */}
      {(activeTab === 'all' || activeTab === 'safety') && (
<SafetyIncidentLogView
          projectId={pid}
          canLog={true}
          canInvestigate={true}
        />
)}

      {/* Weather Delays & Extension of Time (JBC Clause 25/32) */}
      {(activeTab === 'all' || activeTab === 'delays') && (
<WeatherDelayClaimsView
          projectId={pid}
          canClaim={true}
          canReview={true}
        />
)}

      {/* KRA Statutory Withholding Tax (Cap 470) & WHVAT Certificates */}
      {(activeTab === 'all' || activeTab === 'taxes') && (
<StatutoryTaxManagementView
          projectId={pid}
          canIssue={true}
        />
)}

      {/* Material Purchase Requisitions & Orders (Platform Benchmark) */}
      {(activeTab === 'all' || activeTab === 'requisitions') && (
<MaterialRequisitionView
          projectId={pid}
          projectName="Riverside Commercial Plaza"
          userRole="PM_QS"
        />
)}

      {/* Material Wastage & Theoretical Loss Engine */}
      {(activeTab === 'all' || activeTab === 'wastage') && (
<MaterialWastageVarianceCard
          projectId={pid}
          projectName="Riverside Commercial Plaza"
        />
)}

      {/* Cash Flow Forecasting & S-Curve */}
      {(activeTab === 'all' || activeTab === 'cashflow') && (
<ProjectSCurveCashFlowCard
          projectId={pid}
          projectName="Riverside Commercial Plaza"
        />
)}

      {/* Subcontractor Valuations & Back-to-Back Retention Ledger */}
      {(activeTab === 'all' || activeTab === 'subvaluations') && (
<SubcontractorValuationView
          projectId={pid}
          projectName="Riverside Commercial Plaza"
          userRole="PM_QS"
        />
)}

      {/* Plant, Machinery & Fuel Siphoning Audit (Milestone M16) */}
      {(activeTab === 'all' || activeTab === 'equipment') && isModuleEnabled('equipment') && (
<PlantEquipmentView
          projectId={pid}
          projectName="Riverside Commercial Plaza"
          userRole="PM_QS"
        />
)}

      {/* Site Casual Labor Muster Roll & Artisan Payroll (Milestone M17) */}
      {(activeTab === 'all' || activeTab === 'muster') && (
<LaborMusterRollView
          projectId={pid}
          projectName="Riverside Commercial Plaza"
          userRole="PM_QS"
        />
)}

      {/* Field Safety Audits & DOSHS/NCA Compliance Scorecards (Milestone M18) */}
      {(activeTab === 'all' || activeTab === 'safetyaudit') && (
<SafetyAuditScorecardView
          projectId={pid}
          projectName="Riverside Commercial Plaza"
          userRole="PM_QS"
        />
)}

      {/* KRA e-TIMS Electronic Tax Invoices & TCC Compliance (Milestone M19) */}
      {(activeTab === 'all' || activeTab === 'etims') && (
<ETimsTaxComplianceView
          projectId={pid}
          projectName="Riverside Commercial Plaza"
          userRole="PM_QS"
        />
)}

      {/* WhatsApp & SMS Two-Way Site Ops Webhook Stream (Milestone M20) */}
      {(activeTab === 'all' || activeTab === 'whatsapp') && (
<WhatsAppSiteWebhookView
          projectId={pid}
          projectName="Riverside Commercial Plaza"
          userRole="PM_QS"
        />
)}

      {/* Subcontractor Dual-Moiety Retention & Contractor Performance Bonds (Milestone M21) */}
      {(activeTab === 'all' || activeTab === 'retentionbonds') && (
<RetentionAndBondsView
          projectId={pid}
          projectName="Riverside Commercial Plaza"
          userRole="PM_QS"
        />
)}

      {/* Project Geofencing & Biometric Mobile Clock-In (Milestone M23) */}
      {(activeTab === 'all' || activeTab === 'geofence') && isModuleEnabled('geofence') && (
<GeofencedClockInView
          projectId={pid}
          projectName="Riverside Commercial Plaza"
        />
)}

      {/* Plant GPS Telematics & Remote Fuel Siphoning Anomaly Detection (Milestone M24) */}
      {(activeTab === 'all' || activeTab === 'telematics') && isModuleEnabled('telematics') && (
<PlantTelematicsView
          projectId={pid}
          projectName="Riverside Commercial Plaza"
        />
)}

      {/* BS 8666 / KS 02-598 Rebar Takeoff & Bar Bending Schedules (Milestone M25) */}
      {(activeTab === 'all' || activeTab === 'rebar') && isModuleEnabled('rebar') && (
<BarBendingScheduleView
          projectId={pid}
          projectName="Riverside Commercial Plaza"
        />
)}

      {/* Safaricom Daraja B2C Bulk Wages & Retention Disbursements (Milestone M26) */}
      {(activeTab === 'all' || activeTab === 'disbursements') && (
<MpesaDisbursementView
          projectId={pid}
          projectName="Riverside Commercial Plaza"
        />
)}

      {/* Ready-Mix Concrete (RMC) Batching & Transit Slump Tracker (Milestone M27) */}
      {(activeTab === 'all' || activeTab === 'rmc') && isModuleEnabled('rmc') && (
<RmcTransitTrackerView
          projectId={pid}
          projectName="Riverside Commercial Plaza"
        />
)}

      {/* Structural Steel Framing & Fabrication Takeoff Engine (Milestone M28) */}
      {(activeTab === 'all' || activeTab === 'steel') && isModuleEnabled('steel') && (
<StructuralSteelTakeoffView
          projectId={pid}
          projectName="Riverside Commercial Plaza"
        />
)}

      {/* Geotechnical Soil Compaction QA Engine (Milestone M29) */}
      {(activeTab === 'all' || activeTab === 'soil') && isModuleEnabled('soil') && (
<GeotechnicalSoilView
          projectId={pid}
          projectName="Riverside Commercial Plaza"
        />
)}

      {/* Asphalt Pavement Quality & Thermal Tracker (Milestone M30) */}
      {(activeTab === 'all' || activeTab === 'asphalt') && isModuleEnabled('asphalt') && (
<AsphaltPavementView
          projectId={pid}
          projectName="Riverside Commercial Plaza"
        />
)}

      {/* Topographic Survey & Earthworks Engine (Milestone M31) */}
      {(activeTab === 'all' || activeTab === 'survey') && isModuleEnabled('survey') && (
<TopographicSurveyView
          projectId={pid}
          projectName="Riverside Commercial Plaza"
        />
)}

      {/* Platform Diaspora Independent Site Inspection Reports (Milestone M33) */}
      {(activeTab === 'all' || activeTab === 'inspections') && (
<IndependentSiteReportView
          projectId={pid}
          projectName="Riverside Commercial Plaza"
          userRole="PM_QS"
        />
)}

      {/* Platform Contractor Tender Board & Bidding Studio (Milestone M33) */}
      {(activeTab === 'all' || activeTab === 'tenders') && isModuleEnabled('tenders') && (
<ContractorTenderBoardView
          projectId={pid}
          projectName="Riverside Commercial Plaza"
          userRole="PM_QS"
        />
)}

      {/* Quotes-to-Cash: quotations, client acceptance, project conversion (Gate-4 S1) */}
      {(activeTab === 'all' || activeTab === 'quotes') &&<QuotesManagementView />}

      {/* Invoicing: AR invoices, payments, PDF tax invoices (Gate-4 S2) */}
      {(activeTab === 'all' || activeTab === 'invoices') &&<InvoicingView />}

      {/* Commitments -> Claims -> Payment Applications (Gate-4 S5) */}
      {(activeTab === 'all' || activeTab === 'commitments') && (
<CommitmentsView projectId={pid} canManage={true} />
)}

      {/* Project onboarding & edit (Gate-4 S8) */}
      {(activeTab === 'all' || activeTab === 'project') &&<ProjectOnboardingView />}

      {/* Announcements (Gate-5 G5-1) */}
      {(activeTab === 'all' || activeTab === 'announcements') &&<AnnouncementsView canManage={true} />}

      {/* Checklist templates & assignments (Gate-5 G5-6) */}
      {(activeTab === 'all' || activeTab === 'checklists') &&<ChecklistsView canManage={true} />}

      {/* Daily attendance (Gate-5 G5-10) */}
      {(activeTab === 'all' || activeTab === 'attendance') &&<AttendanceView canManage={true} />}

      {/* Scheduled reports (Gate-5 G5-9) */}
      {(activeTab === 'all' || activeTab === 'scheduled') &&<ScheduledReportsView canManage={true} />}

      {/* Correspondence log (Gate-5 G5-8) */}
      {(activeTab === 'all' || activeTab === 'correspondence') &&<CorrespondenceView canManage={true} />}

      {/* Company documents vault (Gate-5 G5-7) */}
      {(activeTab === 'all' || activeTab === 'documents') &&<CompanyDocumentsView canManage={true} />}

      {/* Crews (Gate-5 G5-5) */}
      {(activeTab === 'all' || activeTab === 'crews') &&<CrewsView canManage={true} />}

      {/* Observations & corrective actions (Gate-5 G5-4) */}
      {(activeTab === 'all' || activeTab === 'observations') &&<ObservationsView projectId={pid} canManage={true} />}

      {/* Team inbox (Gate-5 G5-3) */}
      {(activeTab === 'all' || activeTab === 'inbox') &&<InboxView currentUserId={user?.id} />}

      {/* BOQ Import Modal */}
<BoqImportModal
        isOpen={showBoqModal}
        onClose={() => setShowBoqModal(false)}
        onImportSuccess={handleImportSuccess}
        projectId={pid}
        projectName="Riverside Commercial Plaza"
      />

      {/* Physical Progress Inspection Modal */}
<PhysicalProgressModal
        isOpen={showProgressModal}
        onClose={() => setShowProgressModal(false)}
        projectId={pid}
        projectName="Riverside Commercial Plaza"
        onProgressRecorded={(prog) => {
          const pct = prog.overallProgress ? (parseFloat(prog.overallProgress) * 100).toFixed(1) : '15.0';
          setProgressSuccess(`QS site progress inspection verified and recorded (${pct}% cumulative completion)`);
}}
      />
</div>
);
}