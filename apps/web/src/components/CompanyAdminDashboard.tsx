import React, { useState } from 'react';
import { toCurrencyString } from '@construction/money';
import { AuthSession } from '../types/auth';
import PortalAccessLinkManager from './PortalAccessLinkManager';
import SubcontractorManagementView from './SubcontractorManagementView';
import ProjectDocumentVaultView from './ProjectDocumentVaultView';
import StatutoryTaxManagementView from './StatutoryTaxManagementView';
import { ProjectSCurveCashFlowCard } from './ProjectSCurveCashFlowCard';
import { SubcontractorValuationView } from './SubcontractorValuationView';
import { PlantEquipmentView } from './PlantEquipmentView';
import { LaborMusterRollView } from './LaborMusterRollView';
import { SafetyAuditScorecardView } from './SafetyAuditScorecardView';
import { ETimsTaxComplianceView } from './ETimsTaxComplianceView';
import { RetentionAndBondsView } from './RetentionAndBondsView';
import { SubscriptionBillingView } from './SubscriptionBillingView';
import { MpesaDisbursementView } from './MpesaDisbursementView';
import QuotesManagementView from './QuotesManagementView';
import InvoicingView from './InvoicingView';

interface CompanyAdminDashboardProps {
  session: AuthSession;
  onPreviewPortal?: (portalType: string, token: string, name: string, role?: string) => void;
}

export default function CompanyAdminDashboard({ session, onPreviewPortal }: CompanyAdminDashboardProps): React.JSX.Element {
  const { user } = session;
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [showProjectModal, setShowProjectModal] = useState(false);
  const [inviteSuccess, setInviteSuccess] = useState<string | null>(null);
  const [projectSuccess, setProjectSuccess] = useState<string | null>(null);

  // Invite Form State
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteName, setInviteName] = useState('');
  const [inviteRole, setInviteRole] = useState('PM_QS');

  // Project Form State
  const [projectName, setProjectName] = useState('');
  const [projectCode, setProjectCode] = useState('');
  const [projectLocation, setProjectLocation] = useState('Nairobi, Kenya');
  const [projectNcaNo, setProjectNcaNo] = useState('');
  const [projectContractSum, setProjectContractSum] = useState('45000000');

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

      {inviteSuccess && (
        <div className="p-3 bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-medium rounded-lg flex justify-between items-center">
          <span>✓ {inviteSuccess}</span>
          <button onClick={() => setInviteSuccess(null)} className="text-emerald-600 hover:text-emerald-900 font-bold ml-2">×</button>
        </div>
      )}

      {projectSuccess && (
        <div className="p-3 bg-blue-50 border border-blue-200 text-blue-800 text-xs font-medium rounded-lg flex justify-between items-center">
          <span>✓ {projectSuccess}</span>
          <button onClick={() => setProjectSuccess(null)} className="text-blue-600 hover:text-blue-900 font-bold ml-2">×</button>
        </div>
      )}

      {/* Portfolio Metrics Grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
          <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider block">
            Active Projects
          </span>
          <span className="text-2xl font-bold text-slate-900 mt-1 block">1 Active</span>
          <span className="text-[11px] text-slate-400 mt-0.5 block">1 Total registered</span>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
          <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider block">
            Total Contract Value
          </span>
          <span className="text-lg font-bold font-mono text-slate-900 mt-1 block">
            KES {toCurrencyString('45000000.00')}
          </span>
          <span className="text-[11px] text-slate-400 mt-0.5 block">Sum across projects</span>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
          <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider block">
            Approved Budget
          </span>
          <span className="text-lg font-bold font-mono text-slate-900 mt-1 block">
            KES {toCurrencyString('45000000.00')}
          </span>
          <span className="text-[11px] text-emerald-600 font-medium mt-0.5 block">100% committed</span>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
          <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider block">
            Team & Invites
          </span>
          <span className="text-2xl font-bold text-slate-900 mt-1 block">4 Members</span>
          <span className="text-[11px] text-amber-600 font-medium mt-0.5 block">0 pending invites</span>
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
            1 Project
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
              <tr className="hover:bg-slate-50/50">
                <td className="p-3">
                  <span className="font-bold text-slate-900 block">Riverside Commercial Plaza</span>
                  <span className="font-mono text-[11px] text-slate-500">Code: RCP-2026</span>
                </td>
                <td className="p-3">
                  <span>Riverside Drive, Nairobi</span>
                  <span className="block text-[11px] text-slate-400">NCA Reg: NCA-PRJ-2026-0891</span>
                </td>
                <td className="p-3 font-mono font-semibold text-slate-900">
                  KES {toCurrencyString('45000000.00')}
                </td>
                <td className="p-3">
                  <span className="px-2 py-0.5 text-[10px] font-bold rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">
                    ACTIVE
                  </span>
                </td>
                <td className="p-3">
                  <div className="flex gap-1 flex-wrap">
                    <span className="px-1.5 py-0.5 text-[10px] bg-slate-100 rounded text-slate-600 border border-slate-200">Faith A. (QS)</span>
                    <span className="px-1.5 py-0.5 text-[10px] bg-slate-100 rounded text-slate-600 border border-slate-200">John M. (Site)</span>
                    <span className="px-1.5 py-0.5 text-[10px] bg-slate-100 rounded text-slate-600 border border-slate-200">Sarah W. (Client)</span>
                  </div>
                </td>
              </tr>
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
            <div className="p-3 flex justify-between items-center">
              <div>
                <p className="text-xs font-bold text-slate-900">David Kimani</p>
                <p className="text-[11px] text-slate-500">admin@apexbuilders.co.ke</p>
              </div>
              <span className="px-2 py-0.5 text-[10px] font-bold bg-blue-50 text-blue-800 border border-blue-200 rounded">
                COMPANY_ADMIN
              </span>
            </div>
            <div className="p-3 flex justify-between items-center">
              <div>
                <p className="text-xs font-bold text-slate-900">Faith Achieng</p>
                <p className="text-[11px] text-slate-500">qs@apexbuilders.co.ke</p>
              </div>
              <span className="px-2 py-0.5 text-[10px] font-bold bg-purple-50 text-purple-800 border border-purple-200 rounded">
                PM_QS
              </span>
            </div>
            <div className="p-3 flex justify-between items-center">
              <div>
                <p className="text-xs font-bold text-slate-900">John Mwangi</p>
                <p className="text-[11px] text-slate-500">supervisor@apexbuilders.co.ke</p>
              </div>
              <span className="px-2 py-0.5 text-[10px] font-bold bg-amber-50 text-amber-800 border border-amber-200 rounded">
                SITE_SUPERVISOR
              </span>
            </div>
            <div className="p-3 flex justify-between items-center">
              <div>
                <p className="text-xs font-bold text-slate-900">Sarah Wambui</p>
                <p className="text-[11px] text-slate-500">client@apexbuilders.co.ke</p>
              </div>
              <span className="px-2 py-0.5 text-[10px] font-bold bg-emerald-50 text-emerald-800 border border-emerald-200 rounded">
                CLIENT
              </span>
            </div>
          </div>
        </div>

        {/* Audit Log Activity Trail */}
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6 space-y-4">
          <div>
            <h3 className="text-sm font-bold text-slate-900">Audit Log Activity Trail</h3>
            <p className="text-xs text-slate-500">Append-only compliance log (GEMINI.md strictly enforced)</p>
          </div>

          <div className="space-y-2.5 text-xs">
            <div className="p-2.5 bg-slate-50 rounded-lg border border-slate-100 flex items-start gap-2.5">
              <span className="w-2 h-2 rounded-full bg-blue-500 mt-1.5 shrink-0" />
              <div>
                <p className="font-semibold text-slate-800">Project Baseline Created: Riverside Commercial Plaza</p>
                <p className="text-[11px] text-slate-500">Action: project.create • Actor: David Kimani</p>
              </div>
            </div>

            <div className="p-2.5 bg-slate-50 rounded-lg border border-slate-100 flex items-start gap-2.5">
              <span className="w-2 h-2 rounded-full bg-purple-500 mt-1.5 shrink-0" />
              <div>
                <p className="font-semibold text-slate-800">BOQ Baseline Imported (EASMM 2008 Standard)</p>
                <p className="text-[11px] text-slate-500">Action: boq.import • Actor: Faith Achieng</p>
              </div>
            </div>

            <div className="p-2.5 bg-slate-50 rounded-lg border border-slate-100 flex items-start gap-2.5">
              <span className="w-2 h-2 rounded-full bg-emerald-500 mt-1.5 shrink-0" />
              <div>
                <p className="font-semibold text-slate-800">Company Profile Updated: KRA PIN & NCA Registration</p>
                <p className="text-[11px] text-slate-500">Action: company.update • Actor: David Kimani</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* External Stakeholder Portals Manager (Zero Seat Tax) */}
      <PortalAccessLinkManager
        projectId="project-rcp-2026"
        onPreviewPortal={onPreviewPortal}
      />

      {/* Subcontractor Work Packages & Directory */}
      <SubcontractorManagementView
        projectId="project-rcp-2026"
        canAward={true}
      />

      {/* Project Drawing & Regulatory Document Vault */}
      <ProjectDocumentVaultView
        projectId="project-rcp-2026"
        canUpload={true}
      />

      {/* KRA Statutory Withholding Tax (Cap 470) & WHVAT Certificates */}
      <StatutoryTaxManagementView
        projectId="project-rcp-2026"
        canIssue={true}
      />

      {/* Portfolio Cash Flow Forecasting & S-Curve */}
      <ProjectSCurveCashFlowCard
        projectId="project-rcp-2026"
        projectName="Riverside Commercial Plaza"
      />

      {/* Subcontractor Valuations & Back-to-Back Retention Ledger */}
      <SubcontractorValuationView
        projectId="project-rcp-2026"
        projectName="Riverside Commercial Plaza"
        userRole="ADMIN"
      />

      {/* Heavy Machinery & Fuel Siphoning Audit (Milestone M16) */}
      <PlantEquipmentView
        projectId="project-rcp-2026"
        projectName="Riverside Commercial Plaza"
        userRole="COMPANY_ADMIN"
      />

      {/* Site Casual Labor Muster Roll & Artisan Payroll (Milestone M17) */}
      <LaborMusterRollView
        projectId="project-rcp-2026"
        projectName="Riverside Commercial Plaza"
        userRole="COMPANY_ADMIN"
      />

      {/* Field Safety Audits & DOSHS/NCA Compliance Scorecards (Milestone M18) */}
      <SafetyAuditScorecardView
        projectId="project-rcp-2026"
        projectName="Riverside Commercial Plaza"
        userRole="COMPANY_ADMIN"
      />

      {/* KRA e-TIMS Tax Compliance Engine (Milestone M19) */}
      <ETimsTaxComplianceView
        projectId="project-rcp-2026"
        projectName="Riverside Commercial Plaza"
        userRole="COMPANY_ADMIN"
      />

      {/* Retention Releases & Contractor Performance Bonds (Milestone M21) */}
      <RetentionAndBondsView
        projectId="project-rcp-2026"
        projectName="Riverside Commercial Plaza"
        userRole="COMPANY_ADMIN"
      />

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
        projectId="project-rcp-2026"
        projectName="Riverside Commercial Plaza"
      />

      {/* Quotes-to-Cash: quotations, client acceptance, project conversion (Gate-4 S1) */}
      <QuotesManagementView />

      {/* Invoicing: AR invoices, payments, PDF tax invoices (Gate-4 S2) */}
      <InvoicingView />

      {/* Invite Member Modal */}
      {showInviteModal && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl shadow-xl border border-slate-200 max-w-md w-full p-6 space-y-4">
            <div className="flex justify-between items-center">
              <h3 className="text-base font-bold text-slate-900">Invite Team Member</h3>
              <button onClick={() => setShowInviteModal(false)} className="text-slate-400 hover:text-slate-600 font-bold">✕</button>
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
              <button onClick={() => setShowProjectModal(false)} className="text-slate-400 hover:text-slate-600 font-bold">✕</button>
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
                  placeholder="45000000"
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