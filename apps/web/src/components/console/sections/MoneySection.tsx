import React, { useState } from 'react';
import BoqWorkbookView from './BoqWorkbookView';
import { useConsole } from '../ConsoleContext';
import CostManagementView from '../../CostManagementView';
import BudgetSummaryCard from '../../BudgetSummaryCard';
import VarianceMonitorCard from '../../VarianceMonitorCard';
import CommitmentsView from '../../CommitmentsView';
import QuotesManagementView from '../../QuotesManagementView';
import InvoicingView from '../../InvoicingView';
import SiteInventoryManagementView from '../../SiteInventoryManagementView';
import { SubscriptionBillingView } from '../../SubscriptionBillingView';
import { RetentionAndBondsView } from '../../RetentionAndBondsView';
import { ProjectSCurveCashFlowCard } from '../../ProjectSCurveCashFlowCard';

function EmptyProject({ what }: { what: string }): React.JSX.Element {
  return (
    <div className="bg-white dark:bg-slate-800/60 border border-slate-200 dark:border-slate-800 rounded-2xl p-10 text-center text-sm text-slate-500 dark:text-slate-400">
      Select a project to view {what}.
    </div>
  );
}

const FIN_TABS = ['overview', 'ledger', 'boq', 'applications', 'retention', 'budget'] as const;

/** Financial tracker — money in/out, budget vs actual, exports (reference "Financials"). */
function FinancialsView({ projectId, projectName }: { projectId: string; projectName?: string }): React.JSX.Element {
  const [ft, setFt] = useState<(typeof FIN_TABS)[number]>('overview');
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100">Financial tracker</h3>
          <p className="text-xs text-slate-500 dark:text-slate-400">Money in and out, budget against actual, exports{projectName ? ` · ${projectName}` : ''}</p>
        </div>
        <div className="flex gap-2">
          <a href={`/api/v1/projects/${projectId}/reports/ipc`} download className="px-3 py-1.5 text-[11px] font-bold rounded-lg border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800">Export PDF</a>
          <a href={`/api/v1/projects/${projectId}/boq/export`} download className="px-3 py-1.5 text-[11px] font-bold rounded-lg bg-emerald-700 hover:bg-emerald-800 text-white">Export Excel</a>
        </div>
      </div>
      <div className="flex gap-1.5 overflow-x-auto">
        {FIN_TABS.map((t) => (
          <button key={t} onClick={() => setFt(t)}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold whitespace-nowrap capitalize transition ${ft === t ? 'bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900' : 'text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'}`}>
            {t === 'boq' ? 'Bill of quantities' : t}
          </button>
        ))}
      </div>
      {ft === 'overview' && (
        <div className="space-y-4">
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            {[['Cash in', '—'], ['Deposits & advances', '—'], ['Cash out', '—'], ['Net', '—']].map(([l, v]) => (
              <div key={l} className="bg-white dark:bg-slate-800/60 border border-slate-200 dark:border-slate-800 rounded-xl p-4">
                <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">{l}</p>
                <p className="text-lg font-bold font-mono text-slate-900 dark:text-slate-100 mt-1">{v}</p>
              </div>
            ))}
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <BudgetSummaryCard projectName={projectName} />
            <VarianceMonitorCard projectName={projectName} />
          </div>
        </div>
      )}
      {ft === 'ledger' && <CostManagementView projectId={projectId} canCreate canApprove />}
      {ft === 'boq' && <BoqWorkbookView projectId={projectId} />}
      {ft === 'applications' && <CommitmentsView projectId={projectId} canManage />}
      {ft === 'retention' && <RetentionAndBondsView projectId={projectId} projectName={projectName} userRole="PM_QS" />}
      {ft === 'budget' && (
        <div className="space-y-4">
          <BudgetSummaryCard projectName={projectName} />
          <ProjectSCurveCashFlowCard projectId={projectId} projectName={projectName} />
        </div>
      )}
    </div>
  );
}

function NoAccess({ what }: { what: string }): React.JSX.Element {
  return (
    <div className="bg-white dark:bg-slate-800/60 border border-slate-200 dark:border-slate-800 rounded-2xl p-10 text-center">
      <p className="text-sm font-semibold text-slate-700 dark:text-slate-200">You don&apos;t have access to {what}</p>
      <p className="text-xs text-slate-400 mt-1">Contact the site manager for financial details.</p>
    </div>
  );
}

export default function MoneySection(): React.JSX.Element {
  const { tab, projectId: pid, projects, role } = useConsole();
  void projects;
  const canManage = ['COMPANY_ADMIN', 'ADMIN', 'EXECUTIVE', 'PM_QS', 'SUPERINTENDENT'].includes(role);
  const projectName = projects.find((p) => p.id === pid)?.name;
  const livePid = pid && /^[0-9a-f-]{36}$/i.test(pid) ? pid : '';

  switch (tab) {
    case 'financials':
      if (['VIEWER'].includes(role)) return <NoAccess what="financials" />;
      return livePid ? <FinancialsView projectId={livePid} projectName={projectName} /> : <EmptyProject what="financials" />;
    case 'commitments':
      return livePid ? <CommitmentsView projectId={livePid} canManage={canManage} /> : <EmptyProject what="commitments" />;
    case 'quotes':
      if (!canManage) return <NoAccess what="quotes" />;
      return <QuotesManagementView />;
    case 'invoices':
      return <InvoicingView />;
    case 'inventory':
      return livePid ? <SiteInventoryManagementView projectId={livePid} canManage={canManage} /> : <EmptyProject what="inventory" />;
    case 'billing':
      return <SubscriptionBillingView />;
    default:
      return livePid ? <FinancialsView projectId={livePid} projectName={projectName} /> : <EmptyProject what="financials" />;
  }
}
