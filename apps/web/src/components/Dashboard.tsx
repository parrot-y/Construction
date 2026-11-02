import React from 'react';
import { toCurrencyString } from '@construction/money';
import { AuthSession } from '../types/auth';

interface DashboardProps {
  session: AuthSession;
  onLogout: () => void;
}

export default function Dashboard({ session, onLogout }: DashboardProps): React.JSX.Element {
  const { user, permissions } = session;
  const sampleBudget = toCurrencyString('45000000.00');

  const getRoleBadgeColor = (role: string) => {
    switch (role) {
      case 'COMPANY_ADMIN':
      case 'ADMIN':
        return 'bg-blue-100 text-blue-800 border-blue-200';
      case 'PM_QS':
        return 'bg-purple-100 text-purple-800 border-purple-200';
      case 'SITE_SUPERVISOR':
        return 'bg-amber-100 text-amber-800 border-amber-200';
      case 'CLIENT':
        return 'bg-emerald-100 text-emerald-800 border-emerald-200';
      default:
        return 'bg-slate-100 text-slate-800 border-slate-200';
    }
  };

  return (
    <div className="w-full max-w-4xl mx-auto space-y-6">
      {/* Top Navigation Bar */}
      <nav className="bg-white rounded-xl shadow-sm border border-slate-200 p-4 sm:p-6 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <span className="text-[11px] font-semibold uppercase tracking-wider text-emerald-700 bg-emerald-50 border border-emerald-200 px-2.5 py-0.5 rounded-full">
            Active Tenant
          </span>
          <h1 className="text-xl font-bold text-slate-900 mt-1">
            {user.tenant.name}
          </h1>
          <p className="text-xs text-slate-500">
            KRA PIN: P051234567X • NCA Category: NCA 4 • Currency: {user.tenant.currency}
          </p>
        </div>

        <div className="flex items-center gap-3 self-end sm:self-auto">
          <div className="text-right">
            <p className="text-sm font-semibold text-slate-800">{user.fullName}</p>
            <span className={`text-[10px] font-bold px-2 py-0.5 rounded border inline-block ${getRoleBadgeColor(user.role)}`}>
              {user.role}
            </span>
          </div>
          <button
            onClick={onLogout}
            className="px-3 py-1.5 text-xs font-semibold text-slate-700 hover:text-red-700 hover:bg-red-50 border border-slate-200 rounded-lg transition"
          >
            Sign Out
          </button>
        </div>
      </nav>

      {/* Main Content Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Project Card */}
        <div className="md:col-span-2 bg-white rounded-xl shadow-sm border border-slate-200 p-6 space-y-4">
          <div className="flex justify-between items-start">
            <div>
              <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
                Active Project • Code: RCP-2026
              </span>
              <h2 className="text-lg font-bold text-slate-900 mt-0.5">
                Riverside Commercial Plaza
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Riverside Drive, Nairobi • NCA Reg: NCA-PRJ-2026-0891
              </p>
            </div>
            <span className="px-2.5 py-1 bg-emerald-50 text-emerald-700 text-xs font-semibold rounded-full border border-emerald-200">
              Active Site
            </span>
          </div>

          <div className="grid grid-cols-2 gap-4 pt-4 border-t border-slate-100">
            <div className="p-3 bg-slate-50 rounded-lg border border-slate-200">
              <span className="text-[11px] font-medium text-slate-500 uppercase tracking-wider block">
                Approved Contract Budget
              </span>
              <span className="text-base font-bold font-mono text-slate-900 mt-1 block">
                KES {sampleBudget}
              </span>
            </div>

            <div className="p-3 bg-slate-50 rounded-lg border border-slate-200">
              <span className="text-[11px] font-medium text-slate-500 uppercase tracking-wider block">
                Core Loop Status
              </span>
              <span className="text-xs font-medium text-slate-700 mt-1 block">
                BOQ Baseline Ready
              </span>
            </div>
          </div>

          <div className="pt-2 text-xs text-slate-400">
            Workflow: BOQ → Budget Baseline → Site Progress → Cost Ledger → Evidence → Approvals → Client Visibility
          </div>
        </div>

        {/* Permissions & Security Card */}
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 space-y-4">
          <div>
            <h3 className="text-sm font-bold text-slate-900">
              RBAC Permissions
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              Granted to {user.role}:
            </p>
          </div>

          <div className="flex flex-wrap gap-1.5 max-h-56 overflow-y-auto pr-1">
            {permissions.map((p) => (
              <span
                key={p}
                className="text-[10px] font-mono font-medium px-2 py-0.5 bg-slate-100 text-slate-700 rounded border border-slate-200"
              >
                {p}
              </span>
            ))}
          </div>

          <div className="pt-2 border-t border-slate-100 text-[11px] text-slate-400">
            PostgreSQL RLS tenant context: <br />
            <span className="font-mono text-slate-600 break-all">{user.tenant.id}</span>
          </div>
        </div>
      </div>
    </div>
  );
}
