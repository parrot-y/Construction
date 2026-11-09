import React, { useEffect, useState} from 'react';
import { toCurrencyString} from '@construction/money';
import { AuthSession} from '../types/auth';
import PortalAccessLinkManager from './PortalAccessLinkManager';
import SubcontractorManagementView from './SubcontractorManagementView';
import ProjectDocumentVaultView from './ProjectDocumentVaultView';
import StatutoryTaxManagementView from './StatutoryTaxManagementView';
import { ProjectSCurveCashFlowCard} from './ProjectSCurveCashFlowCard';
import { SubcontractorValuationView} from './SubcontractorValuationView';
import { PlantEquipmentView} from './PlantEquipmentView';
import { isModuleEnabled } from '../lib/modules';
import { LaborMusterRollView} from './LaborMusterRollView';
import { SafetyAuditScorecardView} from './SafetyAuditScorecardView';
import { ETimsTaxComplianceView} from './ETimsTaxComplianceView';
import { RetentionAndBondsView} from './RetentionAndBondsView';
import { SubscriptionBillingView} from './SubscriptionBillingView';
import { MpesaDisbursementView} from './MpesaDisbursementView';
import QuotesManagementView from './QuotesManagementView';
import InvoicingView from './InvoicingView';
import AnnouncementsView from './AnnouncementsView';
import CompanyDocumentsView from './CompanyDocumentsView';
import InboxView from './InboxView';
import IntegrationsView from './IntegrationsView';
import ScheduledReportsView from './ScheduledReportsView';

interface CompanyAdminDashboardProps {
  session: AuthSession;
  onPreviewPortal?: (portalType: string, token: string, name: string, role?: string) => void;
}

export default function CompanyAdminDashboard({ session, onPreviewPortal}: CompanyAdminDashboardProps): React.JSX.Element {
  const { user} = session;
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [showProjectModal, setShowProjectModal] = useState(false);
  const [inviteSuccess, setInviteSuccess] = useState<string | null>(null);
  const [projectSuccess, setProjectSuccess] = useState<string | null>(null);
  const [projects, setProjects] = useState<{ id: string; name: string; code: string}[]>([]);
  const [pid, setPid] = useState('project-rcp-2026');
  const [activeTab, setActiveTab] = useState<'overview' | 'money' | 'field' | 'compliance' | 'people'>('overview');
  const panelCls = (t: string) => (activeTab === t ? 'space-y-6' : 'hidden');
  const TABS = [
    { id: 'overview' as const, label: 'Overview'},
    { id: 'money' as const, label: 'Money & Commercial'},
    { id: 'field' as const, label: 'Field Operations'},
    { id: 'compliance' as const, label: 'Compliance & Documents'},
    { id: 'people' as const, label: 'People & Access'},
  ];
  const selectedProjectName = projects.find((p) => p.id === pid)?.name || '—';
  const ASSIGN_ROLES = ['ADMIN','COMPANY_ADMIN','EXECUTIVE','PM_QS','SITE_SUPERVISOR','SUPERINTENDENT','SITE_ENGINEER','TRADE_LEAD','FOREMAN','WORKER','VIEWER','CLIENT','CONSULTANT','SUBCONTRACTOR','SUPPLIER','COMPLIANCE'];
  const handleRoleChange = async (membershipId: string, role: string) => {
    try {
      const r = await fetch(`/api/v1/company/members/${membershipId}/role`, {
        method: 'PATCH', credentials: 'include', headers: { 'Content-Type': 'application/json'},
        body: JSON.stringify({ role}),
});
      if (r.ok) setMembers((prev) => prev ? prev.map((m: any) => m.membershipId === membershipId ? { ...m, role} : m) : prev);
} catch { /* leave unchanged */}
};
  const handleRevoke = async (membershipId: string) => {
    if (!window.confirm('Revoke this member\u2019s access to the workspace?')) return;
    try {
      const r = await fetch(`/api/v1/company/members/${membershipId}`, { method: 'DELETE', credentials: 'include'});
      if (r.ok) setMembers((prev) => prev ? prev.filter((m: any) => m.membershipId !== membershipId) : prev);
} catch { /* leave unchanged */}
};
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

  // Live portfolio data — demo fixtures only until first fetch resolves
  const [dash, setDash] = useState<any>(null);
  const [members, setMembers] = useState<any[] | null>(null);
  useEffect(() => {
    fetch('/api/v1/dashboard', { credentials: 'include'})
      .then((r) => (r.ok ? r.json() : null))
      .then((j) => { if (j?.data) setDash(j.data);})
      .catch(() => {});
    fetch('/api/v1/company/members', { credentials: 'include'})
      .then((r) => (r.ok ? r.json() : null))
      .then((j) => { if (j?.data) setMembers(j.data);})
      .catch(() => {});
}, []);
  const metrics = dash?.metrics;
  const liveProjects: any[] = dash?.projects || [];
  const liveAudits: any[] = dash?.recentAudits || [];

  // Invite Form State
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteName, setInviteName] = useState('');
  const [inviteRole, setInviteRole] = useState('PM_QS');

  // Project Form State
  const [projectName, setProjectName] = useState('');
  const [projectCode, setProjectCode] = useState('');
  const [projectLocation, setProjectLocation] = useState('Nairobi, Kenya');
  const [projectNcaNo, setProjectNcaNo] = useState('');
  const [projectContractSum, setProjectContractSum] = useState('');

  const handleInviteSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!inviteEmail || !inviteName) return;
    setInviteSuccess(`Invitation token generated and sent to ${inviteEmail} as ${inviteRole}`);
    setShowInviteModal(false);
    setInviteEmail('');
    setInviteName('');
};

  const handleProjectSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!projectName || !projectCode) return;
    setProjectSuccess(`Project ${projectName} (${projectCode}) registered successfully`);
    setShowProjectModal(false);
    setProjectName('');
    setProjectCode('');
    setProjectNcaNo('');
};

  return (
<div className="space-y-6">
      {/* Portfolio Overview Header */}
<div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
<div>
<span className="text-xs font-bold text-blue-700 bg-blue-50 border border-blue-200 px-2.5 py-0.5 rounded-full uppercase tracking-wider">
            Company Admin Portfolio Overview
</span>
<h2 className="text-xl font-bold text-slate-900 mt-1">Executive Company Dashboard</h2>
<p className="text-xs text-slate-500">
            Portfolio summary, project controls, team management, and audit trail for {user.tenant.name}
</p>
</div>
<div className="flex items-center gap-2">
          {projects.length > 1 && (
<select value={pid} onChange={(e) => setPid(e.target.value)}
              className="border border-slate-300 rounded-lg px-2 py-1.5 text-xs max-w-[200px] self-center">
              {projects.map((p) =><option key={p.id} value={p.id}>{p.code} — {p.name}</option>)}
</select>
)}
<button
            onClick={() => setShowProjectModal(true)}
            className="px-3.5 py-2 text-xs font-semibold bg-blue-600 hover:bg-blue-700 text-white rounded-lg shadow-sm transition"
          >
            + Create Project
</button>
<button
            onClick={() => setShowInviteModal(true)}
            className="px-3.5 py-2 text-xs font-semibold bg-slate-800 hover:bg-slate-900 text-white rounded-lg shadow-sm transition"
          >
            + Invite Member
</button>
</div>
</div>

      {/* Section tabs */}
<div className="flex gap-1.5 overflow-x-auto pb-1 -mx-1 px-1">
        {TABS.map((t) => (
<button
            key={t.id}
            onClick={() => setActiveTab(t.id)}
            className={`px-3.5 py-2 text-xs font-semibold rounded-lg whitespace-nowrap transition border ${
              activeTab === t.id
                ? 'bg-slate-900 text-white border-slate-900 shadow-sm'
                : 'bg-white text-slate-600 border-slate-200 hover:border-slate-300 hover:bg-slate-50'
}`}
          >
            {t.label}
</button>
))}
</div>

<div className={panelCls('overview')}>
      {inviteSuccess && (
<div className="p-3 bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-medium rounded-lg flex justify-between items-center">
<span> {inviteSuccess}</span>
<button onClick={() => setInviteSuccess(null)} className="text-emerald-600 hover:text-emerald-900 font-bold ml-2">×</button>
</div>
)}

      {projectSuccess && (
<div className="p-3 bg-blue-50 border border-blue-200 text-blue-800 text-xs font-medium rounded-lg flex justify-between items-center">
<span> {projectSuccess}</span>
<button onClick={() => setProjectSuccess(null)} className="text-blue-600 hover:text-blue-900 font-bold ml-2">×</button>
</div>
)}

      {/* Portfolio Metrics Grid */}
<div className="grid grid-cols-2 md:grid-cols-4 gap-4">
<div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
<span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider block">
            Active Projects
</span>
<span className="text-2xl font-bold text-slate-900 mt-1 block">{metrics ? `${metrics.activeProjectsCount} Active` : '1 Active'}</span>
<span className="text-[11px] text-slate-400 mt-0.5 block">{metrics ? `${metrics.totalProjectsCount ?? liveProjects.length} Total registered` : '1 Total registered'}</span>
</div>

<div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
<span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider block">
            Total Contract Value
</span>
<span className="text-lg font-bold font-mono text-slate-900 mt-1 block">
            KES {toCurrencyString(metrics ? String(metrics.totalContractSum) : '0.00')}
</span>
<span className="text-[11px] text-slate-400 mt-0.5 block">Sum across projects</span>
</div>

<div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
<span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider block">
            Approved Budget
</span>
<span className="text-lg font-bold font-mono text-slate-900 mt-1 block">
            KES {toCurrencyString(metrics ? String(metrics.totalApprovedBudget) : '0.00')}
</span>
<span className="text-[11px] text-emerald-600 font-medium mt-0.5 block">{metrics ? `${metrics.pendingApprovalsCount ?? 0} pending approvals` : 'No data yet'}</span>
</div>

<div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
<span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider block">
            Team & Invites
</span>
<span className="text-2xl font-bold text-slate-900 mt-1 block">{metrics ? `${metrics.teamMembersCount} Members` : '—'}</span>
<span className="text-[11px] text-amber-600 font-medium mt-0.5 block">{metrics ? `${metrics.pendingInvitesCount ?? 0} pending invites` : ''}</span>
</div>
</div>

      {/* Projects Management Section */}
<div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6 space-y-4">
<div className="flex justify-between items-center">
<div>
<h3 className="text-base font-bold text-slate-900">Registered Projects</h3>
<p className="text-xs text-slate-500">Active construction sites and contract baselines</p>
</div>
<span className="text-xs font-semibold px-2.5 py-1 bg-slate-100 text-slate-700 rounded-md border border-slate-200">
            {liveProjects.length > 0 ? `${liveProjects.length} Project${liveProjects.length === 1 ? '' : 's'}` : '1 Project'}
</span>
</div>

<div className="border border-slate-200 rounded-lg overflow-hidden">
<table className="w-full text-left text-xs">
<thead className="bg-slate-50 border-b border-slate-200 text-slate-600 font-semibold uppercase tracking-wider">
<tr>
<th className="p-3">Project Details</th>
<th className="p-3">Location & NCA</th>
<th className="p-3">Contract Value</th>
<th className="p-3">Status</th>
<th className="p-3">Assigned Team</th>
</tr>
</thead>
<tbody className="divide-y divide-slate-100 text-slate-700">
              {liveProjects.length > 0 ? liveProjects.map((p: any) => (
<tr key={p.id} className="hover:bg-slate-50/50">
<td className="p-3">
<span className="font-bold text-slate-900 block">{p.name}</span>
<span className="font-mono text-[11px] text-slate-500">Code: {p.code}</span>
</td>
<td className="p-3">
<span>{p.location || '—'}</span>
<span className="block text-[11px] text-slate-400">{p.nca_project_no ? `NCA Reg: ${p.nca_project_no}` : ''}</span>
</td>
<td className="p-3 font-mono font-semibold text-slate-900">
                    {p.contract_currency || 'KES'} {toCurrencyString(String(p.original_contract_sum ?? '0'))}
</td>
<td className="p-3">
<span className={`px-2 py-0.5 text-[10px] font-bold rounded-full border ${p.status === 'ACTIVE' ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-slate-50 text-slate-600 border-slate-200'}`}>
                      {p.status}
</span>
</td>
<td className="p-3">
<button
                      onClick={() => { setPid(p.id); setActiveTab('overview');}}
                      className="text-[11px] font-semibold text-blue-600 hover:text-blue-800"
                    >
                      Open workspace →
</button>
</td>
</tr>
)) : (
<tr><td colSpan={5} className="p-8 text-center text-sm text-slate-400">No projects yet — create your first project to get started.</td></tr>

)}
</tbody>
</table>
</div>
</div>

      {/* Team Management & Audit Trail Grid */}
<div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Team Members List */}
<div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6 space-y-4">
<div className="flex justify-between items-center">
<div>
<h3 className="text-sm font-bold text-slate-900">Team Management</h3>
<p className="text-xs text-slate-500">Active users and company role memberships</p>
</div>
<button
              onClick={() => setShowInviteModal(true)}
              className="text-xs font-semibold text-blue-600 hover:text-blue-800"
            >
              + Invite
</button>
</div>

<div className="divide-y divide-slate-100 border border-slate-100 rounded-lg">
            {(members ?? []).map((m: any) => (
<div key={m.membershipId} className="p-3 flex justify-between items-center gap-2">
<div className="min-w-0">
<p className="text-xs font-bold text-slate-900 truncate">{m.user?.full_name || m.user?.email}</p>
<p className="text-[11px] text-slate-500 truncate">{m.user?.email}</p>
</div>
                {m.membershipId.startsWith?.('demo-') ? (
<span className="px-2 py-0.5 text-[10px] font-bold bg-slate-100 text-slate-700 border border-slate-200 rounded shrink-0">
                    {m.role}
</span>
) : (
<div className="flex items-center gap-1.5 shrink-0">
<select
                      value={m.role}
                      onChange={(e) => handleRoleChange(m.membershipId, e.target.value)}
                      className="text-[10px] font-bold border border-slate-200 rounded px-1 py-0.5 bg-white text-slate-700 max-w-[110px]"
                      title="Change role"
                    >
                      {ASSIGN_ROLES.map((r) =><option key={r} value={r}>{r}</option>)}
</select>
<button
                      onClick={() => handleRevoke(m.membershipId)}
                      className="text-[10px] font-bold text-red-500 hover:text-red-700 px-1"
                      title="Revoke access"
                    >
                      
</button>
</div>
)}
</div>
))}
{members !== null && members.length === 0 && (
<p className="text-slate-400 text-center py-4 text-xs">No team members yet — invite your first user.</p>
)}
</div>
</div>

        {/* Audit Log Activity Trail */}
<div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6 space-y-4">
<div>
<h3 className="text-sm font-bold text-slate-900">Audit Log Activity Trail</h3>
<p className="text-xs text-slate-500">Append-only compliance log (GEMINI.md strictly enforced)</p>
</div>

<div className="space-y-2.5 text-xs">
            {liveAudits.length > 0 ? liveAudits.map((a: any, i: number) => (
<div key={a.id || i} className="p-2.5 bg-slate-50 rounded-lg border border-slate-100 flex items-start gap-2.5">
<span className="w-2 h-2 rounded-full bg-blue-500 mt-1.5 shrink-0" />
<div>
<p className="font-semibold text-slate-800">{a.action} • {a.entity_type}</p>
<p className="text-[11px] text-slate-500">{a.created_at ? new Date(a.created_at).toLocaleString() : ''}</p>
</div>
</div>
)) : (
<p className="text-slate-400 text-center py-4">No audit events yet.</p>
)}
</div>
</div>
</div>

</div>
<div className={panelCls('people')}>
      {/* External Stakeholder Portals Manager (Zero Seat Tax) */}
<PortalAccessLinkManager
        projectId={pid}
        onPreviewPortal={onPreviewPortal}
      />

      {/* Subcontractor Work Packages & Directory */}
<SubcontractorManagementView
        projectId={pid}
        canAward={true}
      />

</div>
<div className={panelCls('compliance')}>
      {/* Project Drawing & Regulatory Document Vault */}
<ProjectDocumentVaultView
        projectId={pid}
        canUpload={true}
      />

      {/* KRA Statutory Withholding Tax (Cap 470) & WHVAT Certificates */}
<StatutoryTaxManagementView
        projectId={pid}
        canIssue={true}
      />

</div>
<div className={panelCls('money')}>
      {/* Portfolio Cash Flow Forecasting & S-Curve */}
<ProjectSCurveCashFlowCard
        projectId={pid}
        projectName={selectedProjectName}
      />

      {/* Subcontractor Valuations & Back-to-Back Retention Ledger */}
<SubcontractorValuationView
        projectId={pid}
        projectName={selectedProjectName}
        userRole="ADMIN"
      />

</div>
<div className={panelCls('field')}>
      {/* Plant & Machinery — peripheral module */}
{isModuleEnabled('equipment') && (
<PlantEquipmentView
        projectId={pid}
        projectName={selectedProjectName}
        userRole="COMPANY_ADMIN"
      />
)}

      {/* Site Casual Labor Muster Roll & Artisan Payroll (Milestone M17) */}
<LaborMusterRollView
        projectId={pid}
        projectName={selectedProjectName}
        userRole="COMPANY_ADMIN"
      />

      {/* Field Safety Audits & DOSHS/NCA Compliance Scorecards (Milestone M18) */}
<SafetyAuditScorecardView
        projectId={pid}
        projectName={selectedProjectName}
        userRole="COMPANY_ADMIN"
      />

</div>
<div className={panelCls('compliance')}>
      {/* KRA e-TIMS Tax Compliance Engine (Milestone M19) */}
<ETimsTaxComplianceView
        projectId={pid}
        projectName={selectedProjectName}
        userRole="COMPANY_ADMIN"
      />

      {/* Retention Releases & Contractor Performance Bonds (Milestone M21) */}
<RetentionAndBondsView
        projectId={pid}
        projectName={selectedProjectName}
        userRole="COMPANY_ADMIN"
      />

</div>
<div className={panelCls('money')}>
      {/* Safaricom Daraja M-Pesa Subscription Billing (Milestone M22 / ADR-006) */}
<SubscriptionBillingView
        tenantName={session.user.tenant?.name || 'Apex Builders Kenya Ltd'}
        subscriptionState="ACTIVE"
        activePlan="PORTFOLIO_TIER"
        monthlyFeeKes="25000.00"
        daysRemaining={26}
      />

      {/* Safaricom Daraja B2C Bulk Wages & Subcontractor Retention Disbursements (Milestone M26) */}
<MpesaDisbursementView
        projectId={pid}
        projectName={selectedProjectName}
      />

</div>
<div className={panelCls('money')}>
      {/* Quotes-to-Cash: quotations, client acceptance, project conversion (Gate-4 S1) */}
<QuotesManagementView />

      {/* Invoicing: AR invoices, payments, PDF tax invoices (Gate-4 S2) */}
<InvoicingView />

</div>
<div className={panelCls('people')}>
<AnnouncementsView canManage={true} />

      {/* Company documents vault (Gate-5 G5-7) */}
<CompanyDocumentsView canManage={true} />

      {/* Scheduled reports (Gate-5 G5-9) */}
<ScheduledReportsView canManage={true} />

      {/* Team inbox (Gate-5 G5-3) */}
<InboxView />

      {/* Outbound integrations — providers, env config, test send (Phase 1) */}
<IntegrationsView />

</div>
      {/* Invite Member Modal */}
      {showInviteModal && (
<div className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4 z-50">
<div className="bg-white rounded-xl shadow-xl border border-slate-200 max-w-md w-full p-6 space-y-4">
<div className="flex justify-between items-center">
<h3 className="text-base font-bold text-slate-900">Invite Team Member</h3>
<button onClick={() => setShowInviteModal(false)} className="text-slate-400 hover:text-slate-600 font-bold"></button>
</div>
<form onSubmit={handleInviteSubmit} className="space-y-4">
<div>
<label className="block text-xs font-semibold text-slate-700 mb-1">Full Name</label>
<input
                  type="text"
                  required
                  value={inviteName}
                  onChange={(e) => setInviteName(e.target.value)}
                  placeholder="e.g. Peter Ochieng"
                  className="w-full text-xs p-2.5 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
</div>
<div>
<label className="block text-xs font-semibold text-slate-700 mb-1">Email Address</label>
<input
                  type="email"
                  required
                  value={inviteEmail}
                  onChange={(e) => setInviteEmail(e.target.value)}
                  placeholder="name@company.co.ke"
                  className="w-full text-xs p-2.5 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
</div>
<div>
<label className="block text-xs font-semibold text-slate-700 mb-1">Role Assignment</label>
<select
                  value={inviteRole}
                  onChange={(e) => setInviteRole(e.target.value)}
                  className="w-full text-xs p-2.5 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
<option value="PM_QS">PM / Quantity Surveyor (PM_QS)</option>
<option value="SITE_SUPERVISOR">Site Supervisor (SITE_SUPERVISOR)</option>
<option value="CLIENT">Client / Developer (CLIENT)</option>
<option value="COMPANY_ADMIN">Company Administrator (COMPANY_ADMIN)</option>
</select>
</div>
<div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
<button
                  type="button"
                  onClick={() => setShowInviteModal(false)}
                  className="px-3 py-1.5 text-xs text-slate-600 hover:bg-slate-100 rounded-lg"
                >
                  Cancel
</button>
<button
                  type="submit"
                  className="px-4 py-1.5 text-xs font-semibold bg-blue-600 hover:bg-blue-700 text-white rounded-lg shadow-sm"
                >
                  Send Invitation
</button>
</div>
</form>
</div>
</div>
)}

      {/* Create Project Modal */}
      {showProjectModal && (
<div className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4 z-50">
<div className="bg-white rounded-xl shadow-xl border border-slate-200 max-w-md w-full p-6 space-y-4">
<div className="flex justify-between items-center">
<h3 className="text-base font-bold text-slate-900">Create New Project</h3>
<button onClick={() => setShowProjectModal(false)} className="text-slate-400 hover:text-slate-600 font-bold"></button>
</div>
<form onSubmit={handleProjectSubmit} className="space-y-4">
<div>
<label className="block text-xs font-semibold text-slate-700 mb-1">Project Name</label>
<input
                  type="text"
                  required
                  value={projectName}
                  onChange={(e) => setProjectName(e.target.value)}
                  placeholder="e.g. Westlands Office Tower"
                  className="w-full text-xs p-2.5 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
</div>
<div className="grid grid-cols-2 gap-3">
<div>
<label className="block text-xs font-semibold text-slate-700 mb-1">Project Code</label>
<input
                    type="text"
                    required
                    value={projectCode}
                    onChange={(e) => setProjectCode(e.target.value)}
                    placeholder="e.g. WOT-2026"
                    className="w-full text-xs p-2.5 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono"
                  />
</div>
<div>
<label className="block text-xs font-semibold text-slate-700 mb-1">NCA Project No.</label>
<input
                    type="text"
                    value={projectNcaNo}
                    onChange={(e) => setProjectNcaNo(e.target.value)}
                    placeholder="NCA-PRJ-2026-XXXX"
                    className="w-full text-xs p-2.5 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono"
                  />
</div>
</div>
<div>
<label className="block text-xs font-semibold text-slate-700 mb-1">Site Location</label>
<input
                  type="text"
                  required
                  value={projectLocation}
                  onChange={(e) => setProjectLocation(e.target.value)}
                  placeholder="e.g. Westlands, Nairobi"
                  className="w-full text-xs p-2.5 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
</div>
<div>
<label className="block text-xs font-semibold text-slate-700 mb-1">Original Contract Sum (KES)</label>
<input
                  type="number"
                  required
                  value={projectContractSum}
                  onChange={(e) => setProjectContractSum(e.target.value)}
                  placeholder="e.g. 45000000"
                  className="w-full text-xs p-2.5 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono"
                />
</div>
<div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
<button
                  type="button"
                  onClick={() => setShowProjectModal(false)}
                  className="px-3 py-1.5 text-xs text-slate-600 hover:bg-slate-100 rounded-lg"
                >
                  Cancel
</button>
<button
                  type="submit"
                  className="px-4 py-1.5 text-xs font-semibold bg-blue-600 hover:bg-blue-700 text-white rounded-lg shadow-sm"
                >
                  Register Project
</button>
</div>
</form>
</div>
</div>
)}
</div>
);
}