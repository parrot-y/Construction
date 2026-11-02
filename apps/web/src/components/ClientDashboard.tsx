import React from 'react';
import { toCurrencyString } from '@construction/money';
import { AuthSession } from '../types/auth';

interface ClientDashboardProps {
  session: AuthSession;
}

export default function ClientDashboard({ session }: ClientDashboardProps): React.JSX.Element {
  const { user } = session;
  const contractSum = toCurrencyString('45000000.00');
  const certifiedCost = toCurrencyString('0.00');
  const retentionCap = toCurrencyString('2250000.00');

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <span className="text-xs font-bold text-emerald-800 bg-emerald-50 border border-emerald-200 px-2.5 py-0.5 rounded-full uppercase tracking-wider">
            Client / Property Developer Portal
          </span>
          <h2 className="text-xl font-bold text-slate-900 mt-1">Project Visibility & Progress Verification</h2>
          <p className="text-xs text-slate-500">
            Real-time verified site progress, certified expenditure, and valuation certificates for {user.tenant.name}
          </p>
        </div>
        <span className="px-3 py-1.5 text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200 rounded-lg">
          Client Read-Only + Approvals
        </span>
      </div>

      {/* Progress & Financial Metrics */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
          <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider block">
            Physical Progress
          </span>
          <span className="text-2xl font-bold text-emerald-700 mt-1 block">12.0%</span>
          <div className="w-full bg-slate-100 rounded-full h-1.5 mt-2 overflow-hidden">
            <div className="bg-emerald-500 h-1.5 rounded-full" style={{ width: '12%' }} />
          </div>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
          <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider block">
            Approved Contract Sum
          </span>
          <span className="text-lg font-bold font-mono text-slate-900 mt-1 block">
            KES {contractSum}
          </span>
          <span className="text-[11px] text-slate-400 mt-0.5 block">Original contract sum</span>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
          <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider block">
            Total Certified Cost
          </span>
          <span className="text-lg font-bold font-mono text-slate-900 mt-1 block">
            KES {certifiedCost}
          </span>
          <span className="text-[11px] text-slate-400 mt-0.5 block">0 interim certs issued</span>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
          <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider block">
            Pending Variations
          </span>
          <span className="text-2xl font-bold text-slate-900 mt-1 block">0 Pending</span>
          <span className="text-[11px] text-slate-400 mt-0.5 block">Awaiting client signature</span>
        </div>
      </div>

      {/* Project Status & Retention Ledger Terms */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Project Milestones */}
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6 space-y-4">
          <div className="flex justify-between items-start">
            <div>
              <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Project Schedule</span>
              <h3 className="text-base font-bold text-slate-900 mt-0.5">Riverside Commercial Plaza</h3>
              <p className="text-xs text-slate-500">Riverside Drive, Nairobi • NCA Reg: NCA-PRJ-2026-0891</p>
            </div>
          </div>

          <div className="space-y-3 pt-2">
            <div className="flex items-center justify-between text-xs p-2.5 bg-emerald-50 border border-emerald-200 rounded-lg">
              <div>
                <span className="font-semibold text-emerald-900 block">Milestone 1: Site Possession & Hoarding</span>
                <span className="text-[11px] text-emerald-700">Completed on schedule</span>
              </div>
              <span className="px-2 py-0.5 text-[10px] font-bold bg-emerald-200 text-emerald-900 rounded">100%</span>
            </div>

            <div className="flex items-center justify-between text-xs p-2.5 bg-blue-50 border border-blue-200 rounded-lg">
              <div>
                <span className="font-semibold text-blue-900 block">Milestone 2: Substructure & Foundation</span>
                <span className="text-[11px] text-blue-700">Currently active on site</span>
              </div>
              <span className="px-2 py-0.5 text-[10px] font-bold bg-blue-200 text-blue-900 rounded">45%</span>
            </div>

            <div className="flex items-center justify-between text-xs p-2.5 bg-slate-50 border border-slate-200 rounded-lg text-slate-500">
              <div>
                <span className="font-medium text-slate-700 block">Milestone 3: Reinforced Concrete Frame</span>
                <span className="text-[11px] text-slate-400">Scheduled for Q3</span>
              </div>
              <span className="px-2 py-0.5 text-[10px] font-medium bg-slate-200 text-slate-600 rounded">Upcoming</span>
            </div>
          </div>
        </div>

        {/* Retention Fund & Contract Terms Card */}
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6 space-y-4">
          <div>
            <h3 className="text-sm font-bold text-slate-900">Contract Retention Terms (Kenyan Standard)</h3>
            <p className="text-xs text-slate-500">EASMM & Kenyan standard contract rules enforced</p>
          </div>

          <div className="space-y-3 text-xs">
            <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg space-y-1">
              <span className="text-slate-500 block text-[11px]">Interim Certificate Deduction:</span>
              <span className="font-bold text-slate-800 text-sm">10% of Gross Certified Work</span>
            </div>

            <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg space-y-1">
              <span className="text-slate-500 block text-[11px]">Maximum Retention Fund Cap:</span>
              <span className="font-mono font-bold text-slate-800 text-sm">
                KES {retentionCap} (5% of Contract Sum)
              </span>
            </div>

            <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg space-y-1">
              <span className="text-slate-500 block text-[11px]">Release Milestones:</span>
              <span className="font-medium text-slate-700 block">
                • 50% released at Practical Completion (Section Handover)<br />
                • 50% released at end of Defects Liability Period (DLP)
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Verified Photo Evidence Section */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6 space-y-3">
        <div className="flex justify-between items-center">
          <div>
            <h3 className="text-sm font-bold text-slate-900">Verified Photo Evidence</h3>
            <p className="text-xs text-slate-500">Site photos verified and signed off by PM/QS</p>
          </div>
          <span className="text-xs text-slate-400 font-mono">Riverside Drive, Nairobi</span>
        </div>

        <div className="border border-slate-200 rounded-xl p-8 text-center bg-slate-50/50 space-y-2">
          <div className="text-3xl text-slate-400">🏗️</div>
          <p className="text-xs font-semibold text-slate-700">Substructure Foundation Inspection Completed</p>
          <p className="text-[11px] text-slate-500 max-w-md mx-auto">
            All foundation excavation and rebar inspections are verified by Quantity Surveyor Faith Achieng. Photos and certificates will appear here as each valuation is generated.
          </p>
        </div>
      </div>
    </div>
  );
}