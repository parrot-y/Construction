import React from 'react';
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

function EmptyProject({ what }: { what: string }): React.JSX.Element {
  return (
    <div className="bg-white dark:bg-slate-800/60 border border-slate-200 dark:border-slate-800 rounded-2xl p-10 text-center text-sm text-slate-500 dark:text-slate-400">
      Select a project to view {what}.
    </div>
  );
}

/** Financial tracker — budget vs actual, costs, variance (reference "Financials"). */
function FinancialsView({ projectId, projectName }: { projectId: string; projectName?: string }): React.JSX.Element {
  return (
    <div className="space-y-5">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <BudgetSummaryCard projectName={projectName} />
        <VarianceMonitorCard projectName={projectName} />
      </div>
      <CostManagementView projectId={projectId} canCreate canApprove />
      <RetentionAndBondsView projectId={projectId} projectName={projectName} userRole="PM_QS" />
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
