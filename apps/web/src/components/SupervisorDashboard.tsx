import React, { useState } from 'react';
import { AuthSession } from '../types/auth';
import CostCaptureModal from './CostCaptureModal';
import SiteDiaryModal from './SiteDiaryModal';
import PhysicalProgressModal from './PhysicalProgressModal';
import OfflineSyncBanner from './OfflineSyncBanner';
import QualityControlView from './QualityControlView';
import SnaggingListView from './SnaggingListView';
import ProjectScheduleGanttView from './ProjectScheduleGanttView';
import SiteInventoryManagementView from './SiteInventoryManagementView';
import SafetyIncidentLogView from './SafetyIncidentLogView';
import ProjectDocumentVaultView from './ProjectDocumentVaultView';
import { MaterialRequisitionView } from './MaterialRequisitionView';
import { MaterialWastageVarianceCard } from './MaterialWastageVarianceCard';

interface SupervisorDashboardProps {
  session: AuthSession;
}

export default function SupervisorDashboard({ session }: SupervisorDashboardProps): React.JSX.Element {
  const { user } = session;
  const [showDiaryModal, setShowDiaryModal] = useState(false);
  const [diarySuccess, setDiarySuccess] = useState<string | null>(null);
  const [showProgressModal, setShowProgressModal] = useState(false);
  const [progressSuccess, setProgressSuccess] = useState<string | null>(null);
  const [showCostModal, setShowCostModal] = useState(false);
  const [costSuccess, setCostSuccess] = useState<string | null>(null);
  const [todayHeadcount, setTodayHeadcount] = useState<number>(17);

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <span className="text-xs font-bold text-amber-800 bg-amber-50 border border-amber-200 px-2.5 py-0.5 rounded-full uppercase tracking-wider">
            Site Supervisor Workspace
          </span>
          <h2 className="text-xl font-bold text-slate-900 mt-1">Site Operations & Daily Diary</h2>
          <p className="text-xs text-slate-500">
            Daily labor headcount, site diary logging, material deliveries, and photo evidence for {user.tenant.name}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <a
            href="/api/v1/projects/project-rcp-2026/reports/site-diary/latest"
            download
            data-testid="download-site-diary-btn"
            className="px-3.5 py-2 text-xs font-semibold bg-amber-700 hover:bg-amber-800 text-white rounded-lg shadow-sm transition flex items-center gap-1.5"
            title="Download Daily Site Diary (PDF)"
          >
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            <span>Daily Diary (PDF)</span>
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
            <span>Site Summary (PDF)</span>
          </a>
          <button
            onClick={() => setShowCostModal(true)}
            className="px-3.5 py-2 text-xs font-semibold bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg shadow-sm transition flex items-center gap-1.5"
          >
            💰 Log Site Expense
          </button>
          <button
            onClick={() => setShowProgressModal(true)}
            className="px-3.5 py-2 text-xs font-semibold bg-blue-600 hover:bg-blue-700 text-white rounded-lg shadow-sm transition flex items-center gap-1.5"
          >
            📈 Record Progress
          </button>
          <button
            onClick={() => setShowDiaryModal(true)}
            className="px-3.5 py-2 text-xs font-semibold bg-amber-600 hover:bg-amber-700 text-white rounded-lg shadow-sm transition"
          >
            + Record Daily Site Diary
          </button>
        </div>
      </div>

      {costSuccess && (
        <div className="p-3 bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-medium rounded-lg flex justify-between items-center">
          <span>✓ {costSuccess}</span>
          <button onClick={() => setCostSuccess(null)} className="text-emerald-600 hover:text-emerald-900 font-bold ml-2">×</button>
        </div>
      )}

      {progressSuccess && (
        <div className="p-3 bg-blue-50 border border-blue-200 text-blue-800 text-xs font-medium rounded-lg flex justify-between items-center">
          <span>✓ {progressSuccess}</span>
          <button onClick={() => setProgressSuccess(null)} className="text-blue-600 hover:text-blue-900 font-bold ml-2">×</button>
        </div>
      )}

      {diarySuccess && (
        <div className="p-3 bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-medium rounded-lg flex justify-between items-center">
          <span>✓ {diarySuccess}</span>
          <button onClick={() => setDiarySuccess(null)} className="text-emerald-600 hover:text-emerald-900 font-bold ml-2">×</button>
        </div>
      )}

      {/* Offline PWA Status Banner */}
      <OfflineSyncBanner />

      {/* Metrics Row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
          <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider block">
            Assigned Sites
          </span>
          <span className="text-2xl font-bold text-slate-900 mt-1 block">1 Project</span>
          <span className="text-[11px] text-slate-400 mt-0.5 block">Riverside Commercial Plaza</span>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
          <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider block">
            Today's Diary Status
          </span>
          <span className="text-lg font-bold text-amber-700 mt-1 block">
            {diarySuccess ? 'Submitted ✓' : 'Pending Submission'}
          </span>
          <span className="text-[11px] text-slate-400 mt-0.5 block">Entry date: {new Date().toISOString().split('T')[0]}</span>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
          <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider block">
            Today's Headcount
          </span>
          <span className="text-2xl font-bold font-mono text-slate-900 mt-1 block">
            {todayHeadcount} Workers
          </span>
          <span className="text-[11px] text-slate-400 mt-0.5 block">Masons, fixers, casuals</span>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
          <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider block">
            Site Photos Today
          </span>
          <span className="text-2xl font-bold text-slate-900 mt-1 block">0 Photos</span>
          <span className="text-[11px] text-slate-400 mt-0.5 block">GPS-tagged evidence</span>
        </div>
      </div>

      {/* Active Site Details & Fast Capture */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6 space-y-4">
          <div className="flex justify-between items-start">
            <div>
              <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Active Site Station</span>
              <h3 className="text-lg font-bold text-slate-900 mt-0.5">Riverside Commercial Plaza</h3>
              <p className="text-xs text-slate-500">Riverside Drive, Nairobi • Code: RCP-2026</p>
            </div>
            <span className="px-2.5 py-1 text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200 rounded-full">
              ACTIVE SITE
            </span>
          </div>

          <div className="space-y-2 text-xs text-slate-600 border-t border-slate-100 pt-3">
            <div className="flex justify-between">
              <span className="text-slate-500">NCA Registration:</span>
              <span className="font-mono font-medium text-slate-800">NCA-PRJ-2026-0891</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500">Current Phase:</span>
              <span className="font-medium text-slate-800">Substructure Excavation & Blinding</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500">Project Manager / QS:</span>
              <span className="font-medium text-slate-800">Faith Achieng</span>
            </div>
          </div>
        </div>

        {/* Photo Evidence Placeholder */}
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6 space-y-3">
          <div className="flex justify-between items-center">
            <h3 className="text-sm font-bold text-slate-900">Photo Evidence Feed</h3>
            <span className="text-[11px] text-slate-400">0 records today</span>
          </div>
          <div className="border-2 border-dashed border-slate-200 rounded-xl p-8 text-center space-y-2">
            <div className="text-3xl text-slate-400">📷</div>
            <p className="text-xs font-medium text-slate-700">No site photos uploaded yet today</p>
            <p className="text-[11px] text-slate-400 max-w-xs mx-auto">
              Capture progress photos of reinforced steel, excavation, or concrete pours with automatic GPS & offline sync.
            </p>
          </div>
        </div>
      </div>

      {/* Interactive Project Schedule & Gantt View */}
      <ProjectScheduleGanttView
        projectId="project-rcp-2026"
        canEdit={true}
      />

      {/* Site Store Materials & Inventory View */}
      <SiteInventoryManagementView
        projectId="project-rcp-2026"
        canManage={true}
      />

      {/* Safety & HSE Incident Register (OSHA 2007) */}
      <SafetyIncidentLogView
        projectId="project-rcp-2026"
        canLog={true}
        canInvestigate={true}
      />

      {/* Project Drawing & Regulatory Document Vault */}
      <ProjectDocumentVaultView
        projectId="project-rcp-2026"
        canUpload={true}
      />

      {/* Site Store Material Purchase Requisitions */}
      <MaterialRequisitionView
        projectId="project-rcp-2026"
        projectName="Riverside Commercial Plaza"
        userRole="SITE_SUPERVISOR"
      />

      {/* Material Wastage & Theoretical Loss Engine */}
      <MaterialWastageVarianceCard
        projectId="project-rcp-2026"
        projectName="Riverside Commercial Plaza"
      />

      {/* Quality Control: Pre-Pour Hold Points & Concrete Cube Crushing */}
      <QualityControlView
        projectId="project-rcp-2026"
        projectName="Riverside Commercial Plaza"
        canApprove={true}
        defaultTab="checklists"
      />

      {/* Practical Completion Snagging & Punch List Register */}
      <SnaggingListView
        projectId="project-rcp-2026"
        projectName="Riverside Commercial Plaza"
        canAdd={true}
        canRectify={true}
        canVerify={false}
      />

      {/* Site Diary Modal */}
      <SiteDiaryModal
        isOpen={showDiaryModal}
        onClose={() => setShowDiaryModal(false)}
        projectId="project-rcp-2026"
        projectName="Riverside Commercial Plaza"
        onDiarySubmitted={(diary) => {
          const totalCount = diary.laborHeadcounts?.reduce((acc: number, c: any) => acc + (c.headcount || 0), 0) || 17;
          setTodayHeadcount(totalCount);
          setDiarySuccess(`Daily site diary recorded successfully: ${totalCount} workers on-site, weather: ${diary.weather}`);
        }}
      />

      {/* Physical Progress Modal */}
      <PhysicalProgressModal
        isOpen={showProgressModal}
        onClose={() => setShowProgressModal(false)}
        projectId="project-rcp-2026"
        projectName="Riverside Commercial Plaza"
        onProgressRecorded={(prog) => {
          const pct = prog.overallProgress ? (parseFloat(prog.overallProgress) * 100).toFixed(1) : '15.0';
          setProgressSuccess(`Physical progress recorded successfully (${pct}% cumulative completion)`);
        }}
      />

      {/* Cost Capture Modal for Site Expenses */}
      <CostCaptureModal
        isOpen={showCostModal}
        onClose={() => setShowCostModal(false)}
        projectId="project-rcp-2026"
        onCostCreated={(cost) => {
          setCostSuccess(`Site expense logged: KES ${cost.amount} (${cost.cost_category}) in PENDING status`);
        }}
      />
    </div>
  );
}