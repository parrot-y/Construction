import React, { useState } from 'react';
import { toCurrencyString } from '@construction/money';
import { AuthSession } from '../types/auth';
import BoqImportModal from './BoqImportModal';

interface PmQsDashboardProps {
  session: AuthSession;
}

export default function PmQsDashboard({ session }: PmQsDashboardProps): React.JSX.Element {
  const { user } = session;
  const sampleBudget = toCurrencyString('45000000.00');
  const [showBoqModal, setShowBoqModal] = useState(false);
  const [boqSuccess, setBoqSuccess] = useState<string | null>(null);

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
        <div className="flex items-center gap-2">
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

      {boqSuccess && (
        <div className="p-3 bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-medium rounded-lg flex justify-between items-center">
          <span>✓ {boqSuccess}</span>
          <button onClick={() => setBoqSuccess(null)} className="text-emerald-600 hover:text-emerald-900 font-bold ml-2">×</button>
        </div>
      )}

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

      {/* Variance Monitor & Neutral Alert Guard */}
      <div className="bg-slate-50 rounded-xl border border-slate-200 p-5 space-y-2">
        <div className="flex items-center gap-2">
          <span className="w-2.5 h-2.5 rounded-full bg-emerald-500" />
          <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wider">
            Variance Monitor (Strict GEMINI.md Neutral Language Guard)
          </h4>
        </div>
        <p className="text-xs text-slate-600 leading-relaxed">
          Cost consumption is aligned with recorded physical progress. No variance alerts. If cost consumption ever materially exceeds recorded physical progress, a neutral non-accusatory flag will be triggered automatically.
        </p>
      </div>

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

      {/* BOQ Import Modal */}
      <BoqImportModal
        isOpen={showBoqModal}
        onClose={() => setShowBoqModal(false)}
        onImportSuccess={handleImportSuccess}
        projectId="project-rcp-2026"
        projectName="Riverside Commercial Plaza"
      />
    </div>
  );
}