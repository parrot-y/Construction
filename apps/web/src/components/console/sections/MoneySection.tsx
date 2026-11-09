import React, { useEffect, useState} from 'react';
import { formatKes } from '../../../ui';
import BoqWorkbookView from './BoqWorkbookView';
import { useConsole} from '../ConsoleContext';
import CostManagementView from '../../CostManagementView';
import BudgetSummaryCard from '../../BudgetSummaryCard';
import VarianceMonitorCard from '../../VarianceMonitorCard';
import CommitmentsView from '../../CommitmentsView';
import QuotesManagementView from '../../QuotesManagementView';
import InvoicingView from '../../InvoicingView';
import SiteInventoryManagementView from '../../SiteInventoryManagementView';
import { SubscriptionBillingView} from '../../SubscriptionBillingView';
import { RetentionAndBondsView} from '../../RetentionAndBondsView';
import { ProjectSCurveCashFlowCard} from '../../ProjectSCurveCashFlowCard';
import CertificatesCloseoutView from '../../CertificatesCloseoutView';
import { SubcontractorValuationView} from '../../SubcontractorValuationView';

function EmptyProject({ what}: { what: string}): React.JSX.Element {
  return (
<div className="bg-white dark:bg-slate-800/60 border border-slate-200 dark:border-slate-800 rounded-2xl p-10 text-center text-sm text-slate-500 dark:text-slate-400">
      Select a project to view {what}.
</div>
);
}

const FIN_TABS = ['overview', 'ledger', 'boq', 'applications', 'retention', 'budget'] as const;

/** Financial tracker — money in/out, budget vs actual, exports (reference"Financials"). */
function FinancialsView({ projectId, projectName}: { projectId: string; projectName?: string}): React.JSX.Element {
  const [ft, setFt] = useState<(typeof FIN_TABS)[number]>('overview');
  const [kpis, setKpis] = useState<{ cashIn: number; deposits: number; cashOut: number; net: number} | null>(null);

  useEffect(() => {
    let cancelled = false;
    const money = (v: any) => Number(v ?? 0);
    Promise.all([
      fetch(`/api/v1/invoices?projectId=${projectId}`, { credentials: 'include'}).then((r) => (r.ok ? r.json() : { data: []})),
      fetch(`/api/v1/projects/${projectId}/costs`, { credentials: 'include'}).then((r) => (r.ok ? r.json() : { data: []})),
    ]).then(([invJ, costJ]) => {
      if (cancelled) return;
      const invoices = invJ.data || invJ || [];
      const costs = costJ.data || costJ || [];
      const cashIn = invoices.reduce((a: number, i: any) => a + money(i.amount_paid), 0);
      const deposits = invoices
        .filter((i: any) => /deposit|advance|mobilization/i.test(i.title || ''))
        .reduce((a: number, i: any) => a + money(i.amount_paid), 0);
      const cashOut = costs
        .filter((c: any) => ['APPROVED', 'POSTED', 'PAID'].includes(c.status) || !c.status)
        .reduce((a: number, c: any) => a + money(c.amount ?? c.total_amount ?? c.value), 0);
      setKpis({ cashIn, deposits, cashOut, net: cashIn - cashOut});
}).catch(() => {});
    return () => { cancelled = true;};
}, [projectId]);
  return (
<div className="space-y-4">
<div className="flex flex-wrap items-center justify-between gap-3">
<div>
<h3 className="text-sm font-bold text-slate-900 dark:text-slate-100">Financial tracker</h3>
<p className="text-xs text-slate-500 dark:text-slate-400">Money in and out, budget against actual, exports{projectName ? ` · ${projectName}` : ''}</p>
</div>
<div className="flex gap-2">
<a href={`/api/v1/projects/${projectId}/reports/ipc`} download className="px-3 py-1.5 text-[11px] font-bold rounded-lg border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800">Export PDF</a>
<a href={`/api/v1/projects/${projectId}/reports/financials.xlsx`} download className="px-3 py-1.5 text-[11px] font-bold rounded-lg bg-emerald-700 hover:bg-emerald-800 text-white">Export Excel</a>
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
            {([['Cash in', kpis?.cashIn], ['Deposits & advances', kpis?.deposits], ['Cash out', kpis?.cashOut], ['Net', kpis?.net]] as [string, number | undefined][]).map(([l, v]) => (
<div key={l} className="bg-white dark:bg-slate-800/60 border border-slate-200 dark:border-slate-800 rounded-xl p-4">
<p className="text-[10px] font-bold text-slate-400">{l}</p>
<p className="text-lg font-bold font-mono text-slate-900 dark:text-slate-100 mt-1">{v === undefined ? '—' : formatKes(v)}</p>
</div>
))}
</div>
<div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
<BudgetSummaryCard projectId={projectId} projectName={projectName} />
<VarianceMonitorCard projectId={projectId} projectName={projectName} />
</div>
</div>
)}
      {ft === 'ledger' &&<CostManagementView projectId={projectId} canCreate canApprove />}
      {ft === 'boq' &&<BoqWorkbookView projectId={projectId} />}
      {ft === 'applications' &&<CommitmentsView projectId={projectId} canManage />}
      {ft === 'retention' &&<RetentionAndBondsView projectId={projectId} projectName={projectName} userRole="PM_QS" />}
      {ft === 'budget' && (
<div className="space-y-4">
<BudgetSummaryCard projectId={projectId} projectName={projectName} />
<ProjectSCurveCashFlowCard projectId={projectId} projectName={projectName} />
</div>
)}
</div>
);
}

function NoAccess({ what}: { what: string}): React.JSX.Element {
  return (
<div className="bg-white dark:bg-slate-800/60 border border-slate-200 dark:border-slate-800 rounded-2xl p-10 text-center">
<p className="text-sm font-semibold text-slate-700 dark:text-slate-200">You don&apos;t have access to {what}</p>
<p className="text-xs text-slate-400 mt-1">Contact the site manager for financial details.</p>
</div>
);
}

export default function MoneySection(): React.JSX.Element {
  const { tab, projectId: pid, projects, role} = useConsole();
  void projects;
  const canManage = ['COMPANY_ADMIN', 'ADMIN', 'EXECUTIVE', 'PM_QS', 'SUPERINTENDENT'].includes(role);
  const projectName = projects.find((p) => p.id === pid)?.name;
  const livePid = pid && /^[0-9a-f-]{36}$/i.test(pid) ? pid : '';

  switch (tab) {
    case 'financials':
      if (['VIEWER'].includes(role)) return<NoAccess what="financials" />;
      return livePid ?<FinancialsView projectId={livePid} projectName={projectName} /> :<EmptyProject what="financials" />;
    case 'commitments':
      return livePid ?<CommitmentsView projectId={livePid} canManage={canManage} /> :<EmptyProject what="commitments" />;
    case 'quotes':
      if (!canManage) return<NoAccess what="quotes" />;
      return<QuotesManagementView />;
    case 'invoices':
      return<InvoicingView />;
    case 'inventory':
      return livePid ?<SiteInventoryManagementView projectId={livePid} canManage={canManage} /> :<EmptyProject what="inventory" />;
    case 'certificates':
      return livePid ?<CertificatesCloseoutView projectId={livePid} canManage={canManage} /> :<EmptyProject what="certificates" />;
    case 'subvaluations':
      return livePid ?<SubcontractorValuationView projectId={livePid} userRole={role} /> :<EmptyProject what="subcontractor valuations" />;
    case 'billing':
      return<SubscriptionBillingView />;
    default:
      return livePid ?<FinancialsView projectId={livePid} projectName={projectName} /> :<EmptyProject what="financials" />;
}
}
